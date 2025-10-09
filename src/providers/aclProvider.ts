import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { BaseProvider } from './BaseProvider';
import { ACL } from '../types/acl';

export class ACLProvider extends BaseProvider<ACLTreeItem> {
    constructor(clientManager: KafkaClientManager) {
        super(clientManager, 'ACLProvider');
    }

    async getChildren(element?: ACLTreeItem): Promise<ACLTreeItem[]> {
        if (!element) {
            // Root level - show clusters
            const clusters = this.getClusters();
            
            if (clusters.length === 0) {
                return [this.createEmptyItem('No clusters configured.') as ACLTreeItem];
            }
            
            return clusters.map(
                cluster =>
                    new ACLTreeItem(
                        cluster,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'cluster',
                        cluster
                    )
            );
        }

        if (element.contextValue === 'cluster') {
            // Show ACL categories for this cluster
            return this.getChildrenSafely(
                element,
                async (el) => {
                    try {
                        // Get ACLs for this cluster
                        const acls = await this.clientManager.getACLs(el!.clusterName);

                        if (acls.length === 0) {
                            return [
                                new ACLTreeItem(
                                    'No ACLs found',
                                    vscode.TreeItemCollapsibleState.None,
                                    'empty',
                                    el!.clusterName
                                )
                            ];
                        }

                        // Group ACLs by resource type
                        const groupedACLs = this.groupACLsByResourceType(acls);
                        return this.createResourceTypeItems(groupedACLs, el!.clusterName);
                    } catch (error: any) {
                        // Handle the expected error for CLI tool requirement silently
                        if (error.message && error.message.includes('kafka-acls CLI tool')) {
                            return [
                                new ACLTreeItem(
                                    'No ACLs found',
                                    vscode.TreeItemCollapsibleState.None,
                                    'empty',
                                    el!.clusterName,
                                    undefined,
                                    undefined,
                                    'ACL management requires kafka-acls CLI tool. Use the ACL Help command for guidance.'
                                )
                            ];
                        }

                        // Only log unexpected errors
                        this.logger.error(`Failed to load ACLs for cluster ${el!.clusterName}`, error);
                        return [
                            new ACLTreeItem(
                                'Error: Failed to load ACLs',
                                vscode.TreeItemCollapsibleState.None,
                                'error',
                                el!.clusterName
                            )
                        ];
                    }
                },
                `Loading ACLs for ${element.label}`
            );
        }

        if (element.contextValue === 'acl-category') {
            // Show ACLs for this resource type
            return this.getChildrenSafely(
                element,
                async (el) => {
                    try {
                        const acls = await this.clientManager.getACLs(el!.clusterName);
                        const aclsForType = acls.filter(acl => acl.resourceType === el!.resourceType);

                        if (aclsForType.length === 0) {
                            return [
                                new ACLTreeItem(
                                    'No ACLs found',
                                    vscode.TreeItemCollapsibleState.None,
                                    'empty',
                                    el!.clusterName
                                )
                            ];
                        }

                        return this.createACLItems(aclsForType, el!.clusterName);
                    } catch (error: any) {
                        // Handle the expected error for CLI tool requirement silently
                        if (error.message && error.message.includes('kafka-acls CLI tool')) {
                            return [
                                new ACLTreeItem(
                                    'No ACLs found',
                                    vscode.TreeItemCollapsibleState.None,
                                    'empty',
                                    el!.clusterName,
                                    undefined,
                                    undefined,
                                    'ACL management requires kafka-acls CLI tool. Use the ACL Help command for guidance.'
                                )
                            ];
                        }

                        // Only log unexpected errors
                        this.logger.error(`Failed to load ACLs for resource type ${el!.resourceType}`, error);
                        return [
                            new ACLTreeItem(
                                'Error: Failed to load ACLs',
                                vscode.TreeItemCollapsibleState.None,
                                'error',
                                el!.clusterName
                            )
                        ];
                    }
                },
                `Loading ${element.resourceType} ACLs`
            );
        }

        return [];
    }

    private groupACLsByResourceType(acls: ACL[]): Map<string, ACL[]> {
        const grouped = new Map<string, ACL[]>();

        for (const acl of acls) {
            const resourceType = acl.resourceType || 'Unknown';
            if (!grouped.has(resourceType)) {
                grouped.set(resourceType, []);
            }
            grouped.get(resourceType)!.push(acl);
        }

        return grouped;
    }

    private createResourceTypeItems(groupedACLs: Map<string, ACL[]>, clusterName: string): ACLTreeItem[] {
        const items: ACLTreeItem[] = [];

        for (const [resourceType, aclsForType] of groupedACLs.entries()) {
            const categoryItem = new ACLTreeItem(
                `${resourceType} (${aclsForType.length})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'acl-category',
                clusterName,
                undefined,
                resourceType
            );
            categoryItem.iconPath = this.getResourceTypeIcon(resourceType);
            items.push(categoryItem);
        }

        return items;
    }

    private createACLItems(acls: ACL[], clusterName: string): ACLTreeItem[] {
        return acls.map(acl => {
            const item = new ACLTreeItem(
                this.formatACLDescription(acl),
                vscode.TreeItemCollapsibleState.None,
                'acl',
                clusterName,
                acl
            );
            item.iconPath = this.getACLIcon(acl);
            item.tooltip = this.createACLTooltip(acl);
            return item;
        });
    }

    private formatACLDescription(acl: ACL): string {
        const principal = acl.principal || 'Unknown';
        const operation = acl.operation || 'Unknown';
        const resource = acl.resourceName || 'Unknown';
        const permission = acl.permissionType || 'Unknown';

        return `${principal} → ${operation} on ${resource} (${permission})`;
    }

    private getResourceTypeIcon(resourceType: string): vscode.ThemeIcon {
        switch (resourceType.toLowerCase()) {
            case 'topic':
                return new vscode.ThemeIcon('symbol-key');
            case 'group':
                return new vscode.ThemeIcon('organization');
            case 'cluster':
                return new vscode.ThemeIcon('server');
            case 'transactional_id':
                return new vscode.ThemeIcon('symbol-method');
            default:
                return new vscode.ThemeIcon('shield');
        }
    }

    private getACLIcon(acl: ACL): vscode.ThemeIcon {
        const permission = acl.permissionType?.toLowerCase();
        if (permission === 'allow') {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        } else if (permission === 'deny') {
            return new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'));
        }
        return new vscode.ThemeIcon('shield');
    }

    private createACLTooltip(acl: ACL): string {
        const lines = [
            `Principal: ${acl.principal || 'Unknown'}`,
            `Operation: ${acl.operation || 'Unknown'}`,
            `Resource: ${acl.resourceName || 'Unknown'}`,
            `Permission: ${acl.permissionType || 'Unknown'}`,
            `Host: ${acl.host || '*'}`,
            `Resource Type: ${acl.resourceType || 'Unknown'}`
        ];

        if (acl.resourcePatternType) {
            lines.push(`Pattern Type: ${acl.resourcePatternType}`);
        }

        return lines.join('\n');
    }
}

export class ACLTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly clusterName: string,
        public readonly acl?: ACL,
        public readonly resourceType?: string,
        public readonly customTooltip?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = customTooltip || this.label;
        this.contextValue = contextValue;

        if (contextValue === 'acl') {
            this.command = {
                command: 'kafka.showACLDetails',
                title: 'Show ACL Details',
                arguments: [this]
            };
        } else if (contextValue === 'help') {
            this.command = {
                command: 'kafka.showACLHelp',
                title: 'Show ACL Help',
                arguments: [this]
            };
        }
    }
}
