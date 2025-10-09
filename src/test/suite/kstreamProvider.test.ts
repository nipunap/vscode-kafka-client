import * as assert from 'assert';
import * as sinon from 'sinon';
import { KStreamProvider, KStreamTreeItem } from '../../providers/kstreamProvider';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import * as vscode from 'vscode';

suite('KStream Provider Test Suite', () => {
    let provider: KStreamProvider;
    let clientManager: any;
    let getTopicsStub: sinon.SinonStub;
    let getClustersStub: sinon.SinonStub;

    setup(() => {
        // Create stub instance which returns stub methods
        clientManager = sinon.createStubInstance(KafkaClientManager);
        provider = new KStreamProvider(clientManager as any);

        // Get the stub methods that were created by createStubInstance
        getTopicsStub = clientManager.getTopics as sinon.SinonStub;
        getClustersStub = clientManager.getClusters as sinon.SinonStub;
    });

    teardown(() => {
        sinon.restore();
    });

    suite('Root Level', () => {
        test('should return empty state when no clusters configured', async () => {
            getClustersStub.returns([]);

            const children = await provider.getChildren();

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No clusters configured.');
            assert.strictEqual(children[0].contextValue, 'empty');
        });

        test('should return cluster items when clusters exist', async () => {
            getClustersStub.returns(['cluster1', 'cluster2']);

            const children = await provider.getChildren();

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'cluster1');
            assert.strictEqual(children[0].contextValue, 'cluster');
            assert.strictEqual(children[0].collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
            assert.strictEqual(children[1].label, 'cluster2');
            assert.strictEqual(children[1].contextValue, 'cluster');
        });
    });

    suite('KStream Topic Filtering', () => {
        const clusterNode = new KStreamTreeItem(
            'test-cluster',
            vscode.TreeItemCollapsibleState.Collapsed,
            'cluster',
            'test-cluster'
        );

        test('should filter and show topics with -stream- pattern', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-stream-input',
                'my-app-stream-output',
                'regular-topic',
                'another-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'my-app-stream-input');
            assert.strictEqual(children[0].contextValue, 'kstream');
            assert.strictEqual(children[1].label, 'my-app-stream-output');
        });

        test('should filter and show topics with KSTREAM pattern', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'KSTREAM-AGGREGATE-001',
                'KSTREAM-JOIN-002',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'KSTREAM-AGGREGATE-001');
            assert.strictEqual(children[1].label, 'KSTREAM-JOIN-002');
        });

        test('should filter and show topics with kstream (lowercase) pattern', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-kstream-topic',
                'another-kstream',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'my-kstream-topic');
            assert.strictEqual(children[1].label, 'another-kstream');
        });

        test('should filter and show repartition topics', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-topic-repartition',
                'stream-repartition-by-key',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'my-app-topic-repartition');
            assert.strictEqual(children[1].label, 'stream-repartition-by-key');
        });

        test('should exclude system topics starting with __', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                '__consumer_offsets',
                '__transaction_state',
                'my-stream-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'my-stream-topic');
        });

        test('should exclude changelog topics', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-store-changelog',
                'state-store-changelog',
                'my-stream-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'my-stream-topic');
        });

        test('should exclude ktable topics', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-ktable-topic',
                'app-ktable-store',
                'my-stream-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'my-stream-topic');
        });

        test('should exclude store topics', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-store-internal',
                'state-store-topic',
                'my-stream-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'my-stream-topic');
        });

        test('should exclude state topics', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-state-store',
                'aggregation-state-topic',
                'my-stream-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'my-stream-topic');
        });

        test('should show empty state when no kstream topics found', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'regular-topic-1',
                'regular-topic-2',
                'my-changelog',
                '__consumer_offsets'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No KStream topics found');
            assert.strictEqual(children[0].contextValue, 'empty');
        });

        test('should not show regular topics without stream patterns', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'users',
                'orders',
                'payments',
                'inventory'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No KStream topics found');
        });

        test('should handle mixed topic patterns correctly', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'app-stream-input',              // Should show (has -stream-)
                'app-output-changelog',          // Should exclude (changelog)
                'KSTREAM-FILTER-001',           // Should show (KSTREAM)
                'app-ktable-materialized',      // Should exclude (ktable)
                'topic-repartition',            // Should show (ends with -repartition)
                'regular-topic',                // Should exclude (no pattern)
                '__consumer_offsets',           // Should exclude (system)
                'my-kstream-aggregate'          // Should show (kstream lowercase)
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 4);
            assert.strictEqual(children[0].label, 'app-stream-input');
            assert.strictEqual(children[1].label, 'KSTREAM-FILTER-001');
            assert.strictEqual(children[2].label, 'topic-repartition');
            assert.strictEqual(children[3].label, 'my-kstream-aggregate');
        });
    });

    suite('KStream Tree Item', () => {
        test('should create kstream item with correct properties', () => {
            const item = new KStreamTreeItem(
                'my-stream',
                vscode.TreeItemCollapsibleState.None,
                'kstream',
                'test-cluster',
                'my-stream'
            );

            assert.strictEqual(item.label, 'my-stream');
            assert.strictEqual(item.contextValue, 'kstream');
            assert.strictEqual(item.clusterName, 'test-cluster');
            assert.strictEqual(item.topicName, 'my-stream');
            assert.ok(item.command);
            assert.strictEqual(item.command?.command, 'kafka.showKStreamDetails');
        });

        test('should have appropriate tooltip for kstream', () => {
            const item = new KStreamTreeItem(
                'my-stream',
                vscode.TreeItemCollapsibleState.None,
                'kstream',
                'test-cluster',
                'my-stream'
            );

            const tooltip = typeof item.tooltip === 'string' ? item.tooltip : item.tooltip?.value || '';
            assert.ok(tooltip.includes('KStream Topic'));
            assert.ok(tooltip.includes('my-stream'));
            assert.ok(tooltip.includes('test-cluster'));
        });

        test('should have appropriate tooltip for cluster', () => {
            const item = new KStreamTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const tooltip = typeof item.tooltip === 'string' ? item.tooltip : item.tooltip?.value || '';
            assert.ok(tooltip.includes('Cluster: test-cluster'));
        });

        test('should have appropriate tooltip for empty state', () => {
            const item = new KStreamTreeItem(
                'No KStream topics found',
                vscode.TreeItemCollapsibleState.None,
                'empty',
                'test-cluster'
            );

            const tooltip = typeof item.tooltip === 'string' ? item.tooltip : item.tooltip?.value || '';
            assert.ok(tooltip.includes('No KStream topics found'));
            assert.ok(tooltip.includes('stream-related names'));
        });

        test('should have blue icon for kstream topics', () => {
            const item = new KStreamTreeItem(
                'my-stream',
                vscode.TreeItemCollapsibleState.None,
                'kstream',
                'test-cluster',
                'my-stream'
            );

            assert.ok(item.iconPath);
            assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'symbol-event');
        });
    });

    suite('Error Handling', () => {
        test('should handle connection errors gracefully', async () => {
            const clusterNode = new KStreamTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            getTopicsStub.withArgs('test-cluster').rejects(new Error('Connection failed'));

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'Error: Connection failed');
            assert.strictEqual(children[0].contextValue, 'error');
        });

        test('should handle empty topic list', async () => {
            const clusterNode = new KStreamTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            getTopicsStub.withArgs('test-cluster').resolves([]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No KStream topics found');
        });
    });
});
