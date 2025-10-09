import * as assert from 'assert';
import * as sinon from 'sinon';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import { ACL, ACLConfig } from '../../types/acl';

suite('ACL Client Manager Test Suite', () => {
    let clientManager: KafkaClientManager;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        // Create a real KafkaClientManager instance for testing
        clientManager = new KafkaClientManager();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('getACLs', () => {
        test('should throw error indicating CLI tool requirement', async () => {
            try {
                await clientManager.getACLs('test-cluster');
                assert.fail('Should have thrown an error');
            } catch (_error: any) {
                assert.ok(_error.message.includes('ACL management requires kafka-acls CLI tool'));
                assert.ok(_error.message.includes('Use the ACL Help command for guidance'));
            }
        });

        test('should log debug message about ACL management requirements', async () => {
            const loggerStub = sandbox.stub();
            (clientManager as any).logger = { debug: loggerStub };

            try {
                await clientManager.getACLs('test-cluster');
            } catch (_error) {
                // Expected to throw
            }

            assert.ok(loggerStub.calledOnce);
            const debugMessage = loggerStub.firstCall.args[0];
            assert.ok(debugMessage.includes('ACL management not available'));
        });

        test('should include cluster name in debug log', async () => {
            const loggerStub = sandbox.stub();
            (clientManager as any).logger = { debug: loggerStub };

            try {
                await clientManager.getACLs('test-cluster');
            } catch (_error) {
                // Expected to throw
            }

            assert.ok(loggerStub.calledOnce);
            const debugMessage = loggerStub.firstCall.args[0];
            assert.ok(debugMessage.includes('test-cluster'));
        });
    });

    suite('createACL', () => {
        test('should throw error indicating CLI tool requirement', async () => {
            const aclConfig: ACLConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            try {
                await clientManager.createACL('test-cluster', aclConfig);
                assert.fail('Should have thrown an error');
            } catch (_error: any) {
                assert.ok(_error.message.includes('ACL management requires kafka-acls CLI tool'));
                assert.ok(_error.message.includes('Use the ACL Help command for guidance'));
            }
        });

        test('should log debug message about ACL creation requirements', async () => {
            const loggerStub = sandbox.stub();
            (clientManager as any).logger = { debug: loggerStub };

            const aclConfig: ACLConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            try {
                await clientManager.createACL('test-cluster', aclConfig);
            } catch (_error) {
                // Expected to throw
            }

            assert.ok(loggerStub.calledOnce);
            const debugMessage = loggerStub.firstCall.args[0];
            assert.ok(debugMessage.includes('ACL creation not available'));
        });

        test('should handle different ACL configurations', async () => {
            const configs: ACLConfig[] = [
                {
                    principal: 'User:user1',
                    operation: 'Read',
                    resourceType: 'topic',
                    resourceName: 'topic1',
                    permissionType: 'allow'
                },
                {
                    principal: 'Group:group1',
                    operation: 'Write',
                    resourceType: 'group',
                    resourceName: 'group1',
                    permissionType: 'deny',
                    host: '192.168.1.1',
                    resourcePatternType: 'PREFIXED'
                }
            ];

            for (const config of configs) {
                try {
                    await clientManager.createACL('test-cluster', config);
                    assert.fail('Should have thrown an error');
                } catch (_error: any) {
                    assert.ok(_error.message.includes('ACL management requires kafka-acls CLI tool'));
                }
            }
        });
    });

    suite('deleteACL', () => {
        test('should throw error indicating CLI tool requirement', async () => {
            const aclConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic'
            };

            try {
                await clientManager.deleteACL('test-cluster', aclConfig);
                assert.fail('Should have thrown an error');
            } catch (_error: any) {
                assert.ok(_error.message.includes('ACL management requires kafka-acls CLI tool'));
                assert.ok(_error.message.includes('Use the ACL Help command for guidance'));
            }
        });

        test('should log debug message about ACL deletion requirements', async () => {
            const loggerStub = sandbox.stub();
            (clientManager as any).logger = { debug: loggerStub };

            const aclConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic'
            };

            try {
                await clientManager.deleteACL('test-cluster', aclConfig);
            } catch (_error) {
                // Expected to throw
            }

            assert.ok(loggerStub.calledOnce);
            const debugMessage = loggerStub.firstCall.args[0];
            assert.ok(debugMessage.includes('ACL deletion not available'));
        });
    });

    suite('getACLDetails', () => {
        test('should return formatted ACL details', async () => {
            const mockACL: ACL = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow',
                host: '*',
                resourcePatternType: 'LITERAL'
            };

            const details = await clientManager.getACLDetails('test-cluster', mockACL);

            assert.strictEqual(details.principal, 'User:testuser');
            assert.strictEqual(details.operation, 'Read');
            assert.strictEqual(details.resourceType, 'topic');
            assert.strictEqual(details.resourceName, 'test-topic');
            assert.strictEqual(details.permissionType, 'allow');
            assert.strictEqual(details.host, '*');
            assert.strictEqual(details.resourcePatternType, 'LITERAL');
            assert.ok(details.description);
            assert.ok(details.description.includes('User:testuser'));
            assert.ok(details.description.includes('Read'));
            assert.ok(details.description.includes('test-topic'));
        });

        test('should handle ACL with missing optional fields', async () => {
            const mockACL: ACL = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            const details = await clientManager.getACLDetails('test-cluster', mockACL);

            assert.strictEqual(details.principal, 'User:testuser');
            assert.strictEqual(details.operation, 'Read');
            assert.strictEqual(details.resourceType, 'topic');
            assert.strictEqual(details.resourceName, 'test-topic');
            assert.strictEqual(details.permissionType, 'allow');
            assert.strictEqual(details.host, '*'); // Default value
            assert.strictEqual(details.resourcePatternType, 'LITERAL'); // Default value
        });

        test('should handle ACL with unknown fields', async () => {
            const mockACL: ACL = {
                principal: 'Unknown',
                operation: 'Unknown',
                resourceType: 'topic',
                resourceName: 'Unknown',
                permissionType: 'allow'
            };

            const details = await clientManager.getACLDetails('test-cluster', mockACL);

            assert.strictEqual(details.principal, 'Unknown');
            assert.strictEqual(details.operation, 'Unknown');
            assert.strictEqual(details.resourceType, 'topic');
            assert.strictEqual(details.resourceName, 'Unknown');
            assert.strictEqual(details.permissionType, 'allow');
        });

        test('should generate proper description', async () => {
            const mockACL: ACL = {
                principal: 'User:testuser',
                operation: 'Write',
                resourceType: 'group',
                resourceName: 'test-group',
                permissionType: 'deny',
                host: '192.168.1.1'
            };

            const details = await clientManager.getACLDetails('test-cluster', mockACL);

            assert.ok(details.description.includes('Principal User:testuser'));
            assert.ok(details.description.includes('is denyed to Write'));
            assert.ok(details.description.includes('on test-group'));
            assert.ok(details.description.includes('from host 192.168.1.1'));
        });
    });

    suite('Error Handling', () => {
        test('should handle errors in getACLs gracefully', async () => {
            try {
                await clientManager.getACLs('test-cluster');
                assert.fail('Should have thrown an error');
            } catch (_error: any) {
                assert.ok(_error.message.includes('ACL management requires kafka-acls CLI tool'));
            }
        });

        test('should handle errors in createACL gracefully', async () => {
            const aclConfig: ACLConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            try {
                await clientManager.createACL('test-cluster', aclConfig);
                assert.fail('Should have thrown an error');
            } catch (_error: any) {
                assert.ok(_error.message.includes('ACL management requires kafka-acls CLI tool'));
            }
        });

        test('should handle errors in deleteACL gracefully', async () => {
            const aclConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic'
            };

            try {
                await clientManager.deleteACL('test-cluster', aclConfig);
                assert.fail('Should have thrown an error');
            } catch (_error: any) {
                assert.ok(_error.message.includes('ACL management requires kafka-acls CLI tool'));
            }
        });
    });

    suite('Integration', () => {
        test('should work with all ACL resource types', async () => {
            const resourceTypes: ACL['resourceType'][] = ['topic', 'group', 'cluster', 'transactional_id'];

            for (const resourceType of resourceTypes) {
                const mockACL: ACL = {
                    principal: 'User:testuser',
                    operation: 'Read',
                    resourceType,
                    resourceName: 'test-resource',
                    permissionType: 'allow'
                };

                const details = await clientManager.getACLDetails('test-cluster', mockACL);
                assert.strictEqual(details.resourceType, resourceType);
            }
        });

        test('should work with all permission types', async () => {
            const permissionTypes: ACL['permissionType'][] = ['allow', 'deny'];

            for (const permissionType of permissionTypes) {
                const mockACL: ACL = {
                    principal: 'User:testuser',
                    operation: 'Read',
                    resourceType: 'topic',
                    resourceName: 'test-topic',
                    permissionType
                };

                const details = await clientManager.getACLDetails('test-cluster', mockACL);
                assert.strictEqual(details.permissionType, permissionType);
            }
        });
    });
});
