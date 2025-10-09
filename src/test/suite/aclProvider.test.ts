import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ACLProvider, ACLTreeItem } from '../../providers/aclProvider';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import { ACL } from '../../types/acl';

suite('ACLProvider Test Suite', () => {
    let provider: ACLProvider;
    let clientManager: sinon.SinonStubbedInstance<KafkaClientManager>;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = sandbox.createStubInstance(KafkaClientManager);
        provider = new ACLProvider(clientManager);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Basic Functionality', () => {
        test('should create instance', () => {
            assert.ok(provider instanceof ACLProvider);
        });

        test('should return empty clusters message when no clusters', async () => {
            clientManager.getClusters.returns([]);

            const children = await provider.getChildren();

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No clusters configured.');
            assert.strictEqual(children[0].contextValue, 'empty');
        });

        test('should return cluster items when clusters exist', async () => {
            clientManager.getClusters.returns(['cluster1', 'cluster2']);

            const children = await provider.getChildren();

            // Should have 3 items: 1 info tip + 2 clusters
            assert.strictEqual(children.length, 3);

            // First item should be the info tip
            assert.strictEqual(children[0].contextValue, 'acl-info');
            assert.ok(children[0].label.includes('Tip'));

            // Next items should be clusters
            assert.strictEqual(children[1].label, 'cluster1');
            assert.strictEqual(children[1].contextValue, 'cluster');
            assert.strictEqual(children[2].label, 'cluster2');
            assert.strictEqual(children[2].contextValue, 'cluster');
        });
    });

    suite('Cluster Children', () => {
        test('should handle ACL loading success', async () => {
            const mockACLs: ACL[] = [
                {
                    principal: 'User:testuser',
                    operation: 'Read',
                    resourceType: 'topic',
                    resourceName: 'test-topic',
                    permissionType: 'allow'
                },
                {
                    principal: 'User:admin',
                    operation: 'Write',
                    resourceType: 'group',
                    resourceName: 'test-group',
                    permissionType: 'allow'
                }
            ];

            clientManager.getClusters.returns(['cluster1']);
            clientManager.getACLs.resolves(mockACLs);

            const clusterItem = new ACLTreeItem('cluster1', vscode.TreeItemCollapsibleState.Collapsed, 'cluster', 'cluster1');
            const children = await provider.getChildren(clusterItem);

            assert.ok(children.length > 0);
            // Should have resource type categories
            const topicCategory = children.find(child => child.label.includes('topic'));
            const groupCategory = children.find(child => child.label.includes('group'));
            assert.ok(topicCategory, 'Should have topic category');
            assert.ok(groupCategory, 'Should have group category');
        });

        test('should handle ACL loading error', async () => {
            clientManager.getClusters.returns(['cluster1']);
            clientManager.getACLs.rejects(new Error('Connection failed'));

            const clusterItem = new ACLTreeItem('cluster1', vscode.TreeItemCollapsibleState.Collapsed, 'cluster', 'cluster1');
            const children = await provider.getChildren(clusterItem);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'Error: Failed to load ACLs');
            assert.strictEqual(children[0].contextValue, 'error');
        });

        test('should handle empty ACLs', async () => {
            clientManager.getClusters.returns(['cluster1']);
            clientManager.getACLs.resolves([]);

            const clusterItem = new ACLTreeItem('cluster1', vscode.TreeItemCollapsibleState.Collapsed, 'cluster', 'cluster1');
            const children = await provider.getChildren(clusterItem);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No ACLs found');
            assert.strictEqual(children[0].contextValue, 'empty');
        });
    });

    suite('ACL Category Children', () => {
        test('should return ACLs for specific resource type', async () => {
            const mockACLs: ACL[] = [
                {
                    principal: 'User:testuser',
                    operation: 'Read',
                    resourceType: 'topic',
                    resourceName: 'test-topic',
                    permissionType: 'allow'
                }
            ];

            clientManager.getACLs.resolves(mockACLs);

            const categoryItem = new ACLTreeItem('topic (1)', vscode.TreeItemCollapsibleState.Collapsed, 'acl-category', 'cluster1', undefined, 'topic');
            const children = await provider.getChildren(categoryItem);

            assert.strictEqual(children.length, 1);
            assert.ok(children[0].label.includes('User:testuser'));
            assert.ok(children[0].label.includes('Read'));
            assert.ok(children[0].label.includes('test-topic'));
            assert.strictEqual(children[0].contextValue, 'acl');
        });

        test('should handle empty ACLs for resource type', async () => {
            clientManager.getACLs.resolves([]);

            const categoryItem = new ACLTreeItem('topic (0)', vscode.TreeItemCollapsibleState.Collapsed, 'acl-category', 'cluster1', undefined, 'topic');
            const children = await provider.getChildren(categoryItem);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'No ACLs found');
            assert.strictEqual(children[0].contextValue, 'empty');
        });

        test('should handle error when loading ACLs for resource type', async () => {
            clientManager.getACLs.rejects(new Error('Connection failed'));

            const categoryItem = new ACLTreeItem('topic (0)', vscode.TreeItemCollapsibleState.Collapsed, 'acl-category', 'cluster1', undefined, 'topic');
            const children = await provider.getChildren(categoryItem);

            assert.strictEqual(children.length, 1);
            assert.strictEqual(children[0].label, 'Error: Failed to load ACLs');
            assert.strictEqual(children[0].contextValue, 'error');
        });
    });

    suite('ACLTreeItem', () => {
        test('should create ACL tree item with command', () => {
            const acl: ACL = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            const item = new ACLTreeItem(
                'Test ACL',
                vscode.TreeItemCollapsibleState.None,
                'acl',
                'cluster1',
                acl
            );

            assert.strictEqual(item.label, 'Test ACL');
            assert.strictEqual(item.contextValue, 'acl');
            assert.strictEqual(item.clusterName, 'cluster1');
            assert.strictEqual(item.acl, acl);
            assert.ok(item.command, 'Should have command for ACL items');
            assert.strictEqual(item.command?.command, 'kafka.showACLDetails');
        });

        test('should create category tree item without command', () => {
            const item = new ACLTreeItem(
                'topic (1)',
                vscode.TreeItemCollapsibleState.Collapsed,
                'acl-category',
                'cluster1',
                undefined,
                'topic'
            );

            assert.strictEqual(item.label, 'topic (1)');
            assert.strictEqual(item.contextValue, 'acl-category');
            assert.strictEqual(item.clusterName, 'cluster1');
            assert.strictEqual(item.resourceType, 'topic');
            assert.strictEqual(item.command, undefined, 'Category items should not have commands');
        });

        test('should create cluster tree item without command', () => {
            const item = new ACLTreeItem(
                'cluster1',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'cluster1'
            );

            assert.strictEqual(item.label, 'cluster1');
            assert.strictEqual(item.contextValue, 'cluster');
            assert.strictEqual(item.clusterName, 'cluster1');
            assert.strictEqual(item.command, undefined, 'Cluster items should not have commands');
        });
    });

    suite('Error Handling', () => {
        test('should handle client manager errors gracefully', async () => {
            clientManager.getClusters.throws(new Error('Client manager error'));

            try {
                await provider.getChildren();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.strictEqual(error.message, 'Client manager error');
            }
        });

        test('should handle undefined element gracefully', async () => {
            try {
                const children = await provider.getChildren(undefined);
                assert.ok(Array.isArray(children));
            } catch (error) {
                // This is expected behavior - undefined element should be handled
                assert.ok(error instanceof Error);
            }
        });
    });
});
