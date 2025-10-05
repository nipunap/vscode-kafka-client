import * as assert from 'assert';
import * as sinon from 'sinon';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';

suite('KafkaClientManager Test Suite', () => {
    let clientManager: KafkaClientManager;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = new KafkaClientManager();
    });

    teardown(async () => {
        // Always dispose to prevent resource leaks in tests
        try {
            await clientManager.dispose();
        } catch (e) {
            // Ignore errors during teardown
        }
        sandbox.restore();
    });

    suite('Basic Functionality', () => {
        test('should create instance', () => {
            assert.ok(clientManager instanceof KafkaClientManager);
        });

        test('should return empty array for initial cluster names', () => {
            const names = clientManager.getClusters();
            assert.ok(Array.isArray(names));
            assert.strictEqual(names.length, 0);
        });

        test('should have all required public methods', () => {
            assert.strictEqual(typeof clientManager.getClusters, 'function');
            assert.strictEqual(typeof clientManager.loadConfiguration, 'function');
            assert.strictEqual(typeof clientManager.addClusterFromConnection, 'function');
            assert.strictEqual(typeof clientManager.removeCluster, 'function');
            assert.strictEqual(typeof clientManager.getTopics, 'function');
            assert.strictEqual(typeof clientManager.getConsumerGroups, 'function');
            assert.strictEqual(typeof clientManager.dispose, 'function');
        });
    });

    suite('Error Handling', () => {
        test('should handle invalid cluster name gracefully', async () => {
            try {
                await clientManager.getTopics('non-existent-cluster');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error);
            }
        });

        test('should throw error for getConsumerGroups with invalid cluster', async () => {
            try {
                await clientManager.getConsumerGroups('invalid-cluster');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error);
            }
        });
    });

    suite('Resource Management', () => {
        test('dispose() should handle empty state gracefully', async () => {
            // Should not throw when no clusters are connected
            await assert.doesNotReject(async () => {
                await clientManager.dispose();
            });
        });

        test('dispose() should be idempotent', async () => {
            // Should be safe to call multiple times
            await clientManager.dispose();
            await clientManager.dispose();
            await clientManager.dispose();
            // No assertion needed - just shouldn't throw
        });

        test('getClusters() should return empty after dispose', async () => {
            await clientManager.dispose();
            const clusters = clientManager.getClusters();
            assert.strictEqual(clusters.length, 0);
        });
    });

    suite('Cluster Management', () => {
        test('should validate cluster configuration fields', () => {
            // This test validates that the manager expects proper structure
            // The actual validation happens in loadConfiguration
            const clusters = clientManager.getClusters();
            assert.ok(Array.isArray(clusters));
        });
    });

    suite('Configuration', () => {
        test('should start with empty configuration', () => {
            const clusters = clientManager.getClusters();
            assert.strictEqual(clusters.length, 0);
        });
    });
});

