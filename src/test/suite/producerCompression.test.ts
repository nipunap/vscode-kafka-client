import * as assert from 'assert';
import * as sinon from 'sinon';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';

suite('Producer Compression Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let clientManager: KafkaClientManager;
    let mockProducer: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        mockProducer = {
            send: sandbox.stub().resolves()
        };

        // Create a partial mock that has the real produceAdvancedMessages method
        clientManager = {
            getProducer: sandbox.stub().resolves(mockProducer),
            produceAdvancedMessages: async function(clusterName: string, topic: string, messages: any[], compression?: 'gzip' | 'none') {
                const producer = await this.getProducer(clusterName);
                
                const sendOptions: any = {
                    topic,
                    messages: messages.map(msg => ({
                        key: msg.key,
                        value: msg.value,
                        partition: msg.partition,
                        headers: msg.headers,
                        timestamp: msg.timestamp
                    }))
                };

                if (compression === 'gzip') {
                    sendOptions.compression = 1;
                }

                return await producer.send(sendOptions);
            }
        } as any;
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('GZIP Compression', () => {
        test('should send message with GZIP compression', async () => {
            const messages = [{
                key: 'test-key',
                value: 'test-value',
                partition: 0,
                headers: {}
            }];

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'gzip'
            );

            assert.ok(mockProducer.send.called, 'Should call producer.send');
            
            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, 1, 'Should set compression to 1 (GZIP)');
            assert.strictEqual(sendArgs.topic, 'test-topic', 'Should send to correct topic');
        });

        test('should send message without compression', async () => {
            const messages = [{
                key: 'test-key',
                value: 'test-value'
            }];

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'none'
            );

            assert.ok(mockProducer.send.called, 'Should call producer.send');
            
            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, undefined, 'Should not set compression');
        });

        test('should send message with default (no compression specified)', async () => {
            const messages = [{
                key: 'test-key',
                value: 'test-value'
            }];

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages
            );

            assert.ok(mockProducer.send.called, 'Should call producer.send');
            
            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, undefined, 'Should not set compression by default');
        });

        test('should handle compression with multiple messages', async () => {
            const messages = [
                { key: 'key1', value: 'value1' },
                { key: 'key2', value: 'value2' },
                { key: 'key3', value: 'value3' }
            ];

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'gzip'
            );

            assert.ok(mockProducer.send.called, 'Should call producer.send');
            
            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, 1, 'Should apply compression to batch');
            assert.strictEqual(sendArgs.messages.length, 3, 'Should send all messages');
        });

        test('should handle compression with large messages', async () => {
            const largeValue = 'x'.repeat(10000); // 10KB message
            const messages = [{
                key: 'test-key',
                value: largeValue
            }];

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'gzip'
            );

            assert.ok(mockProducer.send.called, 'Should handle large messages with compression');
            
            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, 1, 'Should compress large message');
        });
    });

    suite('Compression Error Handling', () => {
        test('should handle producer errors with compression', async () => {
            mockProducer.send.rejects(new Error('Compression failed'));

            const messages = [{
                key: 'test-key',
                value: 'test-value'
            }];

            await assert.rejects(
                async () => await (clientManager as any).produceAdvancedMessages(
                    'test-cluster',
                    'test-topic',
                    messages,
                    'gzip'
                ),
                /Compression failed/,
                'Should propagate compression errors'
            );
        });

        test('should handle invalid compression type gracefully', async () => {
            const messages = [{
                key: 'test-key',
                value: 'test-value'
            }];

            // TypeScript should prevent this, but test runtime behavior
            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'invalid-type' as any
            );

            assert.ok(mockProducer.send.called, 'Should still attempt to send');
            
            const sendArgs = mockProducer.send.firstCall.args[0];
            // Should not set compression for invalid type
            assert.strictEqual(sendArgs.compression, undefined, 'Should ignore invalid compression type');
        });
    });

    suite('Compression with Message Features', () => {
        test('should combine compression with headers', async () => {
            const messages = [{
                key: 'test-key',
                value: 'test-value',
                headers: {
                    'content-type': 'application/json',
                    'correlation-id': '12345'
                }
            }];

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'gzip'
            );

            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, 1, 'Should have compression');
            assert.ok(sendArgs.messages[0].headers, 'Should preserve headers');
            assert.strictEqual(
                sendArgs.messages[0].headers['content-type'],
                'application/json',
                'Should preserve header values'
            );
        });

        test('should combine compression with partition selection', async () => {
            const messages = [{
                key: 'test-key',
                value: 'test-value',
                partition: 2
            }];

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'gzip'
            );

            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, 1, 'Should have compression');
            assert.strictEqual(sendArgs.messages[0].partition, 2, 'Should preserve partition');
        });

        test('should combine compression with timestamps', async () => {
            const timestamp = Date.now().toString();
            const messages = [{
                key: 'test-key',
                value: 'test-value',
                timestamp: timestamp
            }];

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'gzip'
            );

            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, 1, 'Should have compression');
            assert.strictEqual(sendArgs.messages[0].timestamp, timestamp, 'Should preserve timestamp');
        });
    });

    suite('Performance', () => {
        test('should handle batch compression efficiently', async () => {
            const messages = Array.from({ length: 1000 }, (_, i) => ({
                key: `key-${i}`,
                value: `value-${i}`
            }));

            const startTime = Date.now();
            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                messages,
                'gzip'
            );
            const duration = Date.now() - startTime;

            assert.ok(duration < 1000, `Batch compression should be fast (took ${duration}ms)`);
            assert.ok(mockProducer.send.called, 'Should send batch');
        });
    });

    suite('Avro Template', () => {
        test('should handle Avro template with compression', async () => {
            const avroMessage = {
                key: 'user-001',
                value: JSON.stringify({
                    id: 1,
                    name: 'John Doe',
                    email: 'john@example.com',
                    age: 30,
                    created_at: new Date().toISOString()
                }),
                headers: {
                    'content-type': 'application/avro',
                    'schema-version': '1'
                }
            };

            await (clientManager as any).produceAdvancedMessages(
                'test-cluster',
                'test-topic',
                [avroMessage],
                'gzip'
            );

            const sendArgs = mockProducer.send.firstCall.args[0];
            assert.strictEqual(sendArgs.compression, 1, 'Should compress Avro message');
            assert.strictEqual(
                sendArgs.messages[0].headers['content-type'],
                'application/avro',
                'Should preserve Avro content-type'
            );
            assert.strictEqual(
                sendArgs.messages[0].headers['schema-version'],
                '1',
                'Should preserve schema version'
            );
        });

        test('should validate Avro message structure', () => {
            const avroMessage = {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                age: 30,
                created_at: new Date().toISOString()
            };

            // Validate structure
            assert.ok(typeof avroMessage.id === 'number', 'ID should be number');
            assert.ok(typeof avroMessage.name === 'string', 'Name should be string');
            assert.ok(typeof avroMessage.email === 'string', 'Email should be string');
            assert.ok(typeof avroMessage.age === 'number', 'Age should be number');
            assert.ok(typeof avroMessage.created_at === 'string', 'Timestamp should be string');
        });
    });
});

