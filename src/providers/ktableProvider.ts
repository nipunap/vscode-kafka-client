import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { BaseProvider } from './BaseProvider';

/**
 * Provider for KTables view
 * Lists topics that are likely used as KTables (changelog topics)
 */
export class KTableProvider extends BaseProvider<KTableTreeItem> {
    constructor(clientManager: KafkaClientManager) {
        super(clientManager, 'KTableProvider');
    }

    async getChildren(element?: KTableTreeItem): Promise<KTableTreeItem[]> {
        if (!element) {
            // Root level - show clusters
            const clusters = this.getClusters();

            if (clusters.length === 0) {
                return [this.createEmptyItem('No clusters configured.') as KTableTreeItem];
            }

            return clusters.map(
                cluster =>
                    new KTableTreeItem(
                        cluster,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'cluster',
                        cluster
                    )
            );
        }

        if (element.contextValue === 'cluster') {
            // Show KTable topics for this cluster
            return this.getChildrenSafely(
                element,
                async (el) => {
                    const topics = await this.clientManager.getTopics(el!.clusterName);

                    // Filter topics that are typically used as KTables
                    // Only show topics with explicit KTable/changelog patterns
                    const ktableTopics = topics.filter(topic => {
                        // Must not be a system topic
                        if (topic.startsWith('__')) {
                            return false;
                        }

                        // Must explicitly match KTable patterns
                        return (
                            topic.endsWith('-changelog') ||
                            topic.includes('-ktable-') ||
                            topic.includes('-store-') ||
                            topic.includes('KTABLE') ||
                            topic.toLowerCase().includes('ktable') ||
                            topic.includes('-state-')
                        );
                    });

                    if (ktableTopics.length === 0) {
                        return [
                            new KTableTreeItem(
                                'No KTable topics found',
                                vscode.TreeItemCollapsibleState.None,
                                'empty',
                                el!.clusterName
                            )
                        ];
                    }

                    // Sort ktable topics alphabetically
                    ktableTopics.sort((a, b) => a.localeCompare(b));

                    return ktableTopics.map(
                        topic =>
                            new KTableTreeItem(
                                topic,
                                vscode.TreeItemCollapsibleState.None,
                                'ktable',
                                el!.clusterName,
                                topic
                            )
                    );
                },
                `Loading KTable topics for ${element.label}`
            ).then(items => items.length > 0 ? items : [
                new KTableTreeItem(
                    'Error: Connection failed',
                    vscode.TreeItemCollapsibleState.None,
                    'error',
                    element.clusterName
                )
            ]);
        }

        return [];
    }

    getParent(element: KTableTreeItem): KTableTreeItem | undefined {
        if (element.contextValue === 'ktable') {
            return new KTableTreeItem(
                element.clusterName,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                element.clusterName
            );
        }
        return undefined;
    }
}

export class KTableTreeItem extends vscode.TreeItem {
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

        // Add click command for ktable topics
        if (this.contextValue === 'ktable') {
            this.command = {
                command: 'kafka.showKTableDetails',
                title: 'Show KTable Details',
                arguments: [this]
            };
        }
    }

    private getTooltip(): string {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'ktable') {
            return `KTable Topic: ${this.label}\nCluster: ${this.clusterName}\n(Typically a changelog or state store topic)`;
        }
        if (this.contextValue === 'empty') {
            return 'No KTable topics found. Create topics with changelog or state store patterns, or use Kafka Streams KTable operations.';
        }
        return this.label;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.contextValue === 'cluster') {
            return new vscode.ThemeIcon('database');
        }
        if (this.contextValue === 'ktable') {
            return new vscode.ThemeIcon('table', new vscode.ThemeColor('charts.purple'));
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
