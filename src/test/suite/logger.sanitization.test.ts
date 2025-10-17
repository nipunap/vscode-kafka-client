/**
 * Phase 0: Logger Sanitization Tests (SEC-LOG)
 * Tests for credential redaction in log output
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { Logger, LogLevel } from '../../infrastructure/Logger';

suite('Logger Sanitization Test Suite (Phase 0: SEC-LOG)', () => {
    let sandbox: sinon.SinonSandbox;
    let logger: Logger;

    setup(() => {
        sandbox = sinon.createSandbox();
        Logger.setLevel(LogLevel.DEBUG);
        logger = Logger.getLogger('SanitizationTest');
    });

    teardown(() => {
        sandbox.restore();
        Logger.clearLoggers();
    });

    suite('Sensitive Key Redaction', () => {
        test('should redact saslPassword', () => {
            const data = { username: 'admin', saslPassword: 'secret123' };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.username, 'admin', 'Non-sensitive data should not be changed');
            assert.strictEqual(sanitized.saslPassword, '[REDACTED]', 'saslPassword should be redacted');
        });

        test('should redact sslPassword', () => {
            const data = { sslPassword: 'ssl-secret', broker: 'localhost:9092' };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.sslPassword, '[REDACTED]', 'sslPassword should be redacted');
            assert.strictEqual(sanitized.broker, 'localhost:9092', 'Non-sensitive data should not be changed');
        });

        test('should redact awsSecretAccessKey', () => {
            const data = {
                awsAccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
                awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
                region: 'us-east-1'
            };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.awsAccessKeyId, '[REDACTED]', 'awsAccessKeyId should be redacted');
            assert.strictEqual(sanitized.awsSecretAccessKey, '[REDACTED]', 'awsSecretAccessKey should be redacted');
            assert.strictEqual(sanitized.region, 'us-east-1', 'Region should not be redacted');
        });

        test('should redact awsSessionToken', () => {
            const data = {
                awsSessionToken: 'FwoGZXIvYXdzEBYaDJ...',
                service: 'msk'
            };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.awsSessionToken, '[REDACTED]', 'awsSessionToken should be redacted');
            assert.strictEqual(sanitized.service, 'msk', 'Service should not be redacted');
        });

        test('should redact schemaRegistryApiKey', () => {
            const data = {
                schemaRegistryUrl: 'https://schema.example.com',
                schemaRegistryApiKey: 'SR-API-KEY-123',
                schemaRegistryApiSecret: 'SR-SECRET-456'
            };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.schemaRegistryApiKey, '[REDACTED]', 'API key should be redacted');
            assert.strictEqual(sanitized.schemaRegistryApiSecret, '[REDACTED]', 'API secret should be redacted');
            assert.strictEqual(sanitized.schemaRegistryUrl, 'https://schema.example.com', 'URL should not be redacted');
        });

        test('should redact generic password field', () => {
            const data = { password: 'mypassword123', username: 'user' };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.password, '[REDACTED]', 'password should be redacted');
            assert.strictEqual(sanitized.username, 'user', 'username should not be redacted');
        });

        test('should redact generic secret field', () => {
            const data = { secret: 'my-secret-value', name: 'cluster1' };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.secret, '[REDACTED]', 'secret should be redacted');
            assert.strictEqual(sanitized.name, 'cluster1', 'name should not be redacted');
        });

        test('should redact generic token field', () => {
            const data = { token: 'bearer-token-123', endpoint: 'api.example.com' };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.token, '[REDACTED]', 'token should be redacted');
            assert.strictEqual(sanitized.endpoint, 'api.example.com', 'endpoint should not be redacted');
        });

        test('should redact apiKey and apiSecret', () => {
            const data = {
                apiKey: 'API-KEY-123',
                apiSecret: 'API-SECRET-456',
                service: 'kafka'
            };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.apiKey, '[REDACTED]', 'apiKey should be redacted');
            assert.strictEqual(sanitized.apiSecret, '[REDACTED]', 'apiSecret should be redacted');
            assert.strictEqual(sanitized.service, 'kafka', 'service should not be redacted');
        });

        test('should redact principal', () => {
            const data = { principal: 'User:alice', operation: 'READ' };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.principal, '[REDACTED]', 'principal should be redacted');
            assert.strictEqual(sanitized.operation, 'READ', 'operation should not be redacted');
        });
    });

    suite('Nested Object Sanitization', () => {
        test('should recursively sanitize nested objects', () => {
            const data = {
                cluster: {
                    name: 'prod-cluster',
                    auth: {
                        saslPassword: 'nested-secret',
                        username: 'admin'
                    }
                }
            };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.cluster.name, 'prod-cluster', 'Nested name should not be redacted');
            assert.strictEqual(sanitized.cluster.auth.username, 'admin', 'Nested username should not be redacted');
            assert.strictEqual(sanitized.cluster.auth.saslPassword, '[REDACTED]', 'Nested password should be redacted');
        });

        test('should handle deeply nested credentials', () => {
            const data = {
                config: {
                    kafka: {
                        connection: {
                            auth: {
                                password: 'deep-secret'
                            }
                        }
                    }
                }
            };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(
                sanitized.config.kafka.connection.auth.password,
                '[REDACTED]',
                'Deeply nested password should be redacted'
            );
        });

        test('should sanitize multiple credentials at different levels', () => {
            const data = {
                password: 'root-pass',
                nested: {
                    token: 'nested-token',
                    deep: {
                        apiKey: 'deep-key'
                    }
                }
            };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.password, '[REDACTED]', 'Root password should be redacted');
            assert.strictEqual(sanitized.nested.token, '[REDACTED]', 'Nested token should be redacted');
            assert.strictEqual(sanitized.nested.deep.apiKey, '[REDACTED]', 'Deep apiKey should be redacted');
        });
    });

    suite('Array Sanitization', () => {
        test('should sanitize credentials in arrays', () => {
            const data = [
                { name: 'cluster1', saslPassword: 'pass1' },
                { name: 'cluster2', token: 'token2' }
            ];
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized[0].name, 'cluster1', 'Array item name should not be redacted');
            assert.strictEqual(sanitized[0].saslPassword, '[REDACTED]', 'Array item password should be redacted');
            assert.strictEqual(sanitized[1].name, 'cluster2', 'Second item name should not be redacted');
            assert.strictEqual(sanitized[1].token, '[REDACTED]', 'Array item token should be redacted');
        });

        test('should handle nested arrays with credentials', () => {
            const data = {
                clusters: [
                    {
                        name: 'cluster1',
                        credentials: [
                            { type: 'sasl', password: 'sasl-pass' },
                            { type: 'ssl', sslPassword: 'ssl-pass' }
                        ]
                    }
                ]
            };
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized.clusters[0].name, 'cluster1');
            assert.strictEqual(sanitized.clusters[0].credentials[0].password, '[REDACTED]');
            assert.strictEqual(sanitized.clusters[0].credentials[1].sslPassword, '[REDACTED]');
        });
    });

    suite('Edge Cases', () => {
        test('should handle null values', () => {
            const data = null;
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized, null, 'null should be returned as-is');
        });

        test('should handle undefined values', () => {
            const data = undefined;
            const sanitized = (logger as any).sanitize(data);

            assert.strictEqual(sanitized, undefined, 'undefined should be returned as-is');
        });

        test('should handle primitive values', () => {
            const string = 'test-string';
            const number = 123;
            const boolean = true;

            assert.strictEqual((logger as any).sanitize(string), 'test-string');
            assert.strictEqual((logger as any).sanitize(number), 123);
            assert.strictEqual((logger as any).sanitize(boolean), true);
        });

        test('should handle empty objects', () => {
            const data = {};
            const sanitized = (logger as any).sanitize(data);

            assert.deepStrictEqual(sanitized, {}, 'Empty object should remain empty');
        });

        test('should handle empty arrays', () => {
            const data: any[] = [];
            const sanitized = (logger as any).sanitize(data);

            assert.deepStrictEqual(sanitized, [], 'Empty array should remain empty');
        });

        test('should handle objects with no sensitive keys', () => {
            const data = {
                name: 'cluster1',
                brokers: ['localhost:9092'],
                topics: ['topic1', 'topic2']
            };
            const sanitized = (logger as any).sanitize(data);

            assert.deepStrictEqual(sanitized, data, 'Object without sensitive keys should be unchanged');
        });

        test('should not mutate original object', () => {
            const original = { name: 'cluster1', password: 'secret' };
            const originalCopy = JSON.parse(JSON.stringify(original));

            (logger as any).sanitize(original);

            assert.deepStrictEqual(original, originalCopy, 'Original object should not be mutated');
        });

        test('should handle circular reference gracefully', () => {
            const obj: any = {};
            obj.circular = obj; // Create circular reference

            assert.doesNotThrow(() => {
                const logger = Logger.getLogger('test');
                logger.sanitize(obj);
            }, 'Should not throw on circular reference');

            // The result should be a sanitized version without stack overflow
            const result = Logger.getLogger('test').sanitize(obj);
            assert.ok(result !== undefined, 'Should return a result');
            assert.strictEqual(result.circular, '[CIRCULAR REFERENCE]', 'Circular reference should be handled');
        });
    });

    suite('Integration with log() method', () => {
        test('should sanitize objects before logging', () => {
            const data = { username: 'admin', password: 'secret123' };

            // Should not throw
            assert.doesNotThrow(() => {
                logger.info('Test message', data);
            });
        });

        test('should sanitize error stack traces', () => {
            const error = new Error('Test error with password: secret123');

            // Should not throw
            assert.doesNotThrow(() => {
                logger.error('Test error message', error);
            });
        });

        test('should handle multiple data objects', () => {
            const data1 = { saslPassword: 'pass1' };
            const data2 = { token: 'token2' };

            // Should not throw
            assert.doesNotThrow(() => {
                logger.debug('Test message', data1, data2);
            });
        });
    });

    suite('Security Compliance', () => {
        test('should redact all 13 sensitive key types', () => {
            const data = {
                saslPassword: 'secret1',
                sslPassword: 'secret2',
                awsSecretAccessKey: 'secret3',
                awsAccessKeyId: 'secret4',
                awsSessionToken: 'secret5',
                principal: 'secret6',
                schemaRegistryApiKey: 'secret7',
                schemaRegistryApiSecret: 'secret8',
                password: 'secret9',
                secret: 'secret10',
                token: 'secret11',
                apiKey: 'secret12',
                apiSecret: 'secret13'
            };

            const sanitized = (logger as any).sanitize(data);

            // Verify all 13 sensitive keys are redacted
            const keys = Object.keys(data);
            keys.forEach(key => {
                assert.strictEqual(
                    sanitized[key],
                    '[REDACTED]',
                    `${key} should be redacted`
                );
            });
        });

        test('should ensure no credentials leak in complex scenarios', () => {
            const complexData = {
                clusters: [
                    {
                        name: 'prod',
                        auth: {
                            saslPassword: 'prod-secret',
                            awsAccessKeyId: 'AWS-KEY-123',
                            awsSecretAccessKey: 'AWS-SECRET-456'
                        }
                    },
                    {
                        name: 'dev',
                        auth: {
                            token: 'dev-token-789',
                            schemaRegistryApiKey: 'SR-KEY-ABC'
                        }
                    }
                ],
                config: {
                    ssl: {
                        sslPassword: 'ssl-cert-pass'
                    }
                }
            };

            const sanitized = (logger as any).sanitize(complexData);
            const sanitizedStr = JSON.stringify(sanitized);

            // Verify no actual secrets appear in sanitized output
            assert.ok(!sanitizedStr.includes('prod-secret'), 'saslPassword should not appear');
            assert.ok(!sanitizedStr.includes('AWS-KEY-123'), 'awsAccessKeyId should not appear');
            assert.ok(!sanitizedStr.includes('AWS-SECRET-456'), 'awsSecretAccessKey should not appear');
            assert.ok(!sanitizedStr.includes('dev-token-789'), 'token should not appear');
            assert.ok(!sanitizedStr.includes('SR-KEY-ABC'), 'schemaRegistryApiKey should not appear');
            assert.ok(!sanitizedStr.includes('ssl-cert-pass'), 'sslPassword should not appear');

            // Verify [REDACTED] appears for all sensitive keys
            assert.ok(sanitizedStr.includes('[REDACTED]'), 'Should contain [REDACTED] markers');
        });
    });
});
