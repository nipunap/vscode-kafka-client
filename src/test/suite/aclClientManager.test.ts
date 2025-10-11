import * as assert from 'assert';
import * as sinon from 'sinon';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import { ACL, ACLConfig } from '../../types/acl';
import { AclResourceTypes, AclOperationTypes, AclPermissionTypes, ResourcePatternTypes } from 'kafkajs';

suite('ACL Client Manager Test Suite', () => {
    let clientManager: KafkaClientManager;
    let sandbox: sinon.SinonSandbox;
    let mockAdmin: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = new KafkaClientManager();

        // Mock admin client
        mockAdmin = {
            describeAcls: sandbox.stub(),
            createAcls: sandbox.stub(),
            deleteAcls: sandbox.stub()
        };

        // Mock getAdmin to return our mock admin
        sandbox.stub(clientManager as any, 'getAdmin').resolves(mockAdmin);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('getACLs', () => {
        test('should fetch ACLs from Kafka and transform them', async () => {
            const mockKafkaACLs = {
                resources: [
                    {
                        resourceType: AclResourceTypes.TOPIC,
                        resourceName: 'test-topic',
                        resourcePatternType: ResourcePatternTypes.LITERAL,
                        acls: [
                            {
                                principal: 'User:testuser',
                                host: '*',
                                operation: AclOperationTypes.READ,
                                permissionType: AclPermissionTypes.ALLOW
                            }
                        ]
                    }
                ]
            };

            mockAdmin.describeAcls.resolves(mockKafkaACLs);

            const acls = await clientManager.getACLs('test-cluster');

            assert.strictEqual(acls.length, 1);
            assert.strictEqual(acls[0].resourceType, 'topic');
            assert.strictEqual(acls[0].resourceName, 'test-topic');
            assert.strictEqual(acls[0].principal, 'User:testuser');
            assert.strictEqual(acls[0].operation, 'Read');
            assert.strictEqual(acls[0].permissionType, 'allow');
        });

        test('should handle multiple ACLs', async () => {
            const mockKafkaACLs = {
                resources: [
                    {
                        resourceType: AclResourceTypes.TOPIC,
                        resourceName: 'test-topic',
                        resourcePatternType: ResourcePatternTypes.LITERAL,
                        acls: [
                            {
                                principal: 'User:user1',
                                host: '*',
                                operation: AclOperationTypes.READ,
                                permissionType: AclPermissionTypes.ALLOW
                            },
                            {
                                principal: 'User:user2',
                                host: '*',
                                operation: AclOperationTypes.WRITE,
                                permissionType: AclPermissionTypes.DENY
                            }
                        ]
                    }
                ]
            };

            mockAdmin.describeAcls.resolves(mockKafkaACLs);

            const acls = await clientManager.getACLs('test-cluster');

            assert.strictEqual(acls.length, 2);
            assert.strictEqual(acls[0].principal, 'User:user1');
            assert.strictEqual(acls[1].principal, 'User:user2');
        });

        test('should handle errors from Kafka admin API', async () => {
            mockAdmin.describeAcls.rejects(new Error('Connection failed'));

            try {
                await clientManager.getACLs('test-cluster');
                assert.fail('Should have thrown an error');
            } catch (error: any) {
                assert.strictEqual(error.message, 'Connection failed');
            }
        });
    });

    suite('createACL', () => {
        test('should create ACL using Kafka admin API', async () => {
            const aclConfig: ACLConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            mockAdmin.createAcls.resolves();

            await clientManager.createACL('test-cluster', aclConfig);

            assert.ok(mockAdmin.createAcls.calledOnce);
            const callArgs = mockAdmin.createAcls.firstCall.args[0];
            assert.strictEqual(callArgs.acl.length, 1);
            assert.strictEqual(callArgs.acl[0].resourceType, AclResourceTypes.TOPIC);
            assert.strictEqual(callArgs.acl[0].resourceName, 'test-topic');
            assert.strictEqual(callArgs.acl[0].principal, 'User:testuser');
            assert.strictEqual(callArgs.acl[0].operation, AclOperationTypes.READ);
            assert.strictEqual(callArgs.acl[0].permissionType, AclPermissionTypes.ALLOW);
        });

        test('should handle different ACL configurations', async () => {
            const configs: ACLConfig[] = [
                {
                    principal: 'User:user1',
                    operation: 'Write',
                    resourceType: 'topic',
                    resourceName: 'topic1',
                    permissionType: 'allow'
                },
                {
                    principal: 'User:user2',
                    operation: 'All',
                    resourceType: 'group',
                    resourceName: 'group1',
                    permissionType: 'deny',
                    host: '192.168.1.1',
                    resourcePatternType: 'PREFIXED'
                }
            ];

            mockAdmin.createAcls.resolves();

            for (const config of configs) {
                await clientManager.createACL('test-cluster', config);
            }

            assert.strictEqual(mockAdmin.createAcls.callCount, 2);
        });

        test('should handle errors from Kafka admin API', async () => {
            const aclConfig: ACLConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            mockAdmin.createAcls.rejects(new Error('Authorization failed'));

            try {
                await clientManager.createACL('test-cluster', aclConfig);
                assert.fail('Should have thrown an error');
            } catch (error: any) {
                assert.strictEqual(error.message, 'Authorization failed');
            }
        });
    });

    suite('deleteACL', () => {
        test('should delete ACL using Kafka admin API', async () => {
            const aclConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic'
            };

            mockAdmin.deleteAcls.resolves({
                filterResponses: [
                    {
                        matchingAcls: [
                            { principal: 'User:testuser' }
                        ]
                    }
                ]
            });

            await clientManager.deleteACL('test-cluster', aclConfig);

            assert.ok(mockAdmin.deleteAcls.calledOnce);
            const callArgs = mockAdmin.deleteAcls.firstCall.args[0];
            assert.strictEqual(callArgs.filters.length, 1);
            assert.strictEqual(callArgs.filters[0].resourceType, AclResourceTypes.TOPIC);
            assert.strictEqual(callArgs.filters[0].resourceName, 'test-topic');
            assert.strictEqual(callArgs.filters[0].principal, 'User:testuser');
        });

        test('should handle errors from Kafka admin API', async () => {
            const aclConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic'
            };

            mockAdmin.deleteAcls.rejects(new Error('Not found'));

            try {
                await clientManager.deleteACL('test-cluster', aclConfig);
                assert.fail('Should have thrown an error');
            } catch (error: any) {
                assert.strictEqual(error.message, 'Not found');
            }
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

    suite('Type Mapping', () => {
        test('should correctly map resource types', async () => {
            const mockKafkaACLs = {
                resources: [
                    {
                        resourceType: AclResourceTypes.TOPIC,
                        resourceName: 'test',
                        resourcePatternType: ResourcePatternTypes.LITERAL,
                        acls: [{
                            principal: 'User:test',
                            host: '*',
                            operation: AclOperationTypes.READ,
                            permissionType: AclPermissionTypes.ALLOW
                        }]
                    },
                    {
                        resourceType: AclResourceTypes.GROUP,
                        resourceName: 'test',
                        resourcePatternType: ResourcePatternTypes.LITERAL,
                        acls: [{
                            principal: 'User:test',
                            host: '*',
                            operation: AclOperationTypes.READ,
                            permissionType: AclPermissionTypes.ALLOW
                        }]
                    }
                ]
            };

            mockAdmin.describeAcls.resolves(mockKafkaACLs);

            const acls = await clientManager.getACLs('test-cluster');

            assert.strictEqual(acls[0].resourceType, 'topic');
            assert.strictEqual(acls[1].resourceType, 'group');
        });

        test('should correctly map operations', async () => {
            const mockKafkaACLs = {
                resources: [
                    {
                        resourceType: AclResourceTypes.TOPIC,
                        resourceName: 'test',
                        resourcePatternType: ResourcePatternTypes.LITERAL,
                        acls: [
                            {
                                principal: 'User:test',
                                host: '*',
                                operation: AclOperationTypes.READ,
                                permissionType: AclPermissionTypes.ALLOW
                            },
                            {
                                principal: 'User:test',
                                host: '*',
                                operation: AclOperationTypes.WRITE,
                                permissionType: AclPermissionTypes.ALLOW
                            },
                            {
                                principal: 'User:test',
                                host: '*',
                                operation: AclOperationTypes.ALL,
                                permissionType: AclPermissionTypes.ALLOW
                            }
                        ]
                    }
                ]
            };

            mockAdmin.describeAcls.resolves(mockKafkaACLs);

            const acls = await clientManager.getACLs('test-cluster');

            assert.strictEqual(acls[0].operation, 'Read');
            assert.strictEqual(acls[1].operation, 'Write');
            assert.strictEqual(acls[2].operation, 'All');
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
