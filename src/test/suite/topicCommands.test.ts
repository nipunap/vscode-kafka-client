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
            // Now uses ErrorHandler which calls showErrorMessage
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await topicCommands.createTopic(clientManager as any, provider as any, node);

            assert.ok(errorStub.called);
            assert.ok(errorStub.firstCall.args[0].includes('Creating topic'));
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
        // Old produceMessage and consumeMessages functions removed in v0.6.0
        // Replaced by advanced producer webview (kafka.produceMessage) and streaming consumer (kafka.consumeMessages)
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
            withProgressStub.callsFake(async (_options, task) => {
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
            withProgressStub.callsFake(async (_options, task) => {
                return await task({ report: () => {} } as any, {} as any);
            });

            await topicCommands.showTopicDetails(clientManager as any, node);

            // Should handle the error gracefully
            assert.ok(clientManager.getTopicDetails.calledOnce);
        });
    });
});
