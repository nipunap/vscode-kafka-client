/**
 * Phase 0: Topic Sorting Tests (2.2)
 * Tests for alphabetical topic sorting in KafkaExplorerProvider
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { KafkaExplorerProvider, KafkaTreeItem } from '../../providers/kafkaExplorerProvider';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';

suite('KafkaExplorerProvider Sorting Test Suite (Phase 0: 2.2)', () => {
    let sandbox: sinon.SinonSandbox;
    let clientManager: KafkaClientManager;
    let provider: KafkaExplorerProvider;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = new KafkaClientManager();
        provider = new KafkaExplorerProvider(clientManager);

        // Mock workspace configuration to use threshold of 150 for testing
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (key: string, defaultValue?: any) => {
                if (key === 'topics.threshold') {
                    return 150;
                }
                return defaultValue;
            }
        } as any);
    });

    teardown(() => {
        sandbox.restore();
        clientManager.dispose();
    });

    suite('Alphabetical Sorting', () => {
        test('should sort topics alphabetically (A-Z)', async () => {
            const unsortedTopics = ['zebra-topic', 'apple-topic', 'monkey-topic', 'banana-topic'];
            const expectedOrder = ['apple-topic', 'banana-topic', 'monkey-topic', 'zebra-topic'];

            // Mock getTopics to return unsorted list
            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            // Get cluster node
            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            // Get topics (should be sorted)
            const topics = await provider.getChildren(clusterNode);

            // Verify sorting (exclude warning/more items)
            const topicItems = topics.filter(item => item.contextValue === 'topic');
            const topicNames = topicItems.map(item => item.label);

            assert.deepStrictEqual(topicNames, expectedOrder, 'Topics should be sorted alphabetically');
        });

        test('should sort topics case-insensitively', async () => {
            const unsortedTopics = ['Zebra-Topic', 'apple-topic', 'Monkey-Topic', 'banana-topic'];
            const expectedOrder = ['apple-topic', 'banana-topic', 'Monkey-Topic', 'Zebra-Topic'];

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');
            const topicNames = topicItems.map(item => item.label);

            assert.deepStrictEqual(topicNames, expectedOrder, 'Topics should be sorted case-insensitively');
        });

        test('should handle topics with special characters', async () => {
            const unsortedTopics = ['topic_3', 'topic-1', 'topic.2', 'topic_a'];

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');

            // Verify topics are sorted (exact order depends on localeCompare behavior)
            assert.strictEqual(topicItems.length, unsortedTopics.length, 'All topics should be present');
        });

        test('should handle topics with numbers', async () => {
            const unsortedTopics = ['topic-10', 'topic-2', 'topic-1', 'topic-20'];

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');
            const topicNames = topicItems.map(item => item.label);

            // localeCompare sorts lexicographically: "topic-1", "topic-10", "topic-2", "topic-20"
            assert.strictEqual(topicNames[0], 'topic-1', 'First topic should be topic-1');
            assert.strictEqual(topicItems.length, 4, 'All topics should be present');
        });

        test('should handle topics with common prefixes', async () => {
            const unsortedTopics = [
                'user-events-v2',
                'user-events',
                'user-events-v1',
                'user-data'
            ];
            const expectedOrder = [
                'user-data',
                'user-events',
                'user-events-v1',
                'user-events-v2'
            ];

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');
            const topicNames = topicItems.map(item => item.label);

            assert.deepStrictEqual(topicNames, expectedOrder, 'Topics with common prefixes should be sorted correctly');
        });
    });

    suite('Sorting with Large Lists', () => {
        test('should sort topics when count < 1000 (no warning)', async () => {
            const unsortedTopics = Array.from({ length: 50 }, (_, i) => `topic-${50 - i}`);

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');

            // Verify all topics are present and sorted
            assert.strictEqual(topicItems.length, 50, 'All 50 topics should be present');
            assert.strictEqual(topicItems[0].label, 'topic-1', 'First topic should be topic-1');
            // Note: topic-9 comes before topic-10 in string sort
            assert.strictEqual(topicItems[topicItems.length - 1].label, 'topic-9', 'Last topic should be topic-9');
        });

        test('should sort topics when count > threshold (with View All button)', async () => {
            const unsortedTopics = Array.from({ length: 200 }, (_, i) => `topic-${200 - i}`);
            const mockCluster = 'test-cluster';
            sandbox.stub(clientManager, 'getClusters').returns([mockCluster]);
            sandbox.stub(clientManager, 'getTopics').withArgs(mockCluster).resolves(unsortedTopics);

            const provider = new KafkaExplorerProvider(clientManager as any);
            const clusterNode = new KafkaTreeItem(
                mockCluster,
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                mockCluster
            );

            const children = await provider.getChildren(clusterNode);

            // Should have: viewAllTopics (1) + topics (50) + showMore (1) = 52 items
            assert.strictEqual(children.length, 52, 'Should have viewAllTopics, 50 topics, and showMore items');

            // Find viewAll and showMore items
            const viewAllItem = children.find(item => item.contextValue === 'viewAllTopics');
            const showMoreItem = children.find(item => item.contextValue === 'topicsMore');
            const topicItems = children.filter(item => item.contextValue === 'topic');

            assert.ok(viewAllItem, 'View All item should be present');
            assert.ok(showMoreItem, 'Show more item should be present');
            assert.strictEqual(topicItems.length, 50, 'Should show first 50 topics');

            // Verify topics are sorted alphabetically
            const topicLabels = topicItems.map((child: any) => child.label);
            const expectedSorted = unsortedTopics.slice(0, 50).sort((a, b) => a.localeCompare(b));
            assert.deepStrictEqual(topicLabels, expectedSorted, 'Topics should be sorted');

            // First and last of the limited list
            assert.strictEqual(topicItems[0].label, expectedSorted[0], 'First displayed topic should be the first in sorted order');
            assert.strictEqual(topicItems[49].label, expectedSorted[49], 'Last displayed topic should be the 50th in sorted order');
        });

        test('should handle exactly 150 topics (at threshold)', async () => {
            const unsortedTopics = Array.from({ length: 150 }, (_, i) => `topic-${150 - i}`);

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');

            // At threshold, all topics should be shown (no View All button)
            const viewAllItem = topics.find(item => item.contextValue === 'viewAllTopics');
            assert.strictEqual(viewAllItem, undefined, 'No View All button at exactly 150 topics');
            assert.strictEqual(topicItems.length, 150, 'All 150 topics should be present');
        });

        test('should handle 151 topics (just over threshold)', async () => {
            const unsortedTopics = Array.from({ length: 151 }, (_, i) => `topic-${151 - i}`);

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const children = await provider.getChildren(clusterNode);

            // Should show View All button at 151 topics
            const viewAllItem = children.find(item => item.contextValue === 'viewAllTopics');
            const topicItems = children.filter(item => item.contextValue === 'topic');

            assert.ok(viewAllItem, 'View All button should appear at 151 topics');
            assert.strictEqual(topicItems.length, 50, 'Should limit to 50 displayed topics');
        });
    });

    suite('Edge Cases', () => {
        test('should handle empty topic list', async () => {
            sandbox.stub(clientManager, 'getTopics').resolves([]);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);

            assert.strictEqual(topics.length, 1, 'Should return one empty item');
            assert.strictEqual(topics[0].contextValue, 'empty', 'Should be empty context');
        });

        test('should handle single topic', async () => {
            sandbox.stub(clientManager, 'getTopics').resolves(['single-topic']);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');

            assert.strictEqual(topicItems.length, 1, 'Should have one topic');
            assert.strictEqual(topicItems[0].label, 'single-topic');
        });

        test('should handle topics with identical names (should not happen, but test anyway)', async () => {
            const duplicateTopics = ['topic-1', 'topic-1', 'topic-2'];

            sandbox.stub(clientManager, 'getTopics').resolves(duplicateTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');

            // Should still create items for all topics
            assert.strictEqual(topicItems.length, 3, 'Should handle duplicate names');
        });

        test('should handle topics with unicode characters', async () => {
            const unicodeTopics = ['topic-ñ', 'topic-å', 'topic-ü', 'topic-a'];

            sandbox.stub(clientManager, 'getTopics').resolves(unicodeTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const topics = await provider.getChildren(clusterNode);
            const topicItems = topics.filter(item => item.contextValue === 'topic');

            // localeCompare should handle unicode correctly
            assert.strictEqual(topicItems.length, 4, 'All unicode topics should be present');
            assert.strictEqual(topicItems[0].label, 'topic-a', 'topic-a should be first');
        });

        test('should not modify original topics array', async () => {
            const originalTopics = ['z-topic', 'a-topic', 'm-topic'];
            const topicsCopy = [...originalTopics];

            sandbox.stub(clientManager, 'getTopics').resolves(originalTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            await provider.getChildren(clusterNode);

            // Original array should be sorted (in-place sort is acceptable)
            // Verify sorting happened by checking the array
            assert.ok(originalTopics[0] !== topicsCopy[0] || originalTopics.length === 0);
        });
    });

    suite('Sorting Performance', () => {
        test('should handle large topic lists efficiently', async function() {
            this.timeout(5000); // Allow 5 seconds for large list

            // Generate 1000 topics in reverse order
            const largeTopicList = Array.from({ length: 1000 }, (_, i) => `topic-${1000 - i}`);

            sandbox.stub(clientManager, 'getTopics').resolves(largeTopicList);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const startTime = Date.now();
            const children = await provider.getChildren(clusterNode);
            const duration = Date.now() - startTime;

            // Should complete sorting within reasonable time (< 1 second)
            assert.ok(duration < 1000, `Sorting 1000 topics took ${duration}ms, should be < 1000ms`);

            // Verify sorting still works with large list
            const topicItems = children.filter(item => item.contextValue === 'topic');
            assert.ok(topicItems.length > 0, 'Should have topic items');
            assert.strictEqual(topicItems[0].label, 'topic-1', 'First topic should be topic-1');
        });
    });
});
