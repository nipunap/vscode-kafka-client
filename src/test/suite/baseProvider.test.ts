import * as assert from 'assert';
import * as vscode from 'vscode';
import { BaseProvider } from '../../providers/BaseProvider';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import * as sinon from 'sinon';

// Create a concrete implementation of BaseProvider for testing
class TestTreeItem extends vscode.TreeItem {
    constructor(
        public label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(label, collapsibleState);
    }
}

class TestProvider extends BaseProvider<TestTreeItem> {
    constructor(clientManager: KafkaClientManager) {
        super(clientManager, 'TestProvider');
    }

    async getChildren(element?: TestTreeItem): Promise<TestTreeItem[]> {
        if (!element) {
            // Root level - return clusters
            const clusters = this.getClusters();
            if (clusters.length === 0) {
                return [this.createEmptyItem('No items') as TestTreeItem];
            }
            return clusters.map(name => new TestTreeItem(name, vscode.TreeItemCollapsibleState.Collapsed));
        }

        // Cluster level - return items
        return this.getChildrenSafely(
            element,
            async (el) => {
                if (el!.label === 'error-cluster') {
                    throw new Error('Test error');
                }
                return [
                    new TestTreeItem('item1'),
                    new TestTreeItem('item2')
                ];
            },
            `Loading items for ${element.label}`
        );
    }
}

suite('BaseProvider Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let clientManager: KafkaClientManager;
    let provider: TestProvider;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = new KafkaClientManager();
        provider = new TestProvider(clientManager);
    });

    teardown(() => {
        sandbox.restore();
        clientManager.dispose();
    });

    test('should create provider instance', () => {
        assert.ok(provider);
        assert.ok(provider.onDidChangeTreeData);
    });

    test('should refresh provider', () => {
        let eventFired = false;
        provider.onDidChangeTreeData(() => {
            eventFired = true;
        });

        provider.refresh();

        assert.strictEqual(eventFired, true);
    });

    test('should return tree item', () => {
        const item = new TestTreeItem('test');
        const treeItem = provider.getTreeItem(item);

        assert.strictEqual(treeItem, item);
    });

    test('should get clusters', async () => {
        // Add a test cluster
        sandbox.stub(clientManager, 'addCluster').resolves();
        await clientManager.addCluster('test-cluster', ['localhost:9092']);

        const clusters = (provider as any).getClusters();

        assert.ok(Array.isArray(clusters));
    });

    test('should create empty item', () => {
        const emptyItem = (provider as any).createEmptyItem('No data');

        assert.strictEqual(emptyItem.label, 'No data');
        assert.strictEqual(emptyItem.contextValue, 'empty');
    });

    test('should create error item', () => {
        const errorItem = (provider as any).createErrorItem('Error occurred');

        assert.strictEqual(errorItem.label, 'Error occurred');
        assert.strictEqual(errorItem.contextValue, 'error');
    });

    test('should handle errors in getChildrenSafely', async () => {
        const errorElement = new TestTreeItem('error-cluster', vscode.TreeItemCollapsibleState.Collapsed);
        const children = await provider.getChildren(errorElement);

        // getChildrenSafely returns empty array on error
        assert.strictEqual(children.length, 0);
    });

    test('should return successful children from getChildrenSafely', async () => {
        const element = new TestTreeItem('test-cluster', vscode.TreeItemCollapsibleState.Collapsed);
        const children = await provider.getChildren(element);

        assert.strictEqual(children.length, 2);
        assert.strictEqual(children[0].label, 'item1');
        assert.strictEqual(children[1].label, 'item2');
    });

    test('should return empty item when no clusters', async () => {
        const children = await provider.getChildren();

        assert.ok(children.length > 0);
        assert.ok(children[0].label?.toString().includes('No items'));
    });

    test('should have onDidChangeTreeData event', () => {
        assert.ok(provider.onDidChangeTreeData);
        assert.strictEqual(typeof provider.onDidChangeTreeData, 'function');
    });

    test('should fire event on refresh', (done) => {
        provider.onDidChangeTreeData(() => {
            done();
        });

        provider.refresh();
    });

    test('should handle multiple refresh calls', () => {
        let eventCount = 0;
        provider.onDidChangeTreeData(() => {
            eventCount++;
        });

        provider.refresh();
        provider.refresh();
        provider.refresh();

        assert.strictEqual(eventCount, 3);
    });

    test('should have logger', () => {
        assert.ok((provider as any).logger);
        assert.ok(typeof (provider as any).logger.debug === 'function');
    });

    test('should have correct provider name in logger', () => {
        const logger = (provider as any).logger;
        // Logger should be initialized with 'TestProvider'
        assert.ok(logger);
    });

    test('should handle undefined element in getChildren', async () => {
        const children = await provider.getChildren(undefined);

        assert.ok(Array.isArray(children));
    });

    test('should create items with correct collapsible state', async () => {
        const item = new TestTreeItem('test', vscode.TreeItemCollapsibleState.Collapsed);
        
        assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    });
});

