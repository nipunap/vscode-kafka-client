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
            const provider = new ConsumerGroupProvider(clientManager);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);
            sandbox.stub(clientManager, 'getConsumerGroups').resolves([
                { groupId: 'stable-group', state: 'Stable', protocolType: 'consumer' },
                { groupId: 'empty-group', state: 'Empty', protocolType: 'consumer' },
                { groupId: 'dead-group', state: 'Dead', protocolType: 'consumer' }
            ]);

            // Get cluster node
            const clusterItems = await provider.getChildren();
            assert.strictEqual(clusterItems.length, 1);

            // Get consumer groups
            const groups = await provider.getChildren(clusterItems[0]);
            assert.strictEqual(groups.length, 3);
            assert.strictEqual(groups[0].label, 'stable-group');
            assert.strictEqual(groups[1].label, 'empty-group');
            assert.strictEqual(groups[2].label, 'dead-group');
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
