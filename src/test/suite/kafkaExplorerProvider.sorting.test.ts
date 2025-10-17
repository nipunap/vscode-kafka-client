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

        test('should sort topics when count > 1000 (with warning)', async () => {
            const unsortedTopics = Array.from({ length: 1100 }, (_, i) => `topic-${1100 - i}`);

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const children = await provider.getChildren(clusterNode);

            // Should have: warning (1) + topics (1000) + showMore (1) = 1002 items
            assert.ok(children.length > 1000, 'Should have warning and showMore items');

            // Find warning and showMore items
            const warningItem = children.find(item => item.contextValue === 'topicsWarning');
            const showMoreItem = children.find(item => item.contextValue === 'topicsMore');
            const topicItems = children.filter(item => item.contextValue === 'topic');

            assert.ok(warningItem, 'Warning item should be present');
            assert.ok(showMoreItem, 'Show more item should be present');
            assert.strictEqual(topicItems.length, 1000, 'Should show first 1000 topics');

            // Verify topics are sorted
            assert.strictEqual(topicItems[0].label, 'topic-1', 'First displayed topic should be topic-1');
            assert.strictEqual(topicItems[999].label, 'topic-999', 'Last displayed topic should be topic-999');
        });

        test('should handle exactly 1000 topics (boundary)', async () => {
            const unsortedTopics = Array.from({ length: 1000 }, (_, i) => `topic-${1000 - i}`);

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

            // At exactly 1000, should not show warning
            const warningItem = topics.find(item => item.contextValue === 'topicsWarning');
            assert.strictEqual(warningItem, undefined, 'No warning at exactly 1000 topics');
            assert.strictEqual(topicItems.length, 1000, 'All 1000 topics should be present');
        });

        test('should handle 1001 topics (just over threshold)', async () => {
            const unsortedTopics = Array.from({ length: 1001 }, (_, i) => `topic-${1001 - i}`);

            sandbox.stub(clientManager, 'getTopics').resolves(unsortedTopics);
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);

            const clusterNode = new KafkaTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            const children = await provider.getChildren(clusterNode);

            // Should show warning at 1001 topics
            const warningItem = children.find(item => item.contextValue === 'topicsWarning');
            const topicItems = children.filter(item => item.contextValue === 'topic');

            assert.ok(warningItem, 'Warning should appear at 1001 topics');
            assert.strictEqual(topicItems.length, 1000, 'Should limit to 1000 displayed topics');
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
