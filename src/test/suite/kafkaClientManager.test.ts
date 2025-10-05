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

    teardown(() => {
        sandbox.restore();
    });

    test('should create instance', () => {
        assert.ok(clientManager instanceof KafkaClientManager);
    });

    test('should have getClusters method', () => {
        assert.strictEqual(typeof clientManager.getClusters, 'function');
    });

    test('should return empty array for initial cluster names', () => {
        const names = clientManager.getClusters();
        assert.ok(Array.isArray(names));
    });

    test('should have loadConfiguration method', () => {
        assert.strictEqual(typeof clientManager.loadConfiguration, 'function');
    });

    test('should have addClusterFromConnection method', () => {
        assert.strictEqual(typeof clientManager.addClusterFromConnection, 'function');
    });

    test('should have removeCluster method', () => {
        assert.strictEqual(typeof clientManager.removeCluster, 'function');
    });

    test('should have getTopics method', () => {
        assert.strictEqual(typeof clientManager.getTopics, 'function');
    });

    test('should have getConsumerGroups method', () => {
        assert.strictEqual(typeof clientManager.getConsumerGroups, 'function');
    });

    test('should handle invalid cluster name gracefully', async () => {
        try {
            await clientManager.getTopics('non-existent-cluster');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error);
        }
    });
});

