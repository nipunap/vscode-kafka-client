import * as assert from 'assert';
import * as sinon from 'sinon';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import { Admin } from 'kafkajs';

suite('KafkaClientManager.resetConsumerGroupOffsets Integration Tests', () => {
    let manager: KafkaClientManager;
    let mockAdmin: sinon.SinonStubbedInstance<Admin>;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        manager = new KafkaClientManager();
        mockAdmin = {
            fetchOffsets: sandbox.stub(),
            fetchTopicOffsets: sandbox.stub(),
            resetOffsets: sandbox.stub()
        } as any;

        // Bypass getAdmin (private) to inject our mock
        sandbox.stub(manager as any, 'getAdmin').resolves(mockAdmin);
    });

    teardown(() => {
        sandbox.restore();
    });

    // --- Topic filtering ---

    suite('Topic filtering from fetchOffsets', () => {
        test('should drop entries with undefined topic and continue with valid ones', async () => {
            (mockAdmin.fetchOffsets as sinon.SinonStub).resolves([
                { topic: 'valid-topic', partition: 0 },
                { topic: undefined, partition: 1 }
            ]);
            (mockAdmin.fetchTopicOffsets as sinon.SinonStub).resolves([
                { partition: 0, low: '0', high: '100' }
            ]);
            (mockAdmin.resetOffsets as sinon.SinonStub).resolves();

            await manager.resetConsumerGroupOffsets('cluster', 'group1');

            assert.strictEqual((mockAdmin.fetchTopicOffsets as sinon.SinonStub).callCount, 1);
            assert.strictEqual((mockAdmin.fetchTopicOffsets as sinon.SinonStub).firstCall.args[0], 'valid-topic');
            assert.ok((mockAdmin.resetOffsets as sinon.SinonStub).calledOnce);
        });

        test('should drop entries with null topic and continue with valid ones', async () => {
            (mockAdmin.fetchOffsets as sinon.SinonStub).resolves([
                { topic: 'my-topic', partition: 0 },
                { topic: null, partition: 1 }
            ]);
            (mockAdmin.fetchTopicOffsets as sinon.SinonStub).resolves([
                { partition: 0, low: '5', high: '50' }
            ]);
            (mockAdmin.resetOffsets as sinon.SinonStub).resolves();

            await manager.resetConsumerGroupOffsets('cluster', 'group1');

            assert.strictEqual((mockAdmin.fetchTopicOffsets as sinon.SinonStub).firstCall.args[0], 'my-topic');
        });

        test('should throw when all topics are filtered out', async () => {
            (mockAdmin.fetchOffsets as sinon.SinonStub).resolves([
                { topic: undefined, partition: 0 },
                { topic: null, partition: 1 }
            ]);

            await assert.rejects(
                () => manager.resetConsumerGroupOffsets('cluster', 'group1'),
                /has no committed topic offsets to reset/
            );
            assert.ok((mockAdmin.resetOffsets as sinon.SinonStub).notCalled);
        });

        test('should throw when fetchOffsets returns an empty array', async () => {
            (mockAdmin.fetchOffsets as sinon.SinonStub).resolves([]);

            await assert.rejects(
                () => manager.resetConsumerGroupOffsets('cluster', 'group1'),
                /has no committed topic offsets to reset/
            );
            assert.ok((mockAdmin.resetOffsets as sinon.SinonStub).notCalled);
        });
    });

    // --- Partition bounds validation ---

    suite('Partition bounds validation', () => {
        setup(() => {
            (mockAdmin.fetchOffsets as sinon.SinonStub).resolves([
                { topic: 'test-topic', partition: 0 }
            ]);
        });

        test('should throw when p.low is null', async () => {
            (mockAdmin.fetchTopicOffsets as sinon.SinonStub).resolves([
                { partition: 0, low: null, high: '100' }
            ]);

            await assert.rejects(
                () => manager.resetConsumerGroupOffsets('cluster', 'group1', undefined, 'beginning'),
                /Missing offset bounds for partition 0 on topic "test-topic"/
            );
        });

        test('should throw when p.high is undefined', async () => {
            (mockAdmin.fetchTopicOffsets as sinon.SinonStub).resolves([
                { partition: 0, low: '0', high: undefined }
            ]);

            await assert.rejects(
                () => manager.resetConsumerGroupOffsets('cluster', 'group1', undefined, 'end'),
                /Missing offset bounds for partition 0 on topic "test-topic"/
            );
        });
    });

    // --- Specific offset validation ---

    suite('Specific offset validation', () => {
        test('should reject a negative specific offset', async () => {
            await assert.rejects(
                () => manager.resetConsumerGroupOffsets('cluster', 'group1', 'topic', 'specific offset', '-1'),
                /Invalid offset value/
            );
            assert.ok((mockAdmin.fetchOffsets as sinon.SinonStub).notCalled);
        });

        test('should reject a non-numeric specific offset', async () => {
            await assert.rejects(
                () => manager.resetConsumerGroupOffsets('cluster', 'group1', 'topic', 'specific offset', 'abc'),
                /Invalid offset value/
            );
        });

        test('should reject a missing specific offset when strategy is "specific offset"', async () => {
            await assert.rejects(
                () => manager.resetConsumerGroupOffsets('cluster', 'group1', 'topic', 'specific offset', undefined),
                /Invalid offset value/
            );
        });

        test('should accept a valid specific offset and pass it to resetOffsets', async () => {
            (mockAdmin.fetchTopicOffsets as sinon.SinonStub).resolves([
                { partition: 0, low: '0', high: '200' }
            ]);
            (mockAdmin.resetOffsets as sinon.SinonStub).resolves();

            await manager.resetConsumerGroupOffsets('cluster', 'group1', 'topic', 'specific offset', '42');

            const resetCall = (mockAdmin.resetOffsets as sinon.SinonStub).firstCall.args[0];
            assert.strictEqual(resetCall.topics[0].partitions[0].offset, '42');
        });
    });

    // --- Happy path ---

    suite('Happy path', () => {
        test('should reset multiple topics and partitions to beginning', async () => {
            (mockAdmin.fetchOffsets as sinon.SinonStub).resolves([
                { topic: 'topic-a', partition: 0 },
                { topic: 'topic-b', partition: 0 }
            ]);
            (mockAdmin.fetchTopicOffsets as sinon.SinonStub)
                .withArgs('topic-a').resolves([
                    { partition: 0, low: '10', high: '100' },
                    { partition: 1, low: '5', high: '50' }
                ])
                .withArgs('topic-b').resolves([
                    { partition: 0, low: '0', high: '200' }
                ]);
            (mockAdmin.resetOffsets as sinon.SinonStub).resolves();

            await manager.resetConsumerGroupOffsets('cluster', 'group1', undefined, 'beginning');

            assert.ok((mockAdmin.resetOffsets as sinon.SinonStub).calledOnce);
            const spec = (mockAdmin.resetOffsets as sinon.SinonStub).firstCall.args[0];
            assert.strictEqual(spec.groupId, 'group1');
            assert.strictEqual(spec.topics.length, 2);

            const topicA = spec.topics.find((t: any) => t.topic === 'topic-a');
            assert.strictEqual(topicA.partitions[0].offset, '10'); // low
            assert.strictEqual(topicA.partitions[1].offset, '5');  // low

            const topicB = spec.topics.find((t: any) => t.topic === 'topic-b');
            assert.strictEqual(topicB.partitions[0].offset, '0'); // low
        });

        test('should reset to end (high watermark)', async () => {
            (mockAdmin.fetchOffsets as sinon.SinonStub).resolves([
                { topic: 'topic-a', partition: 0 }
            ]);
            (mockAdmin.fetchTopicOffsets as sinon.SinonStub).resolves([
                { partition: 0, low: '0', high: '999' }
            ]);
            (mockAdmin.resetOffsets as sinon.SinonStub).resolves();

            await manager.resetConsumerGroupOffsets('cluster', 'group1', undefined, 'end');

            const spec = (mockAdmin.resetOffsets as sinon.SinonStub).firstCall.args[0];
            assert.strictEqual(spec.topics[0].partitions[0].offset, '999');
        });

        test('should use specific topic when provided (skipping fetchOffsets)', async () => {
            (mockAdmin.fetchTopicOffsets as sinon.SinonStub).resolves([
                { partition: 0, low: '0', high: '50' }
            ]);
            (mockAdmin.resetOffsets as sinon.SinonStub).resolves();

            await manager.resetConsumerGroupOffsets('cluster', 'group1', 'explicit-topic', 'beginning');

            assert.ok((mockAdmin.fetchOffsets as sinon.SinonStub).notCalled);
            const spec = (mockAdmin.resetOffsets as sinon.SinonStub).firstCall.args[0];
            assert.strictEqual(spec.topics[0].topic, 'explicit-topic');
        });
    });
});
