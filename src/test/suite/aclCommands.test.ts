import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import * as aclCommands from '../../commands/aclCommands';
import { ACL } from '../../types/acl';

suite('ACL Commands Test Suite', () => {
    let clientManager: sinon.SinonStubbedInstance<KafkaClientManager>;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = sandbox.createStubInstance(KafkaClientManager);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('showACLDetails', () => {
        test('should show ACL details successfully', async () => {
            const mockACL: ACL = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            const mockACLDetails = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow',
                host: '*',
                resourcePatternType: 'LITERAL',
                description: 'Test ACL description'
            };

            clientManager.getACLDetails.resolves(mockACLDetails);
            sandbox.stub(vscode.window, 'showTextDocument').resolves();
            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);

            const node = {
                clusterName: 'test-cluster',
                acl: mockACL
            };

            await aclCommands.showACLDetails(clientManager, node);

            assert.ok(clientManager.getACLDetails.calledOnceWith('test-cluster', mockACL));
        });

        test('should handle errors gracefully', async () => {
            clientManager.getACLDetails.rejects(new Error('ACL details failed'));

            const node = {
                clusterName: 'test-cluster',
                acl: {} as ACL
            };

            // Should not throw
            await aclCommands.showACLDetails(clientManager, node);
        });
    });

    suite('createACL', () => {
        test('should show ACL management message', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            await aclCommands.createACL(clientManager, {});

            assert.ok(showInformationMessageStub.calledOnce);
            const message = showInformationMessageStub.firstCall.args[0];
            assert.ok(message.includes('ACL management requires'));
            assert.ok(message.includes('kafka-acls command line tool'));
        });

        test('should handle open documentation action', async () => {
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Open Documentation' as any);

            await aclCommands.createACL(clientManager, {});

            // Test passes if no error is thrown
            assert.ok(true);
        });

        test('should handle copy command action', async () => {
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Copy Command' as any);
            sandbox.stub(vscode.env, 'clipboard').value({ writeText: sandbox.stub().resolves() });

            await aclCommands.createACL(clientManager, {});

            // Test passes if no error is thrown
            assert.ok(true);
        });

        test('should handle errors gracefully', async () => {
            sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            // Should not throw
            await aclCommands.createACL(clientManager, {});
            
            assert.ok(true);
        });
    });

    suite('deleteACL', () => {
        test('should show delete message for valid ACL', async () => {
            const mockACL: ACL = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            const node = { acl: mockACL };

            await aclCommands.deleteACL(clientManager, node);

            assert.ok(showInformationMessageStub.calledOnce);
            const message = showInformationMessageStub.firstCall.args[0];
            assert.ok(message.includes('kafka-acls --bootstrap-server'));
            assert.ok(message.includes('--remove'));
            assert.ok(message.includes('User:testuser'));
        });

        test('should show error for missing ACL', async () => {
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves();

            const node = { acl: undefined };

            await aclCommands.deleteACL(clientManager, node);

            assert.ok(showErrorMessageStub.calledOnce);
            assert.strictEqual(showErrorMessageStub.firstCall.args[0], 'No ACL selected for deletion');
        });

        test('should handle errors gracefully', async () => {
            sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            const node = { acl: {} as ACL };

            // Should not throw
            await aclCommands.deleteACL(clientManager, node);
            
            assert.ok(true);
        });
    });

    suite('findACL', () => {
        test('should show search message when clusters exist', async () => {
            clientManager.getClusters.returns(['cluster1', 'cluster2']);

            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            await aclCommands.findACL(clientManager);

            assert.ok(showInformationMessageStub.calledOnce);
            const message = showInformationMessageStub.firstCall.args[0];
            assert.ok(message.includes('To search for ACLs'));
            assert.ok(message.includes('kafka-acls command line tool'));
        });

        test('should show no clusters message when no clusters', async () => {
            clientManager.getClusters.returns([]);

            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            await aclCommands.findACL(clientManager);

            assert.ok(showInformationMessageStub.calledOnce);
            assert.strictEqual(showInformationMessageStub.firstCall.args[0], 'No clusters configured');
        });

        test('should handle copy command action', async () => {
            clientManager.getClusters.returns(['cluster1']);
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Copy Command' as any);
            sandbox.stub(vscode.env, 'clipboard').value({ writeText: sandbox.stub().resolves() });

            await aclCommands.findACL(clientManager);

            // Test passes if no error is thrown
            assert.ok(true);
        });

        test('should handle errors gracefully', async () => {
            clientManager.getClusters.throws(new Error('Client manager error'));

            // Should not throw
            await aclCommands.findACL(clientManager);
        });
    });

    suite('showACLHelp', () => {
        test('should show ACL help content', async () => {
            const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves();
            const openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);

            await aclCommands.showACLHelp(clientManager);

            assert.ok(openTextDocumentStub.calledOnce);
            const call = openTextDocumentStub.firstCall;
            assert.ok(call);
            assert.ok(call.args[0]);
            assert.strictEqual(call.args[0].language, 'html');
            assert.ok(call.args[0].content && call.args[0].content.includes('<h1>🔐 Kafka ACL Management</h1>'));
            assert.ok(showTextDocumentStub.calledOnce);
        });

        test('should handle errors gracefully', async () => {
            sandbox.stub(vscode.workspace, 'openTextDocument').throws(new Error('Document error'));

            // Should not throw
            await aclCommands.showACLHelp(clientManager);
            
            assert.ok(true);
        });
    });

    suite('Integration', () => {
        test('should work with real ACL objects', async () => {
            const realACL: ACL = {
                principal: 'User:realuser',
                operation: 'Write',
                resourceType: 'group',
                resourceName: 'real-group',
                permissionType: 'deny',
                host: '192.168.1.1',
                resourcePatternType: 'PREFIXED'
            };

            const mockACLDetails = {
                principal: 'User:realuser',
                operation: 'Write',
                resourceType: 'group',
                resourceName: 'real-group',
                permissionType: 'deny',
                host: '192.168.1.1',
                resourcePatternType: 'PREFIXED',
                description: 'Real ACL description'
            };

            clientManager.getACLDetails.resolves(mockACLDetails);

            sandbox.stub(vscode.window, 'showTextDocument').resolves();
            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);

            const node = {
                clusterName: 'real-cluster',
                acl: realACL
            };

            await aclCommands.showACLDetails(clientManager, node);

            assert.ok(clientManager.getACLDetails.calledOnceWith('real-cluster', realACL));
        });
    });
});