import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { BaseProvider } from './BaseProvider';
import { ConsumerGroupsWebview } from '../views/ConsumerGroupsWebview';

export class ConsumerGroupProvider extends BaseProvider<ConsumerGroupTreeItem> {
    constructor(clientManager: KafkaClientManager) {
        super(clientManager, 'ConsumerGroupProvider');
    }

    async getChildren(element?: ConsumerGroupTreeItem): Promise<ConsumerGroupTreeItem[]> {
        if (!element) {
            // Root level - show clusters
            const clusters = this.getClusters();

            if (clusters.length === 0) {
                return [this.createEmptyItem('No clusters configured.') as ConsumerGroupTreeItem];
            }

            return clusters.map(
                cluster =>
                    new ConsumerGroupTreeItem(
                        cluster,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'cluster',
                        cluster
                    )
            );
        }

        if (element.contextValue === 'cluster') {
            // Show consumer groups for this cluster
            return this.getChildrenSafely(
                element,
                async (el) => {
                    const groups = await this.clientManager.getConsumerGroups(el!.clusterName);

                    if (groups.length === 0) {
                        return [
                            new ConsumerGroupTreeItem(
                                'No consumer groups found',
                                vscode.TreeItemCollapsibleState.None,
                                'empty',
                                el!.clusterName
                            )
                        ];
                    }

                    // Sort consumer groups alphabetically by groupId
                    groups.sort((a, b) => a.groupId.localeCompare(b.groupId));

                    // SEC-3.7-1: Check if we need paginated webview for large lists
                    const config = vscode.workspace.getConfiguration('kafka.explorer');
                    const largeListThreshold = config.get<number>('largeListThreshold', 500);

                    if (groups.length > largeListThreshold) {
                        // Show webview for large lists
                        const webview = ConsumerGroupsWebview.getInstance();
                        await webview.show(el!.clusterName, groups);

                        // Return a "View All" item in the tree
                        return [
                            new ConsumerGroupTreeItem(
                                `📋 View All Consumer Groups (${groups.length})`,
                                vscode.TreeItemCollapsibleState.None,
                                'viewAll',
                                el!.clusterName
                            ),
                            ...groups.slice(0, 10).map(
                                group =>
                                    new ConsumerGroupTreeItem(
                                        group.groupId,
                                        vscode.TreeItemCollapsibleState.None,
                                        'consumerGroup',
                                        el!.clusterName,
                                        group.groupId,
                                        group.state
                                    )
                            )
                        ];
                    }

                    return groups.map(
                        group =>
                            new ConsumerGroupTreeItem(
                                group.groupId,
                                vscode.TreeItemCollapsibleState.None,
                                'consumerGroup',
                                el!.clusterName,
                                group.groupId,
                                group.state
                            )
                    );
                },
                `Loading consumer groups for ${element.label}`
            ).then(items => items.length > 0 ? items : [
                new ConsumerGroupTreeItem(
                    'Error: Failed to load consumer groups',
                    vscode.TreeItemCollapsibleState.None,
                    'error',
                    element.clusterName
                )
            ]);
        }

        return [];
    }

    getParent(element: ConsumerGroupTreeItem): ConsumerGroupTreeItem | undefined {
        if (element.contextValue === 'consumerGroup') {
            return new ConsumerGroupTreeItem(
                element.clusterName,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                element.clusterName
            );
        }
        return undefined;
    }
}

export class ConsumerGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly clusterName: string,
        public readonly groupId?: string,
        public readonly state?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();

        // Add click command for consumer groups
        if (this.contextValue === 'consumerGroup') {
            this.command = {
                command: 'kafka.showConsumerGroupDetails',
                title: 'Show Consumer Group Details',
                arguments: [this]
            };
        } else if (this.contextValue === 'viewAll') {
            this.command = {
                command: 'kafka.showAllConsumerGroups',
                title: 'Show All Consumer Groups',
                arguments: [this.clusterName]
            };
        }
    }

    private getTooltip(): string {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'consumerGroup') {
            const stateLabel = this.getStateLabel();
            return `Consumer Group: ${this.label}\nState: ${stateLabel}`;
        }
        return this.label;
    }

    private getStateLabel(): string {
        if (!this.state) {
            return 'Unknown';
        }

        const state = this.state.toLowerCase();

        // Map Kafka states to human-readable labels
        if (state === 'stable') {
            return 'Active';
        } else if (state === 'empty') {
            return 'Empty (no active consumers)';
        } else if (state === 'dead' || state === 'preparingrebalance' || state === 'completingrebalance') {
            return state === 'dead' ? 'Dead/Zombie' : this.state;
        }

        return this.state;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.contextValue === 'cluster') {
            return new vscode.ThemeIcon('database');
        }
        if (this.contextValue === 'consumerGroup') {
            // Color-code based on consumer group state
            const state = this.state?.toLowerCase() || '';

            if (state === 'stable') {
                // Active consumer groups - GREEN
                return new vscode.ThemeIcon('organization', new vscode.ThemeColor('charts.green'));
            } else if (state === 'empty') {
                // Empty consumer groups - ORANGE
                return new vscode.ThemeIcon('organization', new vscode.ThemeColor('charts.orange'));
            } else if (state === 'dead' || state === 'preparingrebalance' || state === 'completingrebalance') {
                // Dead/Zombie or rebalancing consumer groups - RED
                return new vscode.ThemeIcon('organization', new vscode.ThemeColor('charts.red'));
            }

            // Unknown state - default color
            return new vscode.ThemeIcon('organization');
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
