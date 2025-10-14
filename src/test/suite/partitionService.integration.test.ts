import * as assert from 'assert';
import * as sinon from 'sinon';
import { PartitionService } from '../../services/PartitionService';
import { Admin } from 'kafkajs';

suite('PartitionService Integration Tests', () => {
    let service: PartitionService;
    let mockAdmin: sinon.SinonStubbedInstance<Admin>;

    setup(() => {
        service = new PartitionService();
        mockAdmin = {
            createPartitions: sinon.stub(),
            fetchTopicMetadata: sinon.stub(),
            disconnect: sinon.stub()
        } as any;
    });

    teardown(() => {
        sinon.restore();
    });

    suite('getCurrentPartitionCount', () => {
        test('should handle valid topic metadata', async () => {
            (mockAdmin.fetchTopicMetadata as sinon.SinonStub).resolves({
                topics: [{
                    name: 'test-topic',
                    partitions: [
                        { partitionId: 0, leader: 0, replicas: [0, 1], isr: [0, 1] },
                        { partitionId: 1, leader: 1, replicas: [0, 1], isr: [0, 1] },
                        { partitionId: 2, leader: 0, replicas: [0, 1], isr: [0, 1] }
                    ]
                }]
            });

            const count = await service.getCurrentPartitionCount(mockAdmin as any, 'test-topic');
            assert.strictEqual(count, 3);
        });

        test('should throw error for non-existent topic', async () => {
            (mockAdmin.fetchTopicMetadata as sinon.SinonStub).resolves({
                topics: []
            });

            await assert.rejects(
                () => service.getCurrentPartitionCount(mockAdmin as any, 'non-existent'),
                /Topic not found/
            );
        });

        test('should handle network errors gracefully', async () => {
            (mockAdmin.fetchTopicMetadata as sinon.SinonStub).rejects(
                new Error('ECONNREFUSED')
            );

            await assert.rejects(
                () => service.getCurrentPartitionCount(mockAdmin as any, 'test-topic'),
                /ECONNREFUSED/
            );
        });
    });

    suite('addPartitions', () => {
        test('should successfully add partitions', async () => {
            // Mock getCurrentPartitionCount
            (mockAdmin.fetchTopicMetadata as sinon.SinonStub).resolves({
                topics: [{
                    name: 'test-topic',
                    partitions: [
                        { partitionId: 0, leader: 0, replicas: [0], isr: [0] }
                    ]
                }]
            });

            (mockAdmin.createPartitions as sinon.SinonStub).resolves();

            await service.addPartitions(mockAdmin as any, 'test-topic', 5);

            assert.strictEqual((mockAdmin.createPartitions as sinon.SinonStub).callCount, 1);
            const callArgs = (mockAdmin.createPartitions as sinon.SinonStub).firstCall.args[0];
            assert.strictEqual(callArgs.topicPartitions[0].topic, 'test-topic');
            assert.strictEqual(callArgs.topicPartitions[0].count, 5);
        });

        test('should handle Kafka errors (e.g., LEADER_NOT_AVAILABLE)', async () => {
            (mockAdmin.fetchTopicMetadata as sinon.SinonStub).resolves({
                topics: [{
                    name: 'test-topic',
                    partitions: [{ partitionId: 0, leader: 0, replicas: [0], isr: [0] }]
                }]
            });

            (mockAdmin.createPartitions as sinon.SinonStub).rejects(
                new Error('LEADER_NOT_AVAILABLE')
            );

            await assert.rejects(
                () => service.addPartitions(mockAdmin as any, 'test-topic', 5),
                /LEADER_NOT_AVAILABLE/
            );
        });

        test('should handle timeout errors', async () => {
            (mockAdmin.fetchTopicMetadata as sinon.SinonStub).resolves({
                topics: [{
                    name: 'test-topic',
                    partitions: [{ partitionId: 0, leader: 0, replicas: [0], isr: [0] }]
                }]
            });

            (mockAdmin.createPartitions as sinon.SinonStub).rejects(
                new Error('Request timed out')
            );

            await assert.rejects(
                () => service.addPartitions(mockAdmin as any, 'test-topic', 5),
                /Request timed out/
            );
        });
    });

    suite('Edge Cases', () => {
        test('should handle empty partition list', async () => {
            (mockAdmin.fetchTopicMetadata as sinon.SinonStub).resolves({
                topics: [{
                    name: 'test-topic',
                    partitions: []
                }]
            });

            await assert.rejects(
                () => service.getCurrentPartitionCount(mockAdmin as any, 'test-topic'),
                /No partitions found/
            );
        });

        test('should handle null/undefined responses', async () => {
            (mockAdmin.fetchTopicMetadata as sinon.SinonStub).resolves(null);

            await assert.rejects(
                () => service.getCurrentPartitionCount(mockAdmin as any, 'test-topic')
            );
        });
    });
});
