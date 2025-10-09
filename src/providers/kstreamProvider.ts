import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { BaseProvider } from './BaseProvider';

/**
 * Provider for Kafka Streams view
 * Lists topics that are likely used by Kafka Streams applications
 */
export class KStreamProvider extends BaseProvider<KStreamTreeItem> {
    constructor(clientManager: KafkaClientManager) {
        super(clientManager, 'KStreamProvider');
    }

    async getChildren(element?: KStreamTreeItem): Promise<KStreamTreeItem[]> {
        if (!element) {
            // Root level - show clusters
            const clusters = this.getClusters();
            
            if (clusters.length === 0) {
                return [this.createEmptyItem('No clusters configured.') as KStreamTreeItem];
            }
            
            return clusters.map(
                cluster =>
                    new KStreamTreeItem(
                        cluster,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'cluster',
                        cluster
                    )
            );
        }

        if (element.contextValue === 'cluster') {
            // Show Kafka Streams topics for this cluster
            return this.getChildrenSafely(
                element,
                async (el) => {
                    const topics = await this.clientManager.getTopics(el!.clusterName);

                    // Filter topics that are typically used by Kafka Streams
                    // Only show topics with explicit stream-related naming patterns
                    const streamTopics = topics.filter(topic => {
                        // Must not be a system topic
                        if (topic.startsWith('__')) {
                            return false;
                        }
                        
                        // Must not be a KTable/changelog topic
                        if (topic.endsWith('-changelog') || topic.includes('-ktable-') || 
                            topic.includes('-store-') || topic.includes('-state-')) {
                            return false;
                        }
                        
                        // Must explicitly match stream patterns
                        return (
                            topic.includes('-stream-') ||
                            topic.includes('KSTREAM') ||
                            topic.toLowerCase().includes('kstream') ||
                            topic.endsWith('-repartition') ||
                            topic.includes('-repartition-')
                        );
                    });

                    if (streamTopics.length === 0) {
                        return [
                            new KStreamTreeItem(
                                'No KStream topics found',
                                vscode.TreeItemCollapsibleState.None,
                                'empty',
                                el!.clusterName
                            )
                        ];
                    }

                    return streamTopics.map(
                        topic =>
                            new KStreamTreeItem(
                                topic,
                                vscode.TreeItemCollapsibleState.None,
                                'kstream',
                                el!.clusterName,
                                topic
                            )
                    );
                },
                `Loading KStream topics for ${element.label}`
            ).then(items => items.length > 0 ? items : [
                new KStreamTreeItem(
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

export class KStreamTreeItem extends vscode.TreeItem {
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

        // Add click command for kstream topics
        if (this.contextValue === 'kstream') {
            this.command = {
                command: 'kafka.showKStreamDetails',
                title: 'Show KStream Details',
                arguments: [this]
            };
        }
    }

    private getTooltip(): string {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'kstream') {
            return `KStream Topic: ${this.label}\nCluster: ${this.clusterName}`;
        }
        if (this.contextValue === 'empty') {
            return 'No KStream topics found. Create topics with stream-related names or use Kafka Streams applications.';
        }
        return this.label;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.contextValue === 'cluster') {
            return new vscode.ThemeIcon('database');
        }
        if (this.contextValue === 'kstream') {
            return new vscode.ThemeIcon('symbol-event', new vscode.ThemeColor('charts.blue'));
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

