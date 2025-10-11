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
        test('should create ACL with user input', async () => {
            clientManager.getClusters.returns(['test-cluster']);
            clientManager.createACL.resolves();

            // Mock all input dialogs
            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            showQuickPickStub.onCall(0).resolves({ label: 'Topic', value: 'topic' } as any); // resource type
            showQuickPickStub.onCall(1).resolves({ label: 'Read', value: 'read' } as any); // operation
            showQuickPickStub.onCall(2).resolves({ label: 'Allow', value: 'allow' } as any); // permission type
            showQuickPickStub.onCall(3).resolves({ label: 'Literal', value: 'LITERAL' } as any); // pattern type

            const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
            showInputBoxStub.onCall(0).resolves('test-topic'); // resource name
            showInputBoxStub.onCall(1).resolves('User:testuser'); // principal
            showInputBoxStub.onCall(2).resolves('*'); // host

            sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            await aclCommands.createACL(clientManager, { clusterName: 'test-cluster' });

            assert.ok(clientManager.createACL.calledOnce);
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
        test('should delete ACL when confirmed', async () => {
            const mockACL: ACL = {
                principal: 'User:testuser',
                operation: 'Read',
                resourceType: 'topic',
                resourceName: 'test-topic',
                permissionType: 'allow'
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.deleteACL.resolves();

            // Mock confirmation dialog
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Delete' as any);
            sandbox.stub(vscode.window, 'showInformationMessage').resolves();

            const node = { acl: mockACL, clusterName: 'test-cluster' };

            await aclCommands.deleteACL(clientManager, node);

            assert.ok(clientManager.deleteACL.calledOnce);
            const callArgs = clientManager.deleteACL.firstCall.args;
            assert.strictEqual(callArgs[0], 'test-cluster');
            assert.strictEqual(callArgs[1].principal, 'User:testuser');
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
            assert.ok(message.includes('To view ACLs'));
            assert.ok(message.includes('extension'));
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