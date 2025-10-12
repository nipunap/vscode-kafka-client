import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as consumerGroupCommands from '../../commands/consumerGroupCommands';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';

suite('Consumer Group Commands Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let clientManager: sinon.SinonStubbedInstance<KafkaClientManager>;
    let provider: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = sandbox.createStubInstance(KafkaClientManager);
        provider = { refresh: sandbox.stub() };
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('showConsumerGroupDetails', () => {
        test('should show consumer group details successfully', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            const groupDetails = {
                groupId: 'test-group',
                state: 'Stable',
                protocolType: 'consumer',
                protocol: 'range',
                members: [],
                offsets: [],
                totalLag: 0
            };
            clientManager.getConsumerGroupDetails.resolves(groupDetails);

            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
            sandbox.stub(vscode.window, 'showTextDocument').resolves({} as any);

            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');
            withProgressStub.callsFake(async (_options, task) => {
                return await task({ report: () => {} } as any, {} as any);
            });

            await consumerGroupCommands.showConsumerGroupDetails(clientManager as any, node);

            assert.ok(clientManager.getConsumerGroupDetails.calledOnce);
            assert.ok(clientManager.getConsumerGroupDetails.calledWith('test-cluster', 'test-group'));
        });

        test('should handle credential errors', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            clientManager.getConsumerGroupDetails.rejects(new Error('AWS credentials expired'));
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');
            withProgressStub.callsFake(async (_options, task) => {
                return await task({ report: () => {} } as any, {} as any);
            });

            await consumerGroupCommands.showConsumerGroupDetails(clientManager as any, node);

            assert.ok(errorStub.called);
            assert.ok(errorStub.firstCall.args[0].includes('credentials'));
        });
    });

    suite('deleteConsumerGroup', () => {
        test('should delete consumer group when confirmed', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes' as any);
            clientManager.deleteConsumerGroup.resolves();
            sandbox.stub(vscode.window, 'showInformationMessage');

            await consumerGroupCommands.deleteConsumerGroup(clientManager as any, provider, node);

            assert.ok(clientManager.deleteConsumerGroup.calledOnce);
            assert.ok(clientManager.deleteConsumerGroup.calledWith('test-cluster', 'test-group'));
            assert.ok(provider.refresh.calledOnce);
        });

        test('should not delete consumer group when cancelled', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            await consumerGroupCommands.deleteConsumerGroup(clientManager as any, provider, node);

            assert.ok(clientManager.deleteConsumerGroup.notCalled);
        });

        test('should handle error for consumer group with active members', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes' as any);
            clientManager.deleteConsumerGroup.rejects(new Error('GROUP_SUBSCRIBED_TO_TOPIC'));
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await consumerGroupCommands.deleteConsumerGroup(clientManager as any, provider, node);

            assert.ok(errorStub.called);
            assert.ok(errorStub.firstCall.args[0].includes('active members'));
        });
    });

    suite('resetConsumerGroupOffsets', () => {
        test('should reset offsets to beginning', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            sandbox.stub(vscode.window, 'showInputBox').resolves('test-topic');
            sandbox.stub(vscode.window, 'showQuickPick').resolves({
                label: 'Beginning',
                description: 'Reset to earliest offset'
            } as any);
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes' as any);
            clientManager.resetConsumerGroupOffsets.resolves();
            sandbox.stub(vscode.window, 'showInformationMessage');

            await consumerGroupCommands.resetConsumerGroupOffsets(clientManager as any, node);

            assert.ok(clientManager.resetConsumerGroupOffsets.calledOnce);
            assert.ok(clientManager.resetConsumerGroupOffsets.calledWith(
                'test-cluster',
                'test-group',
                'test-topic',
                'beginning',
                undefined
            ));
        });

        test('should reset offsets to end', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            sandbox.stub(vscode.window, 'showInputBox').resolves(''); // Empty = all topics
            sandbox.stub(vscode.window, 'showQuickPick').resolves({
                label: 'End',
                description: 'Reset to latest offset'
            } as any);
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes' as any);
            clientManager.resetConsumerGroupOffsets.resolves();
            sandbox.stub(vscode.window, 'showInformationMessage');

            await consumerGroupCommands.resetConsumerGroupOffsets(clientManager as any, node);

            assert.ok(clientManager.resetConsumerGroupOffsets.calledWith(
                'test-cluster',
                'test-group',
                undefined,
                'end',
                undefined
            ));
        });

        test('should reset offsets to specific offset', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            const inputStub = sandbox.stub(vscode.window, 'showInputBox');
            inputStub.onFirstCall().resolves('test-topic');
            inputStub.onSecondCall().resolves('12345');

            sandbox.stub(vscode.window, 'showQuickPick').resolves({
                label: 'Specific Offset',
                description: 'Reset to a specific offset'
            } as any);
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes' as any);
            clientManager.resetConsumerGroupOffsets.resolves();
            sandbox.stub(vscode.window, 'showInformationMessage');

            await consumerGroupCommands.resetConsumerGroupOffsets(clientManager as any, node);

            assert.ok(clientManager.resetConsumerGroupOffsets.calledWith(
                'test-cluster',
                'test-group',
                'test-topic',
                'specific offset',
                '12345'
            ));
        });

        test('should abort if user cancels', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            sandbox.stub(vscode.window, 'showInputBox').resolves(undefined); // User cancels

            await consumerGroupCommands.resetConsumerGroupOffsets(clientManager as any, node);

            assert.ok(clientManager.resetConsumerGroupOffsets.notCalled);
        });

        test('should not reset if confirmation is declined', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            sandbox.stub(vscode.window, 'showInputBox').resolves('test-topic');
            sandbox.stub(vscode.window, 'showQuickPick').resolves({
                label: 'Beginning',
                description: 'Reset to earliest offset'
            } as any);
            sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            await consumerGroupCommands.resetConsumerGroupOffsets(clientManager as any, node);

            assert.ok(clientManager.resetConsumerGroupOffsets.notCalled);
        });

        test('should handle error for consumer group with active members', async () => {
            const node = { clusterName: 'test-cluster', groupId: 'test-group' };

            sandbox.stub(vscode.window, 'showInputBox').resolves('test-topic');
            sandbox.stub(vscode.window, 'showQuickPick').resolves({
                label: 'Beginning',
                description: 'Reset to earliest offset'
            } as any);
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes' as any);
            clientManager.resetConsumerGroupOffsets.rejects(new Error('GROUP_SUBSCRIBED_TO_TOPIC: active members'));
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await consumerGroupCommands.resetConsumerGroupOffsets(clientManager as any, node);

            assert.ok(errorStub.called);
            assert.ok(errorStub.firstCall.args[0].includes('active members'));
        });
    });
});
