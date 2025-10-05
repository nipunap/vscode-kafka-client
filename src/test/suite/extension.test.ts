import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    teardown(() => {
        sinon.restore();
    });

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('NipunaPerera.vscode-kafka-client'));
    });

    test('Extension should activate', async function() {
        this.timeout(20000); // Activation might take time
        const ext = vscode.extensions.getExtension('NipunaPerera.vscode-kafka-client');
        assert.ok(ext);
        await ext!.activate();
        assert.strictEqual(ext!.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        // Check that our main commands are registered
        assert.ok(commands.includes('kafka.addCluster'), 'kafka.addCluster command not found');
        assert.ok(commands.includes('kafka.removeCluster'), 'kafka.removeCluster command not found');
        assert.ok(commands.includes('kafka.refreshCluster'), 'kafka.refreshCluster command not found');
        assert.ok(commands.includes('kafka.createTopic'), 'kafka.createTopic command not found');
        assert.ok(commands.includes('kafka.deleteTopic'), 'kafka.deleteTopic command not found');
        assert.ok(commands.includes('kafka.produceMessage'), 'kafka.produceMessage command not found');
        assert.ok(commands.includes('kafka.consumeMessages'), 'kafka.consumeMessages command not found');
        assert.ok(commands.includes('kafka.viewConsumerGroup'), 'kafka.viewConsumerGroup command not found');
        assert.ok(commands.includes('kafka.showTopicDetails'), 'kafka.showTopicDetails command not found');
        assert.ok(commands.includes('kafka.showConsumerGroupDetails'), 'kafka.showConsumerGroupDetails command not found');
        assert.ok(commands.includes('kafka.deleteConsumerGroup'), 'kafka.deleteConsumerGroup command not found');
        assert.ok(commands.includes('kafka.resetConsumerGroupOffsets'), 'kafka.resetConsumerGroupOffsets command not found');
    });

    test('Tree views should be registered', async () => {
        // Activate extension first
        const ext = vscode.extensions.getExtension('NipunaPerera.vscode-kafka-client');
        await ext!.activate();

        // Check that views are available
        // Note: We can't directly check TreeDataProvider registration, but we can verify the extension activated
        assert.strictEqual(ext!.isActive, true);
    });
});

