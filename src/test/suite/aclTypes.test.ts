import * as assert from 'assert';
import { ACL, ACLDetails, ACLConfig } from '../../types/acl';

suite('ACL Types Test Suite', () => {
    suite('ACL Interface', () => {
        test('should create valid ACL object', () => {
            const acl: ACL = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow',
                host: '*',
                resourcePatternType: 'LITERAL'
            };

            assert.strictEqual(acl.principal, 'User:testuser');
            assert.strictEqual(acl.operation, 'Read');
            assert.strictEqual(acl.resourceType, 'topic');
            assert.strictEqual(acl.resourceName, 'test-topic');
            assert.strictEqual(acl.permissionType, 'allow');
            assert.strictEqual(acl.host, '*');
            assert.strictEqual(acl.resourcePatternType, 'LITERAL');
        });

        test('should allow optional fields', () => {
            const acl: ACL = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            assert.strictEqual(acl.principal, 'User:testuser');
            assert.strictEqual(acl.host, undefined);
            assert.strictEqual(acl.resourcePatternType, undefined);
        });

        test('should support all resource types', () => {
            const resourceTypes: ACL['resourceType'][] = ['topic', 'group', 'cluster', 'transactional_id'];
            
            for (const resourceType of resourceTypes) {
                const acl: ACL = {
                    principal: 'User:testuser',
                    operation: 'Read',
                    resourceType,
                    resourceName: 'test-resource',
                    permissionType: 'allow'
                };
                assert.strictEqual(acl.resourceType, resourceType);
            }
        });

        test('should support both permission types', () => {
            const permissionTypes: ACL['permissionType'][] = ['allow', 'deny'];
            
            for (const permissionType of permissionTypes) {
                const acl: ACL = {
                    principal: 'User:testuser',
                    operation: 'Read',
                    resourceType: 'topic',
                    resourceName: 'test-topic',
                    permissionType
                };
                assert.strictEqual(acl.permissionType, permissionType);
            }
        });
    });

    suite('ACLDetails Interface', () => {
        test('should create valid ACLDetails object', () => {
            const details: ACLDetails = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow',
                host: '*',
                resourcePatternType: 'LITERAL',
                description: 'Test ACL description'
            };

            assert.strictEqual(details.principal, 'User:testuser');
            assert.strictEqual(details.operation, 'Read');
            assert.strictEqual(details.resourceType, 'topic');
            assert.strictEqual(details.resourceName, 'test-topic');
            assert.strictEqual(details.permissionType, 'allow');
            assert.strictEqual(details.host, '*');
            assert.strictEqual(details.resourcePatternType, 'LITERAL');
            assert.strictEqual(details.description, 'Test ACL description');
        });
    });

    suite('ACLConfig Interface', () => {
        test('should create valid ACLConfig object', () => {
            const config: ACLConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow',
                host: '*',
                resourcePatternType: 'LITERAL'
            };

            assert.strictEqual(config.principal, 'User:testuser');
            assert.strictEqual(config.operation, 'Read');
            assert.strictEqual(config.resourceType, 'topic');
            assert.strictEqual(config.resourceName, 'test-topic');
            assert.strictEqual(config.permissionType, 'allow');
            assert.strictEqual(config.host, '*');
            assert.strictEqual(config.resourcePatternType, 'LITERAL');
        });

        test('should allow optional fields in ACLConfig', () => {
            const config: ACLConfig = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            assert.strictEqual(config.principal, 'User:testuser');
            assert.strictEqual(config.host, undefined);
            assert.strictEqual(config.resourcePatternType, undefined);
        });
    });
});
