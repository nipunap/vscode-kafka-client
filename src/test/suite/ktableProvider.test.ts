import * as assert from 'assert';
import * as sinon from 'sinon';
import { KTableProvider, KTableTreeItem } from '../../providers/ktableProvider';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import * as vscode from 'vscode';

suite('KTable Provider Test Suite', () => {
    let provider: KTableProvider;
    let clientManager: any;
    let getTopicsStub: sinon.SinonStub;
    let getClustersStub: sinon.SinonStub;

    setup(() => {
        // Create stub instance which returns stub methods
        clientManager = sinon.createStubInstance(KafkaClientManager);
        provider = new KTableProvider(clientManager as any);
        
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

    suite('KTable Topic Filtering', () => {
        const clusterNode = new KTableTreeItem(
            'test-cluster',
            vscode.TreeItemCollapsibleState.Collapsed,
            'cluster',
            'test-cluster'
        );

        test('should filter and show topics ending with -changelog', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-store-changelog',
                'user-state-changelog',
                'regular-topic',
                'another-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'my-app-store-changelog');
            assert.strictEqual(children[0].contextValue, 'ktable');
            assert.strictEqual(children[1].label, 'user-state-changelog');
        });

        test('should filter and show topics with -ktable- pattern', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-ktable-materialized',
                'aggregation-ktable-store',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'my-app-ktable-materialized');
            assert.strictEqual(children[1].label, 'aggregation-ktable-store');
        });

        test('should filter and show topics with KTABLE pattern', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'KTABLE-AGGREGATE-001',
                'KTABLE-JOIN-002',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'KTABLE-AGGREGATE-001');
            assert.strictEqual(children[1].label, 'KTABLE-JOIN-002');
        });

        test('should filter and show topics with ktable (lowercase) pattern', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-ktable-topic',
                'another-ktable',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'my-ktable-topic');
            assert.strictEqual(children[1].label, 'another-ktable');
        });

        test('should filter and show topics with -store- pattern', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-store-internal',
                'state-store-topic',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'my-app-store-internal');
            assert.strictEqual(children[1].label, 'state-store-topic');
        });

        test('should filter and show topics with -state- pattern', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-app-state-store',
                'aggregation-state-topic',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].label, 'my-app-state-store');
            assert.strictEqual(children[1].label, 'aggregation-state-topic');
        });

        test('should exclude system topics starting with __', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                '__consumer_offsets',
                '__transaction_state',
                'my-table-changelog'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'my-table-changelog');
        });

        test('should show empty state when no ktable topics found', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'regular-topic-1',
                'regular-topic-2',
                'my-stream-topic',
                '__consumer_offsets'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No KTable topics found');
            assert.strictEqual(children[0].contextValue, 'empty');
        });

        test('should not show regular topics without table patterns', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'users',
                'orders',
                'payments',
                'inventory'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No KTable topics found');
        });

        test('should not show stream topics in ktable view', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'my-stream-input',
                'KSTREAM-FILTER-001',
                'app-repartition-topic',
                'my-changelog'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'my-changelog');
        });

        test('should handle mixed topic patterns correctly', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'app-store-changelog',          // Should show (changelog)
                'app-stream-input',             // Should exclude (stream)
                'KTABLE-AGGREGATE-001',        // Should show (KTABLE)
                'app-ktable-materialized',     // Should show (ktable)
                'regular-topic',               // Should exclude (no pattern)
                '__consumer_offsets',          // Should exclude (system)
                'state-store-topic',           // Should show (store)
                'my-ktable-join'               // Should show (ktable lowercase)
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 5);
            assert.strictEqual(children[0].label, 'app-store-changelog');
            assert.strictEqual(children[1].label, 'KTABLE-AGGREGATE-001');
            assert.strictEqual(children[2].label, 'app-ktable-materialized');
            assert.strictEqual(children[3].label, 'state-store-topic');
            assert.strictEqual(children[4].label, 'my-ktable-join');
        });

        test('should handle changelog topics with various prefixes', async () => {
            getTopicsStub.withArgs('test-cluster').resolves([
                'app-users-changelog',
                'orders-state-changelog',
                'payments-store-changelog',
                'regular-topic'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 3);
            assert.strictEqual(children[0].label, 'app-users-changelog');
            assert.strictEqual(children[1].label, 'orders-state-changelog');
            assert.strictEqual(children[2].label, 'payments-store-changelog');
        });
    });

    suite('KTable Tree Item', () => {
        test('should create ktable item with correct properties', () => {
            const item = new KTableTreeItem(
                'my-table-changelog',
                vscode.TreeItemCollapsibleState.None,
                'ktable',
                'test-cluster',
                'my-table-changelog'
            );

            assert.strictEqual(item.label, 'my-table-changelog');
            assert.strictEqual(item.contextValue, 'ktable');
            assert.strictEqual(item.clusterName, 'test-cluster');
            assert.strictEqual(item.topicName, 'my-table-changelog');
            assert.ok(item.command);
            assert.strictEqual(item.command?.command, 'kafka.showKTableDetails');
        });

        test('should have appropriate tooltip for ktable', () => {
            const item = new KTableTreeItem(
                'my-table-changelog',
                vscode.TreeItemCollapsibleState.None,
                'ktable',
                'test-cluster',
                'my-table-changelog'
            );

            const tooltip = typeof item.tooltip === 'string' ? item.tooltip : item.tooltip?.value || '';
            assert.ok(tooltip.includes('KTable Topic'));
            assert.ok(tooltip.includes('my-table-changelog'));
            assert.ok(tooltip.includes('test-cluster'));
            assert.ok(tooltip.includes('changelog or state store'));
        });

        test('should have appropriate tooltip for cluster', () => {
            const item = new KTableTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const tooltip = typeof item.tooltip === 'string' ? item.tooltip : item.tooltip?.value || '';
            assert.ok(tooltip.includes('Cluster: test-cluster'));
        });

        test('should have appropriate tooltip for empty state', () => {
            const item = new KTableTreeItem(
                'No KTable topics found',
                vscode.TreeItemCollapsibleState.None,
                'empty',
                'test-cluster'
            );

            const tooltip = typeof item.tooltip === 'string' ? item.tooltip : item.tooltip?.value || '';
            assert.ok(tooltip.includes('No KTable topics found'));
            assert.ok(tooltip.includes('changelog or state store patterns'));
        });

        test('should have purple table icon for ktable topics', () => {
            const item = new KTableTreeItem(
                'my-table-changelog',
                vscode.TreeItemCollapsibleState.None,
                'ktable',
                'test-cluster',
                'my-table-changelog'
            );

            assert.ok(item.iconPath);
            assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'table');
        });
    });

    suite('Error Handling', () => {
        test('should handle connection errors gracefully', async () => {
            const clusterNode = new KTableTreeItem(
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
            const clusterNode = new KTableTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            getTopicsStub.withArgs('test-cluster').resolves([]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No KTable topics found');
        });
    });

    suite('Integration Scenarios', () => {
        test('should handle real-world Kafka Streams application topology', async () => {
            const clusterNode = new KTableTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            // Simulating a typical Kafka Streams app with tables and streams
            getTopicsStub.withArgs('test-cluster').resolves([
                'users',                                    // Regular topic
                'orders',                                   // Regular topic
                'app-users-ktable-store-changelog',        // KTable changelog
                'app-orders-state-store',                  // KTable state store
                'app-aggregation-ktable-materialized',     // KTable materialized
                'app-stream-input',                        // KStream (should not show)
                'app-repartition-by-key',                  // Repartition (should not show)
                '__consumer_offsets'                       // System topic
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 3);
            assert.strictEqual(children[0].label, 'app-users-ktable-store-changelog');
            assert.strictEqual(children[1].label, 'app-orders-state-store');
            assert.strictEqual(children[2].label, 'app-aggregation-ktable-materialized');
        });

        test('should not show any topics when only streams and regular topics exist', async () => {
            const clusterNode = new KTableTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            getTopicsStub.withArgs('test-cluster').resolves([
                'users',
                'orders',
                'app-stream-input',
                'app-stream-output',
                'KSTREAM-FILTER-001'
            ]);

            const children = await provider.getChildren(clusterNode);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No KTable topics found');
        });
    });
});

