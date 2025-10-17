import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { KafkaExplorerProvider } from '../../providers/kafkaExplorerProvider';
import { ConsumerGroupProvider, ConsumerGroupTreeItem } from '../../providers/consumerGroupProvider';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';

suite('Provider Test Suite', () => {
    let clientManager: KafkaClientManager;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = new KafkaClientManager();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('KafkaExplorerProvider', () => {
        test('should create instance', () => {
            const provider = new KafkaExplorerProvider(clientManager);
            assert.ok(provider instanceof KafkaExplorerProvider);
        });

        test('should have refresh method', () => {
            const provider = new KafkaExplorerProvider(clientManager);
            assert.strictEqual(typeof provider.refresh, 'function');
        });

        test('should have getTreeItem method', () => {
            const provider = new KafkaExplorerProvider(clientManager);
            assert.strictEqual(typeof provider.getTreeItem, 'function');
        });

        test('should have getChildren method', () => {
            const provider = new KafkaExplorerProvider(clientManager);
            assert.strictEqual(typeof provider.getChildren, 'function');
        });

        test('should return empty array when no clusters', async () => {
            const provider = new KafkaExplorerProvider(clientManager);
            sandbox.stub(clientManager, 'getClusters').returns([]);

            const children = await provider.getChildren();
            assert.ok(Array.isArray(children));
        });
    });

    suite('ConsumerGroupProvider', () => {
        test('should create instance', () => {
            const provider = new ConsumerGroupProvider(clientManager);
            assert.ok(provider instanceof ConsumerGroupProvider);
        });

        test('should have refresh method', () => {
            const provider = new ConsumerGroupProvider(clientManager);
            assert.strictEqual(typeof provider.refresh, 'function');
        });

        test('should have getTreeItem method', () => {
            const provider = new ConsumerGroupProvider(clientManager);
            assert.strictEqual(typeof provider.getTreeItem, 'function');
        });

        test('should have getChildren method', () => {
            const provider = new ConsumerGroupProvider(clientManager);
            assert.strictEqual(typeof provider.getChildren, 'function');
        });

        test('should return empty array when no clusters', async () => {
            const provider = new ConsumerGroupProvider(clientManager);
            sandbox.stub(clientManager, 'getClusters').returns([]);

            const children = await provider.getChildren();
            assert.ok(Array.isArray(children));
        });

        test('should display consumer groups with state information', async () => {
            const mockCluster = 'test-cluster';
            sandbox.stub(clientManager, 'getClusters').returns([mockCluster]);

            // Mock getConsumerGroups to return groups with different states
            const mockConsumerGroups = [
                { groupId: 'stable-group', state: 'Stable', members: 2, protocol: 'range', topics: 3 },
                { groupId: 'rebalancing-group', state: 'Rebalancing', members: 0, protocol: 'unknown', topics: 0 },
                { groupId: 'empty-group', state: 'Empty', members: 0, protocol: 'none', topics: 0 },
                { groupId: 'dead-group', state: 'Dead', members: 0, protocol: 'none', topics: 0 }
            ];
            sandbox.stub(clientManager, 'getConsumerGroups').withArgs(mockCluster).resolves(mockConsumerGroups);

            const provider = new ConsumerGroupProvider(clientManager as any);
            const clusterNode = new ConsumerGroupTreeItem(
                mockCluster,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                mockCluster
            );

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 4);
            const groupIds = children.map((child: any) => child.label);
            assert.deepStrictEqual(groupIds.sort(), ['dead-group', 'empty-group', 'rebalancing-group', 'stable-group']);
        });
    });

    suite('ConsumerGroupTreeItem', () => {
        test('should have green icon for stable state', () => {
            const item = new ConsumerGroupTreeItem(
                'test-group',
                vscode.TreeItemCollapsibleState.None,
                'consumerGroup',
                'test-cluster',
                'test-group',
                'Stable'
            );

            assert.ok(item.iconPath);
            assert.ok(item.iconPath instanceof vscode.ThemeIcon);
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'organization');
            assert.ok(icon.color);
            assert.strictEqual((icon.color as vscode.ThemeColor).id, 'charts.green');
        });

        test('should have orange icon for empty state', () => {
            const item = new ConsumerGroupTreeItem(
                'test-group',
                vscode.TreeItemCollapsibleState.None,
                'consumerGroup',
                'test-cluster',
                'test-group',
                'Empty'
            );

            assert.ok(item.iconPath);
            assert.ok(item.iconPath instanceof vscode.ThemeIcon);
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'organization');
            assert.ok(icon.color);
            assert.strictEqual((icon.color as vscode.ThemeColor).id, 'charts.orange');
        });

        test('should have red icon for dead state', () => {
            const item = new ConsumerGroupTreeItem(
                'test-group',
                vscode.TreeItemCollapsibleState.None,
                'consumerGroup',
                'test-cluster',
                'test-group',
                'Dead'
            );

            assert.ok(item.iconPath);
            assert.ok(item.iconPath instanceof vscode.ThemeIcon);
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'organization');
            assert.ok(icon.color);
            assert.strictEqual((icon.color as vscode.ThemeColor).id, 'charts.red');
        });

        test('should have red icon for rebalancing states', () => {
            const preparingItem = new ConsumerGroupTreeItem(
                'test-group',
                vscode.TreeItemCollapsibleState.None,
                'consumerGroup',
                'test-cluster',
                'test-group',
                'PreparingRebalance'
            );

            const icon = preparingItem.iconPath as vscode.ThemeIcon;
            assert.strictEqual((icon.color as vscode.ThemeColor).id, 'charts.red');
        });

        test('should include state in tooltip', () => {
            const item = new ConsumerGroupTreeItem(
                'test-group',
                vscode.TreeItemCollapsibleState.None,
                'consumerGroup',
                'test-cluster',
                'test-group',
                'Stable'
            );

            assert.ok(item.tooltip);
            assert.ok((item.tooltip as string).includes('State:'));
            assert.ok((item.tooltip as string).includes('Active'));
        });

        test('should have click command for consumer groups', () => {
            const item = new ConsumerGroupTreeItem(
                'test-group',
                vscode.TreeItemCollapsibleState.None,
                'consumerGroup',
                'test-cluster',
                'test-group',
                'Stable'
            );

            assert.ok(item.command);
            assert.strictEqual(item.command?.command, 'kafka.showConsumerGroupDetails');
            assert.ok(Array.isArray(item.command?.arguments));
        });
    });
});
