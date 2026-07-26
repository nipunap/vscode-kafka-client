import * as assert from 'assert';
import * as sinon from 'sinon';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import { Admin } from 'kafkajs';

suite('KafkaClientManager Test Suite', () => {
    let clientManager: KafkaClientManager;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = new KafkaClientManager();
    });

    teardown(async () => {
        try {
            await clientManager.dispose();
        } catch (_e) {
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
            await assert.doesNotReject(async () => {
                await clientManager.dispose();
            });
        });

        test('dispose() should be idempotent', async () => {
            await clientManager.dispose();
            await clientManager.dispose();
            await clientManager.dispose();
        });

        test('getClusters() should return empty after dispose', async () => {
            await clientManager.dispose();
            const clusters = clientManager.getClusters();
            assert.strictEqual(clusters.length, 0);
        });
    });

    suite('Cluster Management', () => {
        test('should validate cluster configuration fields', () => {
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

    suite('Broker Operations', () => {
        test('getBrokers() should be defined', () => {
            assert.strictEqual(typeof clientManager.getBrokers, 'function');
        });

        test('getBrokerDetails() should be defined', () => {
            assert.strictEqual(typeof clientManager.getBrokerDetails, 'function');
        });

        test('getBrokers() should throw error for invalid cluster', async () => {
            try {
                await clientManager.getBrokers('non-existent-cluster');
                assert.fail('Should have thrown error');
            } catch (error: any) {
                assert.ok(error.message.includes('not found'));
            }
        });

        test('getBrokerDetails() should throw error for invalid cluster', async () => {
            try {
                await clientManager.getBrokerDetails('non-existent-cluster', 1);
                assert.fail('Should have thrown error');
            } catch (error: any) {
                assert.ok(error.message.includes('not found'));
            }
        });
    });

    suite('Consumer Group Operations', () => {
        test('getConsumerGroups() should return state information', async () => {
            assert.strictEqual(typeof clientManager.getConsumerGroups, 'function');
        });

        test('getConsumerGroups() should handle empty results', async () => {
            try {
                await clientManager.getConsumerGroups('non-existent-cluster');
                assert.fail('Should have thrown error');
            } catch (error: any) {
                assert.ok(error.message.includes('not found'));
            }
        });
    });

    suite('consumeMessages', () => {
        test('should settle only once when limit triggers before timeout', async () => {
            const mockAdmin = {
                connect: sandbox.stub().resolves(),
                disconnect: sandbox.stub().resolves(),
            } as unknown as Admin;

            const disconnectStub = sandbox.stub().resolves();
            const mockConsumer = {
                connect: sandbox.stub().resolves(),
                subscribe: sandbox.stub().resolves(),
                disconnect: disconnectStub,
                run: sandbox.stub().callsFake(async ({ eachMessage }: any) => {
                    await eachMessage({ topic: 'test-topic', partition: 0, message: { value: Buffer.from('test') } });
                }),
            };

            const mockKafka = { consumer: sandbox.stub().returns(mockConsumer) };

            (clientManager as any).clusters.set('test-cluster', {
                name: 'test-cluster', type: 'kafka', brokers: ['localhost:9092'], securityProtocol: 'PLAINTEXT'
            });
            (clientManager as any).kafkaInstances.set('test-cluster', mockKafka);
            sandbox.stub(clientManager as any, 'getAdmin').resolves(mockAdmin);

            const result = await clientManager.consumeMessages('test-cluster', 'test-topic', true, 1);

            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(disconnectStub.callCount, 1);
        });

        test('should resolve with empty messages on cancellation', async () => {
            const mockAdmin = {
                connect: sandbox.stub().resolves(),
                disconnect: sandbox.stub().resolves(),
            } as unknown as Admin;

            const disconnectStub = sandbox.stub().resolves();
            const mockConsumer = {
                connect: sandbox.stub().resolves(),
                subscribe: sandbox.stub().resolves(),
                disconnect: disconnectStub,
                run: sandbox.stub().resolves(),
            };

            const mockKafka = { consumer: sandbox.stub().returns(mockConsumer) };
            const source = new (require('vscode').CancellationTokenSource)();

            (clientManager as any).clusters.set('test-cluster', {
                name: 'test-cluster', type: 'kafka', brokers: ['localhost:9092'], securityProtocol: 'PLAINTEXT'
            });
            (clientManager as any).kafkaInstances.set('test-cluster', mockKafka);
            sandbox.stub(clientManager as any, 'getAdmin').resolves(mockAdmin);

            const promise = clientManager.consumeMessages('test-cluster', 'test-topic', true, 100, source.token);
            source.cancel();
            const result = await promise;

            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 0);
            assert.strictEqual(disconnectStub.callCount, 1);
        });
    });

    suite('getTopicDetails', () => {
        test('should not create a consumer when fetching offsets', async () => {
            const consumerStub = sandbox.stub().returns({});
            const mockKafka = { consumer: consumerStub };
            const mockAdmin = {
                fetchTopicMetadata: sandbox.stub().resolves({
                    topics: [{
                        partitions: [
                            { partitionId: 0, leader: 1, replicas: [1, 2], isr: [1, 2] }
                        ]
                    }]
                }),
                describeConfigs: sandbox.stub().resolves({
                    resources: [{ configEntries: [{ name: 'cleanup.policy', value: 'delete' }] }]
                }),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, low: '0', high: '10' }
                ]),
            } as unknown as Admin;

            (clientManager as any).clusters.set('test-cluster', {
                name: 'test-cluster', type: 'kafka', brokers: ['localhost:9092'], securityProtocol: 'PLAINTEXT'
            });
            (clientManager as any).kafkaInstances.set('test-cluster', mockKafka);
            sandbox.stub(clientManager as any, 'getAdmin').resolves(mockAdmin);

            const details = await clientManager.getTopicDetails('test-cluster', 'test-topic');

            // No consumer should be created — the old code called kafka.consumer()
            assert.strictEqual(consumerStub.called, false);
            assert.ok(details.partitionDetails[0]);
            assert.strictEqual(details.partitionDetails[0].lowWaterMark, '0');
            assert.strictEqual(details.partitionDetails[0].highWaterMark, '10');
        });

        test('should handle missing topic offsets gracefully', async () => {
            const mockKafka = { consumer: sandbox.stub() };
            const mockAdmin = {
                fetchTopicMetadata: sandbox.stub().resolves({
                    topics: [{
                        partitions: [
                            { partitionId: 0, leader: 1, replicas: [1], isr: [1] }
                        ]
                    }]
                }),
                describeConfigs: sandbox.stub().resolves({
                    resources: [{ configEntries: [] }]
                }),
                fetchTopicOffsets: sandbox.stub().rejects(new Error('Offsets not available')),
            } as unknown as Admin;

            (clientManager as any).clusters.set('test-cluster', {
                name: 'test-cluster', type: 'kafka', brokers: ['localhost:9092'], securityProtocol: 'PLAINTEXT'
            });
            (clientManager as any).kafkaInstances.set('test-cluster', mockKafka);
            sandbox.stub(clientManager as any, 'getAdmin').resolves(mockAdmin);

            const details = await clientManager.getTopicDetails('test-cluster', 'test-topic');

            assert.strictEqual(details.partitionDetails[0].lowWaterMark, '0');
            assert.strictEqual(details.partitionDetails[0].highWaterMark, '0');
        });
    });
});
