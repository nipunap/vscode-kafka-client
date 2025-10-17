/**
 * Phase 0: Search Focus Tests (2.3)
 * Tests for TreeView.reveal() functionality in findTopic command
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { findTopic } from '../../commands/topicCommands';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import { KafkaExplorerProvider, KafkaTreeItem } from '../../providers/kafkaExplorerProvider';

suite('Topic Search Focus Test Suite (Phase 0: 2.3)', () => {
    let sandbox: sinon.SinonSandbox;
    let clientManager: KafkaClientManager;
    let provider: KafkaExplorerProvider;
    let mockTreeView: vscode.TreeView<KafkaTreeItem>;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = new KafkaClientManager();
        provider = new KafkaExplorerProvider(clientManager);

        // Create mock TreeView with reveal method
        mockTreeView = {
            reveal: sandbox.stub().resolves(),
            onDidChangeVisibility: new vscode.EventEmitter<vscode.TreeViewVisibilityChangeEvent>().event,
            onDidChangeSelection: new vscode.EventEmitter<vscode.TreeViewSelectionChangeEvent<KafkaTreeItem>>().event,
            onDidExpandElement: new vscode.EventEmitter<vscode.TreeViewExpansionEvent<KafkaTreeItem>>().event,
            onDidCollapseElement: new vscode.EventEmitter<vscode.TreeViewExpansionEvent<KafkaTreeItem>>().event,
            selection: [],
            visible: true,
            badge: undefined,
            title: undefined,
            description: undefined,
            message: undefined,
            dispose: () => {}
        } as any;
    });

    teardown(() => {
        sandbox.restore();
        clientManager.dispose();
    });

    suite('TreeView Reveal Functionality', () => {
        test('should call reveal() with correct options when topic is found', async () => {
            const testCluster = 'test-cluster';
            const testTopic = 'test-topic';

            // Mock cluster and topic data
            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            // Mock user selections
            sandbox.stub(vscode.window, 'showQuickPick')
                .onFirstCall().resolves({ label: testTopic, description: `Cluster: ${testCluster}` } as any);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            // Mock provider.getChildren to return cluster and topic nodes
            const clusterNode = new KafkaTreeItem(
                testCluster,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                testCluster
            );
            const topicNode = new KafkaTreeItem(
                testTopic,
                vscode.TreeItemCollapsibleState.Collapsed,
                'topic',
                testCluster,
                testTopic
            );

            sandbox.stub(provider, 'getChildren')
                .onFirstCall().resolves([clusterNode])
                .onSecondCall().resolves([topicNode]);

            // Execute findTopic
            await findTopic(clientManager, mockTreeView, provider);

            // Verify reveal was called with correct options
            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.calledOnce, 'reveal() should be called once');

            const [node, options] = revealStub.firstCall.args;
            assert.strictEqual(node.label, testTopic, 'Should reveal the correct topic node');
            assert.strictEqual(options.select, true, 'select option should be true');
            assert.strictEqual(options.focus, true, 'focus option should be true');
            assert.strictEqual(options.expand, true, 'expand option should be true');
        });

        test('should handle reveal when cluster node is not found', async () => {
            const testCluster = 'test-cluster';
            const testTopic = 'test-topic';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            sandbox.stub(vscode.window, 'showQuickPick')
                .resolves({ label: testTopic, description: `Cluster: ${testCluster}` } as any);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            // Mock provider to return empty cluster list
            sandbox.stub(provider, 'getChildren').resolves([]);

            // Should not throw even if reveal fails
            await assert.doesNotReject(async () => {
                await findTopic(clientManager, mockTreeView, provider);
            });

            // reveal should not be called when cluster node is not found
            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.notCalled, 'reveal() should not be called if cluster not found');
        });

        test('should handle reveal when topic node is not found', async () => {
            const testCluster = 'test-cluster';
            const testTopic = 'test-topic';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            sandbox.stub(vscode.window, 'showQuickPick')
                .resolves({ label: testTopic, description: `Cluster: ${testCluster}` } as any);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            const clusterNode = new KafkaTreeItem(
                testCluster,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                testCluster
            );

            // Mock provider to return cluster but no topics
            sandbox.stub(provider, 'getChildren')
                .onFirstCall().resolves([clusterNode])
                .onSecondCall().resolves([]);

            // Should not throw even if topic not found
            await assert.doesNotReject(async () => {
                await findTopic(clientManager, mockTreeView, provider);
            });

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.notCalled, 'reveal() should not be called if topic not found');
        });

        test('should handle reveal errors gracefully', async () => {
            const testCluster = 'test-cluster';
            const testTopic = 'test-topic';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            sandbox.stub(vscode.window, 'showQuickPick')
                .resolves({ label: testTopic, description: `Cluster: ${testCluster}` } as any);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            const clusterNode = new KafkaTreeItem(
                testCluster,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                testCluster
            );
            const topicNode = new KafkaTreeItem(
                testTopic,
                vscode.TreeItemCollapsibleState.Collapsed,
                'topic',
                testCluster,
                testTopic
            );

            sandbox.stub(provider, 'getChildren')
                .onFirstCall().resolves([clusterNode])
                .onSecondCall().resolves([topicNode]);

            // Mock reveal to throw error
            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            revealStub.rejects(new Error('Reveal failed'));

            // Should not throw even if reveal fails
            await assert.doesNotReject(async () => {
                await findTopic(clientManager, mockTreeView, provider);
            });
        });
    });

    suite('Find Topic with Multiple Clusters', () => {
        test('should find topic in correct cluster with multiple clusters', async () => {
            const cluster1 = 'cluster-1';
            const cluster2 = 'cluster-2';
            const testTopic = 'test-topic';

            sandbox.stub(clientManager, 'getClusters').returns([cluster1, cluster2]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            // User selects cluster2 and then a topic
            sandbox.stub(vscode.window, 'showQuickPick')
                .onFirstCall().resolves(cluster2 as any) // Select cluster
                .onSecondCall().resolves({ label: testTopic, description: `Cluster: ${cluster2}` } as any); // Select topic

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            const clusterNode2 = new KafkaTreeItem(
                cluster2,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                cluster2
            );
            const topicNode = new KafkaTreeItem(
                testTopic,
                vscode.TreeItemCollapsibleState.Collapsed,
                'topic',
                cluster2,
                testTopic
            );

            // Mock provider to find the correct cluster
            sandbox.stub(provider, 'getChildren')
                .onFirstCall().resolves([
                    new KafkaTreeItem(cluster1, vscode.TreeItemCollapsibleState.Collapsed, 'cluster', cluster1),
                    clusterNode2
                ])
                .onSecondCall().resolves([topicNode]);

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.calledOnce, 'reveal() should be called');

            const [node] = revealStub.firstCall.args;
            assert.strictEqual(node.clusterName, cluster2, 'Should reveal topic from correct cluster');
        });

        test('should skip cluster selection with single cluster', async () => {
            const testCluster = 'single-cluster';
            const testTopic = 'test-topic';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            const quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');

            // Only one showQuickPick for topic selection (no cluster selection)
            quickPickStub.resolves({ label: testTopic, description: `Cluster: ${testCluster}` } as any);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            const clusterNode = new KafkaTreeItem(
                testCluster,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                testCluster
            );
            const topicNode = new KafkaTreeItem(
                testTopic,
                vscode.TreeItemCollapsibleState.Collapsed,
                'topic',
                testCluster,
                testTopic
            );

            sandbox.stub(provider, 'getChildren')
                .onFirstCall().resolves([clusterNode])
                .onSecondCall().resolves([topicNode]);

            await findTopic(clientManager, mockTreeView, provider);

            // Should only call showQuickPick once (for topic, not cluster)
            assert.strictEqual(quickPickStub.callCount, 1, 'Should only show topic picker with single cluster');
        });
    });

    suite('Edge Cases', () => {
        test('should handle no clusters configured', async () => {
            sandbox.stub(clientManager, 'getClusters').returns([]);
            sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.notCalled, 'reveal() should not be called with no clusters');
        });

        test('should handle no topics in cluster', async () => {
            const testCluster = 'empty-cluster';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([]);

            sandbox.stub(vscode.window, 'showInformationMessage').resolves();
            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.notCalled, 'reveal() should not be called with no topics');
        });

        test('should handle user cancels cluster selection', async () => {
            sandbox.stub(clientManager, 'getClusters').returns(['cluster-1', 'cluster-2']);

            // User cancels cluster selection
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.notCalled, 'reveal() should not be called when user cancels');
        });

        test('should handle user cancels topic selection', async () => {
            const testCluster = 'test-cluster';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves(['topic-1', 'topic-2']);

            // User cancels topic selection
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.notCalled, 'reveal() should not be called when user cancels topic selection');
        });

        test('should handle cancellation during topic loading', async () => {
            const testCluster = 'test-cluster';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves(['topic-1']);

            // Simulate cancellation
            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: true });
            });

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            assert.ok(revealStub.notCalled, 'reveal() should not be called when operation is cancelled');
        });
    });

    suite('Reveal Options Verification', () => {
        test('should use select: true in reveal options', async () => {
            const testCluster = 'test-cluster';
            const testTopic = 'test-topic';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            sandbox.stub(vscode.window, 'showQuickPick')
                .resolves({ label: testTopic, description: `Cluster: ${testCluster}` } as any);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            const clusterNode = new KafkaTreeItem(testCluster, vscode.TreeItemCollapsibleState.Collapsed, 'cluster', testCluster);
            const topicNode = new KafkaTreeItem(testTopic, vscode.TreeItemCollapsibleState.Collapsed, 'topic', testCluster, testTopic);

            sandbox.stub(provider, 'getChildren')
                .onFirstCall().resolves([clusterNode])
                .onSecondCall().resolves([topicNode]);

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            const [, options] = revealStub.firstCall.args;
            assert.strictEqual(options.select, true, 'Topic node should be selected');
        });

        test('should use focus: true in reveal options', async () => {
            const testCluster = 'test-cluster';
            const testTopic = 'test-topic';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            sandbox.stub(vscode.window, 'showQuickPick')
                .resolves({ label: testTopic, description: `Cluster: ${testCluster}` } as any);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            const clusterNode = new KafkaTreeItem(testCluster, vscode.TreeItemCollapsibleState.Collapsed, 'cluster', testCluster);
            const topicNode = new KafkaTreeItem(testTopic, vscode.TreeItemCollapsibleState.Collapsed, 'topic', testCluster, testTopic);

            sandbox.stub(provider, 'getChildren')
                .onFirstCall().resolves([clusterNode])
                .onSecondCall().resolves([topicNode]);

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            const [, options] = revealStub.firstCall.args;
            assert.strictEqual(options.focus, true, 'Tree view should focus on topic node');
        });

        test('should use expand: true in reveal options', async () => {
            const testCluster = 'test-cluster';
            const testTopic = 'test-topic';

            sandbox.stub(clientManager, 'getClusters').returns([testCluster]);
            sandbox.stub(clientManager, 'getTopics').resolves([testTopic]);

            sandbox.stub(vscode.window, 'showQuickPick')
                .resolves({ label: testTopic, description: `Cluster: ${testCluster}` } as any);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, callback: any) => {
                return await callback({}, { isCancellationRequested: false });
            });

            const clusterNode = new KafkaTreeItem(testCluster, vscode.TreeItemCollapsibleState.Collapsed, 'cluster', testCluster);
            const topicNode = new KafkaTreeItem(testTopic, vscode.TreeItemCollapsibleState.Collapsed, 'topic', testCluster, testTopic);

            sandbox.stub(provider, 'getChildren')
                .onFirstCall().resolves([clusterNode])
                .onSecondCall().resolves([topicNode]);

            await findTopic(clientManager, mockTreeView, provider);

            const revealStub = mockTreeView.reveal as sinon.SinonStub;
            const [, options] = revealStub.firstCall.args;
            assert.strictEqual(options.expand, true, 'Topic node should be expanded');
        });
    });
});
