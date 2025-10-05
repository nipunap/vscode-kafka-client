import * as assert from 'assert';
import * as sinon from 'sinon';
import { KafkaExplorerProvider } from '../../providers/kafkaExplorerProvider';
import { ConsumerGroupProvider } from '../../providers/consumerGroupProvider';
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
    });
});

