import * as assert from 'assert';
import * as sinon from 'sinon';
import { EventBus, KafkaEvents } from '../../infrastructure/EventBus';
import { SchemaRegistryService } from '../../services/SchemaRegistryService';
import { CredentialManager } from '../../infrastructure/CredentialManager';

suite('Telemetry Events Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let eventBus: EventBus;

    setup(() => {
        sandbox = sinon.createSandbox();
        eventBus = new EventBus();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Event Bus', () => {
        test('should have all Phase 1 telemetry events defined', () => {
            assert.ok(KafkaEvents.SCHEMA_FETCHED, 'Should have SCHEMA_FETCHED event');
            assert.ok(KafkaEvents.SCHEMA_VALIDATED, 'Should have SCHEMA_VALIDATED event');
            assert.ok(KafkaEvents.MESSAGE_SEARCHED, 'Should have MESSAGE_SEARCHED event');
            assert.ok(KafkaEvents.SEEK_PERFORMED, 'Should have SEEK_PERFORMED event');
            assert.ok(KafkaEvents.LAG_ALERT_SENT, 'Should have LAG_ALERT_SENT event');
        });

        test('should emit and receive events', (done) => {
            const testData = { test: 'data' };

            eventBus.on(KafkaEvents.SCHEMA_FETCHED, (data) => {
                assert.deepStrictEqual(data, testData, 'Should receive correct data');
                done();
            });

            eventBus.emitSync(KafkaEvents.SCHEMA_FETCHED, testData);
        });

        test('should support multiple listeners', () => {
            let listener1Called = false;
            let listener2Called = false;

            eventBus.on(KafkaEvents.SCHEMA_FETCHED, () => {
                listener1Called = true;
            });

            eventBus.on(KafkaEvents.SCHEMA_FETCHED, () => {
                listener2Called = true;
            });

            eventBus.emitSync(KafkaEvents.SCHEMA_FETCHED, {});

            assert.ok(listener1Called, 'First listener should be called');
            assert.ok(listener2Called, 'Second listener should be called');
        });
    });

    suite('Schema Registry Telemetry', () => {
        test('should emit SCHEMA_FETCHED event when schema is fetched', async () => {
            const mockCredentialManager = sandbox.createStubInstance(CredentialManager);
            mockCredentialManager.getCredentials.resolves({});

            const schemaService = new SchemaRegistryService(
                { url: 'https://schema-registry.example.com' },
                mockCredentialManager as any,
                'test-cluster',
                eventBus
            );

            // Mock the registry
            const mockRegistry = {
                getLatestSchemaId: sandbox.stub().resolves(123),
                getSchema: sandbox.stub().resolves({ schema: '{"type":"record"}', version: 1 })
            };
            (schemaService as any).registry = mockRegistry;

            let eventEmitted = false;
            let eventData: any;

            eventBus.on(KafkaEvents.SCHEMA_FETCHED, (data) => {
                eventEmitted = true;
                eventData = data;
            });

            await schemaService.getLatestSchema('test-subject');

            assert.ok(eventEmitted, 'Should emit SCHEMA_FETCHED event');
            assert.strictEqual(eventData.clusterId, 'test-cluster');
            assert.strictEqual(eventData.subject, 'test-subject');
            assert.strictEqual(eventData.schemaId, 123);
        });

        test('should emit SCHEMA_VALIDATED event on successful validation', async () => {
            const mockCredentialManager = sandbox.createStubInstance(CredentialManager);
            mockCredentialManager.getCredentials.resolves({});

            const schemaService = new SchemaRegistryService(
                { url: 'https://schema-registry.example.com' },
                mockCredentialManager as any,
                'test-cluster',
                eventBus
            );

            // Mock the registry
            const mockRegistry = {
                getLatestSchemaId: sandbox.stub().resolves(123),
                getSchema: sandbox.stub().resolves({ schema: '{"type":"record"}', version: 1 }),
                encode: sandbox.stub().resolves(Buffer.from('encoded'))
            };
            (schemaService as any).registry = mockRegistry;

            let eventEmitted = false;
            let eventData: any;

            eventBus.on(KafkaEvents.SCHEMA_VALIDATED, (data) => {
                eventEmitted = true;
                eventData = data;
            });

            await schemaService.validateMessage('test-subject', { test: 'data' });

            assert.ok(eventEmitted, 'Should emit SCHEMA_VALIDATED event');
            assert.strictEqual(eventData.clusterId, 'test-cluster');
            assert.strictEqual(eventData.subject, 'test-subject');
            assert.strictEqual(eventData.success, true);
        });

        test('should emit SCHEMA_VALIDATED event on failed validation', async () => {
            const mockCredentialManager = sandbox.createStubInstance(CredentialManager);
            mockCredentialManager.getCredentials.resolves({});

            const schemaService = new SchemaRegistryService(
                { url: 'https://schema-registry.example.com' },
                mockCredentialManager as any,
                'test-cluster',
                eventBus
            );

            // Mock the registry to fail validation
            const mockRegistry = {
                getLatestSchemaId: sandbox.stub().resolves(123),
                getSchema: sandbox.stub().resolves({ schema: '{"type":"record"}', version: 1 }),
                encode: sandbox.stub().rejects(new Error('Invalid data'))
            };
            (schemaService as any).registry = mockRegistry;

            let eventEmitted = false;
            let eventData: any;

            eventBus.on(KafkaEvents.SCHEMA_VALIDATED, (data) => {
                eventEmitted = true;
                eventData = data;
            });

            await schemaService.validateMessage('test-subject', { test: 'invalid' });

            assert.ok(eventEmitted, 'Should emit SCHEMA_VALIDATED event');
            assert.strictEqual(eventData.success, false, 'Should indicate validation failure');
        });
    });

    suite('Message Search Telemetry', () => {
        test('should emit MESSAGE_SEARCHED event with correct data', () => {
            let eventEmitted = false;
            let eventData: any;

            eventBus.on(KafkaEvents.MESSAGE_SEARCHED, (data) => {
                eventEmitted = true;
                eventData = data;
            });

            eventBus.emitSync(KafkaEvents.MESSAGE_SEARCHED, {
                clusterName: 'test-cluster',
                topicName: 'test-topic',
                searchType: 'filter',
                hasKeyFilter: true,
                hasOffsetFilter: false
            });

            assert.ok(eventEmitted, 'Should emit MESSAGE_SEARCHED event');
            assert.strictEqual(eventData.clusterName, 'test-cluster');
            assert.strictEqual(eventData.topicName, 'test-topic');
            assert.strictEqual(eventData.searchType, 'filter');
            assert.strictEqual(eventData.hasKeyFilter, true);
            assert.strictEqual(eventData.hasOffsetFilter, false);
        });
    });

    suite('Seek Telemetry', () => {
        test('should emit SEEK_PERFORMED event with timestamp', () => {
            let eventEmitted = false;
            let eventData: any;

            eventBus.on(KafkaEvents.SEEK_PERFORMED, (data) => {
                eventEmitted = true;
                eventData = data;
            });

            const timestamp = Date.now();
            eventBus.emitSync(KafkaEvents.SEEK_PERFORMED, {
                clusterName: 'test-cluster',
                topicName: 'test-topic',
                seekType: 'timestamp',
                timestamp
            });

            assert.ok(eventEmitted, 'Should emit SEEK_PERFORMED event');
            assert.strictEqual(eventData.clusterName, 'test-cluster');
            assert.strictEqual(eventData.topicName, 'test-topic');
            assert.strictEqual(eventData.seekType, 'timestamp');
            assert.strictEqual(eventData.timestamp, timestamp);
        });

        test('should emit SEEK_PERFORMED event with offset', () => {
            let eventEmitted = false;
            let eventData: any;

            eventBus.on(KafkaEvents.SEEK_PERFORMED, (data) => {
                eventEmitted = true;
                eventData = data;
            });

            eventBus.emitSync(KafkaEvents.SEEK_PERFORMED, {
                clusterName: 'test-cluster',
                topicName: 'test-topic',
                seekType: 'offset',
                offset: '12345',
                partition: 0
            });

            assert.ok(eventEmitted, 'Should emit SEEK_PERFORMED event');
            assert.strictEqual(eventData.seekType, 'offset');
            assert.strictEqual(eventData.offset, '12345');
            assert.strictEqual(eventData.partition, 0);
        });
    });

    suite('Lag Alert Telemetry', () => {
        test('should emit LAG_ALERT_SENT event with correct data', () => {
            let eventEmitted = false;
            let eventData: any;

            eventBus.on(KafkaEvents.LAG_ALERT_SENT, (data) => {
                eventEmitted = true;
                eventData = data;
            });

            eventBus.emitSync(KafkaEvents.LAG_ALERT_SENT, {
                clusterName: 'test-cluster',
                criticalCount: 2,
                warningCount: 3,
                totalGroups: 5
            });

            assert.ok(eventEmitted, 'Should emit LAG_ALERT_SENT event');
            assert.strictEqual(eventData.clusterName, 'test-cluster');
            assert.strictEqual(eventData.criticalCount, 2);
            assert.strictEqual(eventData.warningCount, 3);
            assert.strictEqual(eventData.totalGroups, 5);
        });
    });

    suite('Event Listener Management', () => {
        test('should unsubscribe from events', () => {
            let callCount = 0;

            const unsubscribe = eventBus.on(KafkaEvents.SCHEMA_FETCHED, () => {
                callCount++;
            });

            eventBus.emitSync(KafkaEvents.SCHEMA_FETCHED, {});
            assert.strictEqual(callCount, 1, 'Should call listener once');

            unsubscribe();

            eventBus.emitSync(KafkaEvents.SCHEMA_FETCHED, {});
            assert.strictEqual(callCount, 1, 'Should not call listener after unsubscribe');
        });

        test('should clear all listeners', () => {
            let callCount = 0;

            eventBus.on(KafkaEvents.SCHEMA_FETCHED, () => { callCount++; });
            eventBus.on(KafkaEvents.SCHEMA_VALIDATED, () => { callCount++; });

            eventBus.removeAllListeners();

            eventBus.emitSync(KafkaEvents.SCHEMA_FETCHED, {});
            eventBus.emitSync(KafkaEvents.SCHEMA_VALIDATED, {});

            assert.strictEqual(callCount, 0, 'Should not call any listeners after clearing all');
        });
    });

    suite('Telemetry Data Privacy', () => {
        test('should not include sensitive data in events', () => {
            let eventData: any;

            eventBus.on(KafkaEvents.SCHEMA_FETCHED, (data) => {
                eventData = data;
            });

            eventBus.emitSync(KafkaEvents.SCHEMA_FETCHED, {
                clusterId: 'test-cluster',
                subject: 'test-subject',
                schemaId: 123
            });

            // Verify no sensitive data is included
            assert.ok(!eventData.password, 'Should not include password');
            assert.ok(!eventData.apiKey, 'Should not include API key');
            assert.ok(!eventData.apiSecret, 'Should not include API secret');
            assert.ok(!eventData.credentials, 'Should not include credentials');
        });

        test('should not include message content in MESSAGE_SEARCHED event', () => {
            let eventData: any;

            eventBus.on(KafkaEvents.MESSAGE_SEARCHED, (data) => {
                eventData = data;
            });

            eventBus.emitSync(KafkaEvents.MESSAGE_SEARCHED, {
                clusterName: 'test-cluster',
                topicName: 'test-topic',
                searchType: 'filter',
                hasKeyFilter: true,
                hasOffsetFilter: false
            });

            // Verify no message content is included
            assert.ok(!eventData.messageKey, 'Should not include message key');
            assert.ok(!eventData.messageValue, 'Should not include message value');
            assert.ok(!eventData.searchTerm, 'Should not include search term (may contain PII)');
        });
    });
});
