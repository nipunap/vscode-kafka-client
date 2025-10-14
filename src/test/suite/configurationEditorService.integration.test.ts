import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationEditorService } from '../../services/ConfigurationEditorService';
import { Admin, ConfigResourceTypes } from 'kafkajs';

suite('ConfigurationEditorService Integration Tests', () => {
    let service: ConfigurationEditorService;
    let mockAdmin: sinon.SinonStubbedInstance<Admin>;

    setup(() => {
        service = new ConfigurationEditorService();
        mockAdmin = {
            describeConfigs: sinon.stub(),
            alterConfigs: sinon.stub(),
            disconnect: sinon.stub()
        } as any;
    });

    teardown(() => {
        sinon.restore();
    });

    suite('getTopicConfig', () => {
        test('should handle valid config response', async () => {
            (mockAdmin.describeConfigs as sinon.SinonStub).resolves({
                resources: [{
                    resourceType: ConfigResourceTypes.TOPIC,
                    resourceName: 'test-topic',
                    configEntries: [
                        {
                            configName: 'retention.ms',
                            configValue: '86400000',
                            isDefault: false,
                            isReadOnly: false,
                            isSensitive: false,
                            configSource: 1
                        }
                    ]
                }]
            });

            const configs = await service.getTopicConfig(mockAdmin as any, 'test-topic');
            assert.strictEqual(configs.length, 1);
            assert.strictEqual(configs[0].configName, 'retention.ms');
            assert.strictEqual(configs[0].configValue, '86400000');
        });

        test('should throw error for non-existent topic', async () => {
            (mockAdmin.describeConfigs as sinon.SinonStub).resolves({
                resources: []
            });

            await assert.rejects(
                () => service.getTopicConfig(mockAdmin as any, 'non-existent'),
                /Topic not found/
            );
        });

        test('should filter invalid config entries', async () => {
            (mockAdmin.describeConfigs as sinon.SinonStub).resolves({
                resources: [{
                    resourceType: ConfigResourceTypes.TOPIC,
                    resourceName: 'test-topic',
                    configEntries: [
                        {
                            configName: 'valid.config',
                            configValue: '123',
                            isDefault: false
                        },
                        {
                            configName: 123,  // Invalid: should be string
                            configValue: 'value'
                        },
                        {
                            configName: 'another.valid',
                            configValue: 'value',
                            isDefault: true
                        }
                    ]
                }]
            });

            const configs = await service.getTopicConfig(mockAdmin as any, 'test-topic');
            // Should only return valid entries
            assert.strictEqual(configs.length, 2);
            assert.strictEqual(configs[0].configName, 'valid.config');
            assert.strictEqual(configs[1].configName, 'another.valid');
        });
    });

    suite('alterTopicConfig', () => {
        test('should successfully alter config', async () => {
            (mockAdmin.alterConfigs as sinon.SinonStub).resolves();

            await service.alterTopicConfig(mockAdmin as any, 'test-topic', [
                { name: 'retention.ms', value: '172800000' }
            ]);

            assert.strictEqual((mockAdmin.alterConfigs as sinon.SinonStub).callCount, 1);
            const callArgs = (mockAdmin.alterConfigs as sinon.SinonStub).firstCall.args[0];
            assert.strictEqual(callArgs.resources[0].name, 'test-topic');
            assert.strictEqual(callArgs.resources[0].configEntries[0].name, 'retention.ms');
        });

        test('should handle Kafka permission errors', async () => {
            (mockAdmin.alterConfigs as sinon.SinonStub).rejects(
                new Error('NOT_AUTHORIZED')
            );

            await assert.rejects(
                () => service.alterTopicConfig(mockAdmin as any, 'test-topic', [
                    { name: 'retention.ms', value: '172800000' }
                ]),
                /NOT_AUTHORIZED/
            );
        });
    });

    suite('Input Validation', () => {
        test('should reject dangerous characters in config values', () => {
            assert.throws(
                () => service.validateConfigValue('retention.ms', '123; DROP TABLE;'),
                /Invalid characters detected/
            );
        });

        test('should reject config values with shell metacharacters', () => {
            assert.throws(
                () => service.validateConfigValue('some.config', 'value && rm -rf /'),
                /Invalid characters detected/
            );
        });

        test('should accept valid numeric values', () => {
            assert.doesNotThrow(
                () => service.validateConfigValue('retention.ms', '86400000')
            );
        });

        test('should accept valid string values', () => {
            assert.doesNotThrow(
                () => service.validateConfigValue('compression.type', 'gzip')
            );
        });
    });

    suite('Edge Cases', () => {
        test('should handle null config entries array', async () => {
            (mockAdmin.describeConfigs as sinon.SinonStub).resolves({
                resources: [{
                    resourceType: ConfigResourceTypes.TOPIC,
                    resourceName: 'test-topic',
                    configEntries: null
                }]
            });

            await assert.rejects(
                () => service.getTopicConfig(mockAdmin as any, 'test-topic'),
                /Invalid config structure/
            );
        });

        test('should handle malformed responses', async () => {
            (mockAdmin.describeConfigs as sinon.SinonStub).resolves({
                resources: null
            });

            await assert.rejects(
                () => service.getTopicConfig(mockAdmin as any, 'test-topic')
            );
        });
    });
});

