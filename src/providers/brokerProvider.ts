import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { BaseProvider } from './BaseProvider';

export class BrokerProvider extends BaseProvider<BrokerTreeItem> {
    constructor(clientManager: KafkaClientManager) {
        super(clientManager, 'BrokerProvider');
    }

    async getChildren(element?: BrokerTreeItem): Promise<BrokerTreeItem[]> {
        if (!element) {
            // Root level - show clusters
            const clusters = this.getClusters();
            
            if (clusters.length === 0) {
                return [this.createEmptyItem('No clusters configured.') as BrokerTreeItem];
            }
            
            return clusters.map(
                cluster =>
                    new BrokerTreeItem(
                        cluster,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'cluster',
                        cluster
                    )
            );
        }

        if (element.contextValue === 'cluster') {
            // Show brokers for this cluster
            return this.getChildrenSafely(
                element,
                async (el) => {
                    const brokers = await this.clientManager.getBrokers(el!.clusterName);

                    if (brokers.length === 0) {
                        return [
                            new BrokerTreeItem(
                                'No brokers found',
                                vscode.TreeItemCollapsibleState.None,
                                'empty',
                                el!.clusterName
                            )
                        ];
                    }

                    return brokers.map(
                        broker =>
                            new BrokerTreeItem(
                                `Broker ${broker.nodeId} (${broker.host}:${broker.port})`,
                                vscode.TreeItemCollapsibleState.None,
                                'broker',
                                el!.clusterName,
                                broker.nodeId
                            )
                    );
                },
                `Loading brokers for ${element.label}`
            ).then(items => items.length > 0 ? items : [
                new BrokerTreeItem(
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

export class BrokerTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly clusterName: string,
        public readonly brokerId?: number
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();

        // Add click command for brokers
        if (this.contextValue === 'broker') {
            this.command = {
                command: 'kafka.showBrokerDetails',
                title: 'Show Broker Details',
                arguments: [this]
            };
        }
    }

    private getTooltip(): string {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'broker') {
            return `Broker: ${this.label}`;
        }
        return this.label;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.contextValue === 'cluster') {
            return new vscode.ThemeIcon('database');
        }
        if (this.contextValue === 'broker') {
            return new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.green'));
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
