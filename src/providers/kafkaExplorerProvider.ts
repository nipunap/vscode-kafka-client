import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { BaseProvider } from './BaseProvider';
import { ACL } from '../types/acl';

export class KafkaExplorerProvider extends BaseProvider<KafkaTreeItem> {
    // Cache for dynamically added topics (topics found via search but not in the limited view)
    private dynamicTopics: Map<string, Set<string>> = new Map(); // clusterName -> Set of topic names

    constructor(clientManager: KafkaClientManager) {
        super(clientManager, 'KafkaExplorerProvider');
        // Load saved clusters on startup
        this.clientManager.loadConfiguration();
    }

    /**
     * Add a topic to be displayed in the tree (for search results beyond the 100-topic limit)
     */
    addDynamicTopic(clusterName: string, topicName: string): void {
        if (!this.dynamicTopics.has(clusterName)) {
            this.dynamicTopics.set(clusterName, new Set());
        }
        this.dynamicTopics.get(clusterName)!.add(topicName);
        this.refresh(); // Refresh the tree to show the new topic
    }

    /**
     * Get parent of a tree item (required for TreeView.reveal())
     */
    getParent(element: KafkaTreeItem): KafkaTreeItem | undefined {
        if (element.contextValue === 'topic') {
            // Parent of a topic is the cluster
            return new KafkaTreeItem(
                element.clusterName,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                element.clusterName
            );
        }
        if (element.contextValue === 'topicDashboard' ||
            element.contextValue === 'topicDetails' ||
            element.contextValue === 'topicACLContainer') {
            // Parent of topic sub-items is the topic
            return new KafkaTreeItem(
                element.topicName!,
                vscode.TreeItemCollapsibleState.Collapsed,
                'topic',
                element.clusterName,
                element.topicName
            );
        }
        if (element.contextValue === 'topicACL') {
            // Parent of ACL is the ACL container
            return new KafkaTreeItem(
                '🔒 ACLs',
                vscode.TreeItemCollapsibleState.Collapsed,
                'topicACLContainer',
                element.clusterName,
                element.topicName
            );
        }
        // Root level items (clusters) have no parent
        return undefined;
    }

    async getChildren(element?: KafkaTreeItem): Promise<KafkaTreeItem[]> {
        if (!element) {
            // Root level - show clusters
            const clusters = this.getClusters();

            if (clusters.length === 0) {
                return [this.createEmptyItem('No clusters configured. Click + to add one.') as KafkaTreeItem];
            }

            return clusters.map(
                cluster =>
                    new KafkaTreeItem(
                        cluster,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'cluster',
                        cluster
                    )
            );
        }

        if (element.contextValue === 'cluster') {
            // Show topics for this cluster
            return this.getChildrenSafely(
                element,
                async (el) => {
                    const topics = await this.clientManager.getTopics(el!.clusterName);

                    if (topics.length === 0) {
                        return [
                            new KafkaTreeItem(
                                'No topics found',
                                vscode.TreeItemCollapsibleState.None,
                                'empty',
                                el!.clusterName
                            )
                        ];
                    }

                    // Sort topics alphabetically (Phase 0: 2.2)
                    topics.sort((a, b) => a.localeCompare(b));

                    // Warn if too many topics
                    const MAX_TOPICS_WITHOUT_WARNING = 1000;
                    if (topics.length > MAX_TOPICS_WITHOUT_WARNING) {
                        const warning = new KafkaTreeItem(
                            `ℹ️ ${topics.length} topics found. Use "Find Topic" (🔍 icon) to search`,
                            vscode.TreeItemCollapsibleState.None,
                            'topicsWarning',
                            el!.clusterName,
                            undefined,
                            undefined,
                            'Click the search icon (🔍) in the toolbar or press Cmd+Shift+F / Ctrl+Shift+F'
                        );

                        // Get dynamic topics for this cluster (from search results)
                        const dynamicTopicsSet = this.dynamicTopics.get(el!.clusterName) || new Set();

                        // Combine first MAX topics with any dynamic topics that aren't already in the list
                        const topicsToShow = new Set<string>();
                        topics.slice(0, MAX_TOPICS_WITHOUT_WARNING).forEach(t => topicsToShow.add(t));
                        dynamicTopicsSet.forEach(t => topicsToShow.add(t));

                        // Convert to sorted array
                        const sortedTopics = Array.from(topicsToShow).sort((a, b) => a.localeCompare(b));

                        const topicItems = sortedTopics.map(
                            topic =>
                                new KafkaTreeItem(
                                    topic,
                                    vscode.TreeItemCollapsibleState.Collapsed,
                                    'topic',
                                    el!.clusterName,
                                    topic
                                )
                        );

                        const dynamicCount = dynamicTopicsSet.size;
                        const hiddenCount = topics.length - MAX_TOPICS_WITHOUT_WARNING - (dynamicCount > 0 ? Math.max(0, dynamicTopicsSet.size - (sortedTopics.length - MAX_TOPICS_WITHOUT_WARNING)) : 0);

                        const showMore = new KafkaTreeItem(
                            `... and ${Math.max(0, hiddenCount)} more. Use 🔍 icon or Cmd+Shift+F`,
                            vscode.TreeItemCollapsibleState.None,
                            'topicsMore',
                            el!.clusterName
                        );
                        return [warning, ...topicItems, showMore];
                    }

                    return topics.map(
                        topic =>
                            new KafkaTreeItem(
                                topic,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                'topic',
                                el!.clusterName,
                                topic
                            )
                    );
                },
                `Loading topics for ${element.label}`
            ).then(items => items.length > 0 ? items : [
                new KafkaTreeItem(
                    'Error: Connection failed',
                    vscode.TreeItemCollapsibleState.None,
                    'error',
                    element.clusterName
                )
            ]);
        }

        if (element.contextValue === 'topic') {
            // Show dashboard, details, and ACLs for this topic
            const items = [
                new KafkaTreeItem(
                    '📊 Dashboard',
                    vscode.TreeItemCollapsibleState.None,
                    'topicDashboard',
                    element.clusterName,
                    element.topicName
                ),
                new KafkaTreeItem(
                    '📋 Details',
                    vscode.TreeItemCollapsibleState.None,
                    'topicDetails',
                    element.clusterName,
                    element.topicName
                )
            ];

            // Add ACL container node
            const aclContainerItem = new KafkaTreeItem(
                '🔒 ACLs',
                vscode.TreeItemCollapsibleState.Collapsed,
                'topicACLContainer',
                element.clusterName,
                element.topicName
            );
            items.push(aclContainerItem);

            return items;
        }

        if (element.contextValue === 'topicACLContainer') {
            // Show ACLs for this topic
            return this.getChildrenSafely(
                element,
                async (el) => {
                    try {
                        const acls = await this.clientManager.getTopicACLs(el!.clusterName, el!.topicName!);

                        if (acls.length === 0) {
                            return [
                                new KafkaTreeItem(
                                    'No ACLs configured',
                                    vscode.TreeItemCollapsibleState.None,
                                    'topicACLEmpty',
                                    el!.clusterName,
                                    el!.topicName,
                                    undefined,
                                    'No ACLs found for this topic. Right-click cluster to create ACLs.'
                                )
                            ];
                        }

                        return acls.map(acl => {
                            const item = new KafkaTreeItem(
                                this.formatACLLabel(acl),
                                vscode.TreeItemCollapsibleState.None,
                                'topicACL',
                                el!.clusterName,
                                el!.topicName,
                                acl
                            );
                            return item;
                        });
                    } catch (error: any) {
                        this.logger.debug(`Failed to load ACLs for topic ${el!.topicName}: ${error?.message}`);
                        return [
                            new KafkaTreeItem(
                                'ACL management requires CLI tool',
                                vscode.TreeItemCollapsibleState.None,
                                'topicACLError',
                                el!.clusterName,
                                el!.topicName,
                                undefined,
                                'Right-click on cluster for ACL Help'
                            )
                        ];
                    }
                },
                `Loading ACLs for ${element.topicName}`
            );
        }

        return [];
    }

    private formatACLLabel(acl: ACL): string {
        const principal = acl.principal?.replace('User:', '') || 'Unknown';
        const operation = acl.operation || 'Unknown';
        const permission = acl.permissionType || 'Allow';
        const icon = permission.toLowerCase() === 'allow' ? '✓' : '✗';
        return `${icon} ${principal} → ${operation} (${permission})`;
    }
}

export class KafkaTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly clusterName: string,
        public readonly topicName?: string,
        public readonly acl?: ACL,
        public readonly customTooltip?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = customTooltip || this.getTooltip();
        this.iconPath = this.getIcon();

        // Add click command for clusters - show dashboard
        if (this.contextValue === 'cluster') {
            this.command = {
                command: 'kafka.showClusterDashboard',
                title: 'Show Cluster Dashboard',
                arguments: [this]
            };
        }

        // Add click command for topics
        if (this.contextValue === 'topic') {
            this.command = {
                command: 'kafka.showTopicDetails',
                title: 'Show Topic Details',
                arguments: [this]
            };
        }

        // Add click command for topic dashboard
        if (this.contextValue === 'topicDashboard') {
            this.command = {
                command: 'kafka.showTopicDashboard',
                title: 'Show Topic Dashboard',
                arguments: [this]
            };
        }

        // Add click command for topic details
        if (this.contextValue === 'topicDetails') {
            this.command = {
                command: 'kafka.showTopicDetails',
                title: 'Show Topic Details',
                arguments: [this]
            };
        }

        // Add click command for topic ACL
        if (this.contextValue === 'topicACL') {
            this.command = {
                command: 'kafka.showTopicACLDetails',
                title: 'Show ACL Details',
                arguments: [this]
            };
        }
    }

    private getTooltip(): string {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'topic') {
            return `Topic: ${this.label}\nClick to expand for dashboard, details, and ACLs`;
        }
        if (this.contextValue === 'topicDashboard') {
            return `📊 Dashboard for ${this.topicName}\nClick to view metrics and charts`;
        }
        if (this.contextValue === 'topicDetails') {
            return `📋 Details for ${this.topicName}\nClick to view configuration and partitions`;
        }
        if (this.contextValue === 'topicACLContainer') {
            return `🔒 Access Control Lists for ${this.topicName}\nExpand to view permissions`;
        }
        if (this.contextValue === 'topicACL' && this.acl) {
            return this.getACLTooltip(this.acl);
        }
        return this.label;
    }

    private getACLTooltip(acl: ACL): string {
        const lines = [
            `Principal: ${acl.principal || 'Unknown'}`,
            `Operation: ${acl.operation || 'Unknown'}`,
            `Resource: ${acl.resourceName || 'Unknown'}`,
            `Permission: ${acl.permissionType || 'Unknown'}`,
            `Host: ${acl.host || '*'}`
        ];
        if (acl.resourcePatternType) {
            lines.push(`Pattern: ${acl.resourcePatternType}`);
        }
        return lines.join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.contextValue === 'cluster') {
            return new vscode.ThemeIcon('database');
        }
        if (this.contextValue === 'topic') {
            return new vscode.ThemeIcon('symbol-struct', new vscode.ThemeColor('charts.yellow')); // Topic as data structure in yellow
        }
        if (this.contextValue === 'topicDashboard') {
            return new vscode.ThemeIcon('graph', new vscode.ThemeColor('charts.blue')); // Dashboard icon in blue
        }
        if (this.contextValue === 'topicDetails') {
            return new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.green')); // Details icon in green
        }
        if (this.contextValue === 'topicACLContainer') {
            return new vscode.ThemeIcon('shield', new vscode.ThemeColor('charts.purple')); // ACL container in purple
        }
        if (this.contextValue === 'topicACL' && this.acl) {
            // Show different icons based on permission type
            const permission = this.acl.permissionType?.toLowerCase();
            if (permission === 'allow') {
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            } else if (permission === 'deny') {
                return new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'));
            }
            return new vscode.ThemeIcon('shield');
        }
        if (this.contextValue === 'topicACLEmpty' || this.contextValue === 'topicACLError') {
            return new vscode.ThemeIcon('info');
        }
        if (this.contextValue === 'empty') {
            return new vscode.ThemeIcon('info');
        }
        if (this.contextValue === 'error') {
            return new vscode.ThemeIcon('error');
        }
        return new vscode.ThemeIcon('circle-outline');
    }
}
