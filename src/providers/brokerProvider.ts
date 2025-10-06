import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';

export class BrokerProvider implements vscode.TreeDataProvider<BrokerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BrokerTreeItem | undefined | null | void> =
        new vscode.EventEmitter<BrokerTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BrokerTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    constructor(private clientManager: KafkaClientManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BrokerTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: BrokerTreeItem): Promise<BrokerTreeItem[]> {
        if (!element) {
            // Root level - show clusters
            const clusters = this.clientManager.getClusters();
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
            try {
                const brokers = await this.clientManager.getBrokers(element.clusterName);

                if (brokers.length === 0) {
                    return [
                        new BrokerTreeItem(
                            'No brokers found',
                            vscode.TreeItemCollapsibleState.None,
                            'empty',
                            element.clusterName
                        )
                    ];
                }

                return brokers.map(
                    broker =>
                        new BrokerTreeItem(
                            `Broker ${broker.nodeId} (${broker.host}:${broker.port})`,
                            vscode.TreeItemCollapsibleState.None,
                            'broker',
                            element.clusterName,
                            broker.nodeId
                        )
                );
            } catch (error: any) {
                console.error(`Failed to load brokers for ${element.label}:`, error);
                return [
                    new BrokerTreeItem(
                        `Error: Connection failed`,
                        vscode.TreeItemCollapsibleState.None,
                        'error',
                        element.clusterName
                    )
                ];
            }
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
