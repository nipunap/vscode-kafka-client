import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { BaseProvider } from './BaseProvider';

export class KafkaExplorerProvider extends BaseProvider<KafkaTreeItem> {
    constructor(clientManager: KafkaClientManager) {
        super(clientManager, 'KafkaExplorerProvider');
        // Load saved clusters on startup
        this.clientManager.loadConfiguration();
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
            // Show dashboard and partition info for this topic
            return [
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
        }

        return [];
    }
}

export class KafkaTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly clusterName: string,
        public readonly topicName?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
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
    }

    private getTooltip(): string {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'topic') {
            return `Topic: ${this.label}\nClick to expand for dashboard and details`;
        }
        if (this.contextValue === 'topicDashboard') {
            return `📊 Dashboard for ${this.topicName}\nClick to view metrics and charts`;
        }
        if (this.contextValue === 'topicDetails') {
            return `📋 Details for ${this.topicName}\nClick to view configuration and partitions`;
        }
        return this.label;
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
        if (this.contextValue === 'empty') {
            return new vscode.ThemeIcon('info');
        }
        if (this.contextValue === 'error') {
            return new vscode.ThemeIcon('error');
        }
        return new vscode.ThemeIcon('circle-outline');
    }
}
