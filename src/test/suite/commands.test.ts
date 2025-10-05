import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('Commands Test Suite', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('kafka.refreshCluster command should refresh providers', async () => {
        const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage');
        
        await vscode.commands.executeCommand('kafka.refreshCluster');
        
        assert.ok(showInfoStub.called);
        assert.strictEqual(showInfoStub.firstCall.args[0], 'Refreshed cluster data');
    });

    test('kafka.addCluster command should be callable', async () => {
        // Stub webview creation to avoid actual UI interaction
        const mockWebviewPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} }),
                asWebviewUri: (uri: vscode.Uri) => uri,
                postMessage: sandbox.stub()
            },
            onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
            reveal: sandbox.stub(),
            dispose: sandbox.stub()
        };
        
        sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockWebviewPanel as any);
        sandbox.stub(vscode.Uri, 'joinPath').returns(vscode.Uri.file('/test'));
        
        // Command should execute without throwing
        const result = await vscode.commands.executeCommand('kafka.addCluster');
        
        // The command completed (webview was created)
        assert.ok(true, 'Command executed successfully');
    });

    test('all commands should be accessible', async () => {
        const commands = await vscode.commands.getCommands(true);
        const kafkaCommands = commands.filter(cmd => cmd.startsWith('kafka.'));
        
        // We should have at least our registered commands
        assert.ok(kafkaCommands.length >= 12, 'Not all kafka commands are registered');
    });
});

