import * as assert from 'assert';
import { ConfigurationEditorService } from '../../services/ConfigurationEditorService';

suite('ConfigurationEditorService Test Suite', () => {
    let service: ConfigurationEditorService;

    setup(() => {
        service = new ConfigurationEditorService();
    });

    suite('validateConfigValue', () => {
        test('should validate numeric configurations', () => {
            assert.doesNotThrow(() => service.validateConfigValue('retention.ms', '86400000'));
            assert.doesNotThrow(() => service.validateConfigValue('retention.ms', '-1'));
            assert.throws(
                () => service.validateConfigValue('retention.ms', 'not-a-number'),
                /must be a valid integer/
            );
        });

        test('should validate compression.type', () => {
            assert.doesNotThrow(() => service.validateConfigValue('compression.type', 'gzip'));
            assert.doesNotThrow(() => service.validateConfigValue('compression.type', 'snappy'));
            assert.doesNotThrow(() => service.validateConfigValue('compression.type', 'lz4'));
            assert.doesNotThrow(() => service.validateConfigValue('compression.type', 'zstd'));
            assert.doesNotThrow(() => service.validateConfigValue('compression.type', 'producer'));
            assert.doesNotThrow(() => service.validateConfigValue('compression.type', 'uncompressed'));

            assert.throws(
                () => service.validateConfigValue('compression.type', 'invalid'),
                /must be one of/
            );
        });

        test('should validate cleanup.policy', () => {
            assert.doesNotThrow(() => service.validateConfigValue('cleanup.policy', 'delete'));
            assert.doesNotThrow(() => service.validateConfigValue('cleanup.policy', 'compact'));
            assert.doesNotThrow(() => service.validateConfigValue('cleanup.policy', 'delete,compact'));

            assert.throws(
                () => service.validateConfigValue('cleanup.policy', 'invalid'),
                /must be one of/
            );
        });

        test('should validate message.timestamp.type', () => {
            assert.doesNotThrow(() => service.validateConfigValue('message.timestamp.type', 'CreateTime'));
            assert.doesNotThrow(() => service.validateConfigValue('message.timestamp.type', 'LogAppendTime'));

            assert.throws(
                () => service.validateConfigValue('message.timestamp.type', 'invalid'),
                /must be one of/
            );
        });

        test('should validate boolean configurations', () => {
            assert.doesNotThrow(() => service.validateConfigValue('preallocate', 'true'));
            assert.doesNotThrow(() => service.validateConfigValue('preallocate', 'false'));
            assert.doesNotThrow(() => service.validateConfigValue('preallocate', 'TRUE'));
            assert.doesNotThrow(() => service.validateConfigValue('preallocate', 'FALSE'));

            assert.throws(
                () => service.validateConfigValue('preallocate', 'yes'),
                /must be either true or false/
            );
        });
    });

    suite('isReadOnlyConfig', () => {
        test('should identify read-only configs', () => {
            assert.strictEqual(
                service.isReadOnlyConfig({ configName: 'test', configValue: '123', isReadOnly: true }),
                true
            );
        });

        test('should identify writable configs', () => {
            assert.strictEqual(
                service.isReadOnlyConfig({ configName: 'test', configValue: '123', isReadOnly: false }),
                false
            );
        });

        test('should default to false for undefined isReadOnly', () => {
            assert.strictEqual(
                service.isReadOnlyConfig({ configName: 'test', configValue: '123' }),
                false
            );
        });
    });

    suite('requiresBrokerRestart', () => {
        test('should identify configs requiring restart', () => {
            assert.strictEqual(service.requiresBrokerRestart('log.dirs'), true);
            assert.strictEqual(service.requiresBrokerRestart('broker.id'), true);
            assert.strictEqual(service.requiresBrokerRestart('listeners'), true);
            assert.strictEqual(service.requiresBrokerRestart('num.network.threads'), true);
        });

        test('should identify configs not requiring restart', () => {
            assert.strictEqual(service.requiresBrokerRestart('retention.ms'), false);
            assert.strictEqual(service.requiresBrokerRestart('compression.type'), false);
            assert.strictEqual(service.requiresBrokerRestart('cleanup.policy'), false);
        });
    });
});
