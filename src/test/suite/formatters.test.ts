import * as assert from 'assert';
import { formatMessages, formatTopicDetailsYaml, formatConsumerGroupDetailsYaml } from '../../utils/formatters';

suite('Formatters Test Suite', () => {
    
    suite('formatMessages', () => {
        test('should format empty messages array', () => {
            const result = formatMessages([]);
            const parsed = JSON.parse(result);
            assert.strictEqual(Array.isArray(parsed), true);
            assert.strictEqual(parsed.length, 0);
        });

        test('should format messages with all fields', () => {
            const messages = [
                {
                    partition: 0,
                    offset: '123',
                    key: Buffer.from('key1'),
                    value: Buffer.from('value1'),
                    timestamp: '1234567890',
                    headers: { 'content-type': 'application/json' }
                }
            ];

            const result = formatMessages(messages);
            const parsed = JSON.parse(result);

            assert.strictEqual(parsed.length, 1);
            assert.strictEqual(parsed[0].partition, 0);
            assert.strictEqual(parsed[0].offset, '123');
            assert.strictEqual(parsed[0].key, 'key1');
            assert.strictEqual(parsed[0].value, 'value1');
        });

        test('should handle messages without keys', () => {
            const messages = [
                {
                    partition: 1,
                    offset: '456',
                    value: Buffer.from('value-only'),
                    timestamp: '9876543210'
                }
            ];

            const result = formatMessages(messages);
            const parsed = JSON.parse(result);

            assert.strictEqual(parsed[0].key, undefined);
            assert.strictEqual(parsed[0].value, 'value-only');
        });
    });

    suite('formatTopicDetailsYaml', () => {
        test('should format basic topic details', () => {
            const details = {
                name: 'test-topic',
                partitions: 3,
                replicationFactor: 2,
                partitionDetails: {
                    0: {
                        partition: 0,
                        leader: 1,
                        replicas: [1, 2],
                        isr: [1, 2],
                        lowWaterMark: '0',
                        highWaterMark: '100',
                        messageCount: '100'
                    }
                },
                configuration: []
            };

            const yaml = formatTopicDetailsYaml(details);

            assert.ok(yaml.includes('name: "test-topic"'));
            assert.ok(yaml.includes('partitions: 3'));
            assert.ok(yaml.includes('replicationFactor: 2'));
            assert.ok(yaml.includes('partition: 0'));
            assert.ok(yaml.includes('leader: 1'));
        });

        test('should calculate total messages correctly', () => {
            const details = {
                name: 'test-topic',
                partitions: 2,
                replicationFactor: 1,
                partitionDetails: {
                    0: { messageCount: '100', partition: 0, leader: 1, replicas: [1], isr: [1], lowWaterMark: '0', highWaterMark: '100' },
                    1: { messageCount: '200', partition: 1, leader: 1, replicas: [1], isr: [1], lowWaterMark: '0', highWaterMark: '200' }
                },
                configuration: []
            };

            const yaml = formatTopicDetailsYaml(details);

            assert.ok(yaml.includes('totalMessages: 300'));
        });

        test('should handle configuration entries', () => {
            const details = {
                name: 'test-topic',
                partitions: 1,
                replicationFactor: 1,
                partitionDetails: {
                    0: { messageCount: '0', partition: 0, leader: 1, replicas: [1], isr: [1], lowWaterMark: '0', highWaterMark: '0' }
                },
                configuration: [
                    { configName: 'compression.type', configValue: 'gzip', isDefault: false },
                    { configName: 'retention.ms', configValue: '86400000', isDefault: true }
                ]
            };

            const yaml = formatTopicDetailsYaml(details);

            assert.ok(yaml.includes('compression.type: gzip'));
            assert.ok(!yaml.includes('retention.ms')); // Default configs are filtered
        });
    });

    suite('formatConsumerGroupDetailsYaml', () => {
        test('should format basic consumer group details', () => {
            const details = {
                groupId: 'test-group',
                state: 'Stable',
                protocolType: 'consumer',
                protocol: 'range',
                members: [],
                offsets: [],
                totalLag: 0
            };

            const yaml = formatConsumerGroupDetailsYaml(details);

            assert.ok(yaml.includes('groupId: "test-group"'));
            assert.ok(yaml.includes('state: "Stable"'));
            assert.ok(yaml.includes('protocolType: "consumer"'));
            assert.ok(yaml.includes('totalLag: 0'));
        });

        test('should format consumer group with members', () => {
            const details = {
                groupId: 'test-group',
                state: 'Stable',
                protocolType: 'consumer',
                protocol: 'range',
                members: [
                    {
                        memberId: 'member-1',
                        clientId: 'client-1',
                        clientHost: '/192.168.1.1'
                    }
                ],
                offsets: [],
                totalLag: 0
            };

            const yaml = formatConsumerGroupDetailsYaml(details);

            assert.ok(yaml.includes('memberCount: 1'));
            assert.ok(yaml.includes('memberId: "member-1"'));
            assert.ok(yaml.includes('clientId: "client-1"'));
        });

        test('should format offsets with lag status', () => {
            const details = {
                groupId: 'test-group',
                state: 'Stable',
                protocolType: 'consumer',
                protocol: 'range',
                members: [],
                offsets: [
                    {
                        topic: 'test-topic',
                        partition: 0,
                        currentOffset: '90',
                        highWaterMark: '100',
                        lag: 10 // minor
                    },
                    {
                        topic: 'test-topic',
                        partition: 1,
                        currentOffset: '0',
                        highWaterMark: '2000',
                        lag: 2000 // warning
                    },
                    {
                        topic: 'test-topic',
                        partition: 2,
                        currentOffset: '0',
                        highWaterMark: '20000',
                        lag: 20000 // critical
                    }
                ],
                totalLag: 22010
            };

            const yaml = formatConsumerGroupDetailsYaml(details);

            assert.ok(yaml.includes('status: minor'));
            assert.ok(yaml.includes('status: warning'));
            assert.ok(yaml.includes('status: critical'));
            assert.ok(yaml.includes('totalLag: 22010'));
        });

        test('should group offsets by topic', () => {
            const details = {
                groupId: 'test-group',
                state: 'Stable',
                protocolType: 'consumer',
                protocol: 'range',
                members: [],
                offsets: [
                    {
                        topic: 'topic-a',
                        partition: 0,
                        currentOffset: '10',
                        highWaterMark: '10',
                        lag: 0
                    },
                    {
                        topic: 'topic-b',
                        partition: 0,
                        currentOffset: '5',
                        highWaterMark: '10',
                        lag: 5
                    },
                    {
                        topic: 'topic-a',
                        partition: 1,
                        currentOffset: '20',
                        highWaterMark: '20',
                        lag: 0
                    }
                ],
                totalLag: 5
            };

            const yaml = formatConsumerGroupDetailsYaml(details);

            // Should have both topics
            assert.ok(yaml.includes('topic: "topic-a"'));
            assert.ok(yaml.includes('topic: "topic-b"'));
            
            // Should sort partitions within each topic
            const topicAIndex = yaml.indexOf('topic: "topic-a"');
            const partition0Index = yaml.indexOf('partition: 0', topicAIndex);
            const partition1Index = yaml.indexOf('partition: 1', topicAIndex);
            assert.ok(partition0Index < partition1Index);
        });
    });
});

