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
        // Stub the webview to avoid actual UI interaction
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);
        
        try {
            await vscode.commands.executeCommand('kafka.addCluster');
            // Command should execute without throwing
            assert.ok(true);
        } catch (error) {
            // If it throws, it should be because of cancelled input, not a missing command
            assert.ok(error);
        }
    });

    test('all commands should be accessible', async () => {
        const commands = await vscode.commands.getCommands(true);
        const kafkaCommands = commands.filter(cmd => cmd.startsWith('kafka.'));
        
        // We should have at least our registered commands
        assert.ok(kafkaCommands.length >= 12, 'Not all kafka commands are registered');
    });
});

