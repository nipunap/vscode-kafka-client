import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';

export class ConsumerGroupProvider implements vscode.TreeDataProvider<ConsumerGroupTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<
        ConsumerGroupTreeItem | undefined | null | void
    > = new vscode.EventEmitter<ConsumerGroupTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConsumerGroupTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    constructor(private clientManager: KafkaClientManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConsumerGroupTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConsumerGroupTreeItem): Promise<ConsumerGroupTreeItem[]> {
        if (!element) {
            // Root level - show clusters
            const clusters = this.clientManager.getClusters();
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
            try {
                const groups = await this.clientManager.getConsumerGroups(element.clusterName);

                if (groups.length === 0) {
                    // Show a placeholder item when no consumer groups exist
                    return [
                        new ConsumerGroupTreeItem(
                            'No consumer groups found',
                            vscode.TreeItemCollapsibleState.None,
                            'empty',
                            element.clusterName
                        )
                    ];
                }

                return groups.map(
                    group =>
                        new ConsumerGroupTreeItem(
                            group.groupId,
                            vscode.TreeItemCollapsibleState.None,
                            'consumerGroup',
                            element.clusterName,
                            group.groupId
                        )
                );
            } catch (error: any) {
                console.error(`Failed to load consumer groups for ${element.label}:`, error);
                vscode.window.showErrorMessage(
                    `Failed to load consumer groups for ${element.label}: ${error?.message || error}`
                );
                return [
                    new ConsumerGroupTreeItem(
                        `Error: ${error?.message || 'Failed to load consumer groups'}`,
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

export class ConsumerGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly clusterName: string,
        public readonly groupId?: string
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
        }
    }

    private getTooltip(): string {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'consumerGroup') {
            return `Consumer Group: ${this.label}`;
        }
        return this.label;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.contextValue === 'cluster') {
            return new vscode.ThemeIcon('database');
        }
        if (this.contextValue === 'consumerGroup') {
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
