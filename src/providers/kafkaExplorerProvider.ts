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
                                vscode.TreeItemCollapsibleState.None,
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
    }

    private getTooltip(): string {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'topic') {
            return `Topic: ${this.label}`;
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
        if (this.contextValue === 'empty') {
            return new vscode.ThemeIcon('info');
        }
        if (this.contextValue === 'error') {
            return new vscode.ThemeIcon('error');
        }
        return new vscode.ThemeIcon('circle-outline');
    }
}
