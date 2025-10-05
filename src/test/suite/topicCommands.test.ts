import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as topicCommands from '../../commands/topicCommands';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import { KafkaExplorerProvider } from '../../providers/kafkaExplorerProvider';

suite('Topic Commands Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let clientManager: sinon.SinonStubbedInstance<KafkaClientManager>;
    let provider: sinon.SinonStubbedInstance<KafkaExplorerProvider>;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = sandbox.createStubInstance(KafkaClientManager);
        provider = sandbox.createStubInstance(KafkaExplorerProvider);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('createTopic', () => {
        test('should create topic with valid inputs', async () => {
            const node = { clusterName: 'test-cluster' };

            // Mock user inputs
            sandbox.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves('test-topic')   // topic name
                .onSecondCall().resolves('3')           // partitions
                .onThirdCall().resolves('2');           // replication factor

            clientManager.createTopic.resolves();
            sandbox.stub(vscode.window, 'showInformationMessage');

            await topicCommands.createTopic(clientManager as any, provider as any, node);

            assert.ok(clientManager.createTopic.calledOnce);
            assert.ok(clientManager.createTopic.calledWith('test-cluster', 'test-topic', 3, 2));
            assert.ok(provider.refresh.calledOnce);
        });

        test('should abort if topic name is not provided', async () => {
            const node = { clusterName: 'test-cluster' };

            sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);

            await topicCommands.createTopic(clientManager as any, provider as any, node);

            assert.ok(clientManager.createTopic.notCalled);
        });

        test('should handle topic creation errors', async () => {
            const node = { clusterName: 'test-cluster' };

            sandbox.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves('test-topic')
                .onSecondCall().resolves('1')
                .onThirdCall().resolves('1');

            clientManager.createTopic.rejects(new Error('Topic already exists'));
            const errorStub = sandbox.stub(vscode.window, 'showWarningMessage');

            await topicCommands.createTopic(clientManager as any, provider as any, node);

            assert.ok(errorStub.called);
            assert.ok(errorStub.firstCall.args[0].includes('already exists'));
        });
    });

    suite('deleteTopic', () => {
        test('should delete topic when confirmed', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic', label: 'test-topic' };

            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes' as any);
            clientManager.deleteTopic.resolves();
            sandbox.stub(vscode.window, 'showInformationMessage');

            await topicCommands.deleteTopic(clientManager as any, provider as any, node);

            assert.ok(clientManager.deleteTopic.calledOnce);
            assert.ok(clientManager.deleteTopic.calledWith('test-cluster', 'test-topic'));
            assert.ok(provider.refresh.calledOnce);
        });

        test('should not delete topic when cancelled', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic', label: 'test-topic' };

            sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            await topicCommands.deleteTopic(clientManager as any, provider as any, node);

            assert.ok(clientManager.deleteTopic.notCalled);
        });
    });

    suite('produceMessage', () => {
        test('should produce message with key and value', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic' };

            sandbox.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves('message-key')
                .onSecondCall().resolves('message-value');

            clientManager.produceMessage.resolves();
            sandbox.stub(vscode.window, 'showInformationMessage');

            await topicCommands.produceMessage(clientManager as any, node);

            assert.ok(clientManager.produceMessage.calledOnce);
            assert.ok(clientManager.produceMessage.calledWith('test-cluster', 'test-topic', 'message-key', 'message-value'));
        });

        test('should produce message without key', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic' };

            sandbox.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves(undefined)      // no key
                .onSecondCall().resolves('message-value');

            clientManager.produceMessage.resolves();
            sandbox.stub(vscode.window, 'showInformationMessage');

            await topicCommands.produceMessage(clientManager as any, node);

            assert.ok(clientManager.produceMessage.calledWith('test-cluster', 'test-topic', undefined, 'message-value'));
        });

        test('should not produce if value is not provided', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic' };

            sandbox.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves('key')
                .onSecondCall().resolves(undefined);

            await topicCommands.produceMessage(clientManager as any, node);

            assert.ok(clientManager.produceMessage.notCalled);
        });
    });

    suite('consumeMessages', () => {
        test('should consume messages from beginning', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic' };

            sandbox.stub(vscode.window, 'showQuickPick').resolves('Beginning' as any);
            sandbox.stub(vscode.window, 'showInputBox').resolves('10');

            const messages = [
                { partition: 0, offset: '1', key: Buffer.from('key'), value: Buffer.from('value') }
            ];
            clientManager.consumeMessages.resolves(messages);

            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
            sandbox.stub(vscode.window, 'showTextDocument').resolves({} as any);

            // Mock withProgress to immediately call the callback
            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');
            withProgressStub.callsFake(async (options, task) => {
                return await task({ report: () => {} } as any, {} as any);
            });

            await topicCommands.consumeMessages(clientManager as any, node);

            assert.ok(clientManager.consumeMessages.calledOnce);
            assert.ok(clientManager.consumeMessages.calledWith('test-cluster', 'test-topic', true, 10));
        });

        test('should abort if consumption options are not selected', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic' };

            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

            await topicCommands.consumeMessages(clientManager as any, node);

            assert.ok(clientManager.consumeMessages.notCalled);
        });
    });

    suite('showTopicDetails', () => {
        test('should show topic details successfully', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic' };

            const topicDetails = {
                name: 'test-topic',
                partitions: 3,
                replicationFactor: 2,
                partitionDetails: {},
                configuration: []
            };
            clientManager.getTopicDetails.resolves(topicDetails);

            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
            sandbox.stub(vscode.window, 'showTextDocument').resolves({} as any);

            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');
            withProgressStub.callsFake(async (options, task) => {
                return await task({ report: () => {} } as any, {} as any);
            });

            await topicCommands.showTopicDetails(clientManager as any, node);

            assert.ok(clientManager.getTopicDetails.calledOnce);
            assert.ok(clientManager.getTopicDetails.calledWith('test-cluster', 'test-topic'));
        });

        test('should handle errors when showing topic details', async () => {
            const node = { clusterName: 'test-cluster', topicName: 'test-topic' };

            clientManager.getTopicDetails.rejects(new Error('Topic not found'));
            sandbox.stub(vscode.window, 'showErrorMessage');

            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');
            withProgressStub.callsFake(async (options, task) => {
                return await task({ report: () => {} } as any, {} as any);
            });

            await topicCommands.showTopicDetails(clientManager as any, node);

            // Should handle the error gracefully
            assert.ok(clientManager.getTopicDetails.calledOnce);
        });
    });
});
