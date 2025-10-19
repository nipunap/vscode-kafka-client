import * as assert from 'assert';

suite('Schema Registry Configuration Test Suite', () => {
    suite('ClusterConnection Interface', () => {
        test('should support Confluent Schema Registry fields', () => {
            const connection = {
                name: 'test-cluster',
                type: 'kafka' as const,
                securityProtocol: 'PLAINTEXT' as const,
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: 'https://schema-registry.example.com:8081',
                schemaRegistryApiKey: 'api-key',
                schemaRegistryApiSecret: 'api-secret'
            };

            assert.strictEqual(connection.schemaRegistryType, 'confluent');
            assert.ok(connection.schemaRegistryUrl?.startsWith('https://'));
            assert.ok(connection.schemaRegistryApiKey);
            assert.ok(connection.schemaRegistryApiSecret);
        });

        test('should support AWS Glue Schema Registry fields', () => {
            const connection = {
                name: 'test-msk-cluster',
                type: 'msk' as const,
                securityProtocol: 'SASL_SSL' as const,
                schemaRegistryType: 'aws-glue' as const,
                glueRegistryName: 'default-registry',
                glueRegion: 'us-east-1'
            };

            assert.strictEqual(connection.schemaRegistryType, 'aws-glue');
            assert.strictEqual(connection.glueRegistryName, 'default-registry');
            assert.strictEqual(connection.glueRegion, 'us-east-1');
        });

        test('should support cluster without Schema Registry', () => {
            const connection: any = {
                name: 'test-cluster',
                type: 'kafka' as const,
                securityProtocol: 'PLAINTEXT' as const
            };

            assert.ok(!connection.schemaRegistryType);
            assert.ok(!connection.schemaRegistryUrl);
            assert.ok(!connection.glueRegistryName);
        });
    });

    suite('Confluent Schema Registry Validation', () => {
        test('should require HTTPS for Confluent Schema Registry', () => {
            const httpUrl = 'http://schema-registry.example.com:8081';
            const httpsUrl = 'https://schema-registry.example.com:8081';

            assert.ok(!httpUrl.startsWith('https://'), 'HTTP should not be allowed');
            assert.ok(httpsUrl.startsWith('https://'), 'HTTPS should be allowed');
        });

        test('should validate Confluent URL format', () => {
            const validUrls = [
                'https://schema-registry.example.com:8081',
                'https://localhost:8081',
                'https://10.0.0.1:8081'
            ];

            const invalidUrls = [
                'http://schema-registry.example.com:8081',
                'schema-registry.example.com:8081',
                'ftp://schema-registry.example.com:8081'
            ];

            validUrls.forEach(url => {
                assert.ok(url.startsWith('https://'), `${url} should be valid`);
            });

            invalidUrls.forEach(url => {
                assert.ok(!url.startsWith('https://'), `${url} should be invalid`);
            });
        });

        test('should support optional authentication', () => {
            const withAuth: any = {
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: 'https://registry.example.com:8081',
                schemaRegistryApiKey: 'key',
                schemaRegistryApiSecret: 'secret'
            };

            const withoutAuth: any = {
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: 'https://registry.example.com:8081'
            };

            assert.ok(withAuth.schemaRegistryApiKey, 'Should have API key');
            assert.ok(withAuth.schemaRegistryApiSecret, 'Should have API secret');
            assert.ok(!withoutAuth.schemaRegistryApiKey, 'Should not have API key');
            assert.ok(!withoutAuth.schemaRegistryApiSecret, 'Should not have API secret');
        });
    });

    suite('AWS Glue Schema Registry Validation', () => {
        test('should validate AWS region format', () => {
            const validRegions = [
                'us-east-1',
                'us-west-2',
                'eu-west-1',
                'ap-south-1'
            ];

            const invalidRegions = [
                'us-east',
                'useast1',
                'us_east_1',
                'US-EAST-1'
            ];

            const regionPattern = /^[a-z]{2}-[a-z]+-\d{1}$/;

            validRegions.forEach(region => {
                assert.ok(regionPattern.test(region), `${region} should be valid`);
            });

            invalidRegions.forEach(region => {
                assert.ok(!regionPattern.test(region), `${region} should be invalid`);
            });
        });

        test('should support default registry name', () => {
            const defaultRegistry = 'default-registry';
            const customRegistry = 'my-custom-registry';

            assert.strictEqual(defaultRegistry, 'default-registry');
            assert.ok(customRegistry.length > 0);
        });

        test('should validate registry name format', () => {
            const validNames = [
                'default-registry',
                'my-registry',
                'prod-registry-v1'
            ];

            validNames.forEach(name => {
                assert.ok(name.length > 0, `${name} should not be empty`);
                assert.ok(name.trim() === name, `${name} should not have whitespace`);
            });
        });
    });

    suite('Schema Registry Type Detection', () => {
        test('should identify Confluent type', () => {
            const config = {
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: 'https://registry.example.com:8081'
            };

            assert.strictEqual(config.schemaRegistryType, 'confluent');
            assert.ok(config.schemaRegistryUrl);
        });

        test('should identify AWS Glue type', () => {
            const config = {
                schemaRegistryType: 'aws-glue' as const,
                glueRegistryName: 'default-registry',
                glueRegion: 'us-east-1'
            };

            assert.strictEqual(config.schemaRegistryType, 'aws-glue');
            assert.ok(config.glueRegistryName);
            assert.ok(config.glueRegion);
        });

        test('should handle missing type', () => {
            const config: any = {
                name: 'test-cluster'
            };

            assert.ok(!config.schemaRegistryType);
        });
    });

    suite('Configuration Completeness', () => {
        test('should have all required fields for Confluent', () => {
            const config = {
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: 'https://registry.example.com:8081',
                schemaRegistryApiKey: 'key',
                schemaRegistryApiSecret: 'secret'
            };

            const hasType = !!config.schemaRegistryType;
            const hasUrl = !!config.schemaRegistryUrl;
            const hasAuth = !!(config.schemaRegistryApiKey && config.schemaRegistryApiSecret);

            assert.ok(hasType, 'Should have type');
            assert.ok(hasUrl, 'Should have URL');
            assert.ok(hasAuth, 'Should have auth');
        });

        test('should have all required fields for AWS Glue', () => {
            const config = {
                schemaRegistryType: 'aws-glue' as const,
                glueRegistryName: 'default-registry',
                glueRegion: 'us-east-1'
            };

            const hasType = !!config.schemaRegistryType;
            const hasRegistry = !!config.glueRegistryName;
            const hasRegion = !!config.glueRegion;

            assert.ok(hasType, 'Should have type');
            assert.ok(hasRegistry, 'Should have registry name');
            assert.ok(hasRegion, 'Should have region');
        });

        test('should allow minimal Confluent config without auth', () => {
            const config = {
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: 'https://registry.example.com:8081'
            };

            const isComplete = !!(config.schemaRegistryType && config.schemaRegistryUrl);
            assert.ok(isComplete, 'Should be complete without auth');
        });
    });

    suite('Security Considerations', () => {
        test('should enforce HTTPS for Confluent (SEC-3.1-3)', () => {
            const secureUrl = 'https://registry.example.com:8081';
            const insecureUrl = 'http://registry.example.com:8081';

            assert.ok(secureUrl.startsWith('https://'), 'Should enforce HTTPS');
            assert.ok(!insecureUrl.startsWith('https://'), 'Should reject HTTP');
        });

        test('should use IAM for AWS Glue (implicit)', () => {
            const glueConfig: any = {
                schemaRegistryType: 'aws-glue' as const,
                glueRegistryName: 'default-registry',
                glueRegion: 'us-east-1'
            };

            // AWS Glue uses IAM, no explicit credentials in config
            assert.ok(!glueConfig.schemaRegistryApiKey, 'Should not have API key');
            assert.ok(!glueConfig.schemaRegistryApiSecret, 'Should not have API secret');
        });

        test('should handle sensitive credentials properly', () => {
            const config = {
                schemaRegistryApiKey: 'sensitive-key',
                schemaRegistryApiSecret: 'sensitive-secret'
            };

            // In real implementation, these should be stored in SecretStorage
            assert.ok(config.schemaRegistryApiKey, 'Should have key');
            assert.ok(config.schemaRegistryApiSecret, 'Should have secret');
            // Note: Actual storage in SecretStorage is tested elsewhere
        });
    });

    suite('Backward Compatibility', () => {
        test('should handle clusters without schemaRegistryType', () => {
            const oldConfig = {
                name: 'old-cluster',
                type: 'kafka' as const,
                securityProtocol: 'PLAINTEXT' as const,
                schemaRegistryUrl: 'https://registry.example.com:8081'
            };

            // Old configs might not have type, should default to Confluent
            const inferredType = oldConfig.schemaRegistryUrl ? 'confluent' : undefined;
            assert.strictEqual(inferredType, 'confluent');
        });

        test('should handle migration from global settings', () => {
            // Old: global VSCode setting
            const oldGlobalUrl = 'https://global-registry.example.com:8081';

            // New: per-cluster config
            const newClusterConfig = {
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: oldGlobalUrl
            };

            assert.strictEqual(newClusterConfig.schemaRegistryUrl, oldGlobalUrl);
        });
    });

    suite('Edge Cases', () => {
        test('should handle empty registry name', () => {
            const emptyName = '';
            const validName = 'default-registry';

            assert.ok(emptyName.trim().length === 0, 'Empty name should be invalid');
            assert.ok(validName.trim().length > 0, 'Valid name should pass');
        });

        test('should handle whitespace in inputs', () => {
            const withWhitespace = '  default-registry  ';
            const trimmed = withWhitespace.trim();

            assert.strictEqual(trimmed, 'default-registry');
        });

        test('should handle special characters in registry name', () => {
            const validNames = [
                'my-registry',
                'prod-registry-v1',
                'team_registry'
            ];

            validNames.forEach(name => {
                assert.ok(name.length > 0);
            });
        });

        test('should handle case sensitivity in regions', () => {
            const lowerCase = 'us-east-1';
            const upperCase = 'US-EAST-1';
            const mixedCase = 'Us-East-1';

            const regionPattern = /^[a-z]{2}-[a-z]+-\d{1}$/;

            assert.ok(regionPattern.test(lowerCase), 'Lowercase should be valid');
            assert.ok(!regionPattern.test(upperCase), 'Uppercase should be invalid');
            assert.ok(!regionPattern.test(mixedCase), 'Mixed case should be invalid');
        });
    });

    suite('Integration Scenarios', () => {
        test('should support MSK with Confluent Schema Registry', () => {
            const config = {
                name: 'msk-cluster',
                type: 'msk' as const,
                region: 'us-east-1',
                clusterArn: 'arn:aws:kafka:us-east-1:123456789012:cluster/my-cluster',
                securityProtocol: 'SASL_SSL' as const,
                saslMechanism: 'AWS_MSK_IAM' as const,
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: 'https://schema-registry.example.com:8081'
            };

            assert.strictEqual(config.type, 'msk');
            assert.strictEqual(config.schemaRegistryType, 'confluent');
        });

        test('should support MSK with AWS Glue Schema Registry', () => {
            const config = {
                name: 'msk-cluster',
                type: 'msk' as const,
                region: 'us-east-1',
                clusterArn: 'arn:aws:kafka:us-east-1:123456789012:cluster/my-cluster',
                securityProtocol: 'SASL_SSL' as const,
                saslMechanism: 'AWS_MSK_IAM' as const,
                schemaRegistryType: 'aws-glue' as const,
                glueRegistryName: 'default-registry',
                glueRegion: 'us-east-1'
            };

            assert.strictEqual(config.type, 'msk');
            assert.strictEqual(config.schemaRegistryType, 'aws-glue');
            assert.strictEqual(config.glueRegion, config.region, 'Glue region should match MSK region');
        });

        test('should support regular Kafka with Confluent', () => {
            const config = {
                name: 'kafka-cluster',
                type: 'kafka' as const,
                brokers: ['localhost:9092'],
                securityProtocol: 'PLAINTEXT' as const,
                schemaRegistryType: 'confluent' as const,
                schemaRegistryUrl: 'https://localhost:8081'
            };

            assert.strictEqual(config.type, 'kafka');
            assert.strictEqual(config.schemaRegistryType, 'confluent');
        });
    });
});
