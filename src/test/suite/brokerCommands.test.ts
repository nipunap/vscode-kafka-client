import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import * as brokerCommands from '../../commands/brokerCommands';

suite('Broker Commands Test Suite', () => {
    let clientManager: KafkaClientManager;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        clientManager = new KafkaClientManager();
        sandbox = sinon.createSandbox();
    });

    teardown(async () => {
        sandbox.restore();
        await clientManager.dispose();
    });

    suite('showBrokerDetails', () => {
        test('should show broker details successfully', async () => {
            const mockDetails = {
                nodeId: 1,
                host: 'broker-1.example.com',
                port: 9092,
                rack: 'us-east-1a',
                configuration: [
                    { configName: 'log.dirs', configValue: '/kafka/data', isDefault: false, configSource: 'STATIC_BROKER_CONFIG' }
                ]
            };

            sandbox.stub(clientManager, 'getBrokerDetails').resolves(mockDetails);

            const openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
            const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves({} as any);
            const withProgressStub = sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: any, task: any) => {
                return await task({ report: () => {} }, { isCancellationRequested: false });
            });

            const node = {
                clusterName: 'test-cluster',
                brokerId: 1
            };

            await brokerCommands.showBrokerDetails(clientManager, node);

            assert.ok(withProgressStub.calledOnce);
            assert.ok(openTextDocumentStub.calledOnce);
            assert.ok(showTextDocumentStub.calledOnce);

            const openCall = openTextDocumentStub.firstCall.args[0];
            assert.ok(openCall);
            assert.ok(openCall.content);
            assert.ok(openCall.content.includes('broker-1.example.com'));
            assert.ok(openCall.content.includes('9092'));
            assert.strictEqual(openCall.language, 'yaml');
        });

        test('should handle errors when showing broker details', async () => {
            sandbox.stub(clientManager, 'getBrokerDetails').rejects(new Error('Connection failed'));

            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: any, task: any) => {
                return await task({ report: () => {} }, { isCancellationRequested: false });
            });

            const node = {
                clusterName: 'test-cluster',
                brokerId: 1
            };

            await brokerCommands.showBrokerDetails(clientManager, node);

            assert.ok(showErrorStub.calledOnce);
            assert.ok(showErrorStub.firstCall.args[0].includes('Connection failed'));
        });

        test('should handle credential errors', async () => {
            sandbox.stub(clientManager, 'getBrokerDetails').rejects(new Error('AWS credentials expired'));

            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: any, task: any) => {
                return await task({ report: () => {} }, { isCancellationRequested: false });
            });

            const node = {
                clusterName: 'test-cluster',
                brokerId: 1
            };

            await brokerCommands.showBrokerDetails(clientManager, node);

            assert.ok(showErrorStub.calledOnce);
            assert.ok(showErrorStub.firstCall.args[0].includes('credentials'));
        });
    });

    suite('findBroker', () => {
        test('should show info message when no clusters configured', async () => {
            sandbox.stub(clientManager, 'getClusters').returns([]);
            const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            await brokerCommands.findBroker(clientManager);

            assert.ok(showInfoStub.calledOnce);
            assert.ok(showInfoStub.firstCall.args[0].includes('No clusters'));
        });

        test('should search brokers in single cluster', async () => {
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);
            sandbox.stub(clientManager, 'getBrokers').resolves([
                { nodeId: 1, host: 'broker-1.example.com', port: 9092, rack: 'us-east-1a' },
                { nodeId: 2, host: 'broker-2.example.com', port: 9092, rack: 'us-east-1b' }
            ]);

            const withProgressStub = sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: any, task: any) => {
                return await task({ report: () => {} }, { isCancellationRequested: false });
            });

            const quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves({
                label: 'Broker 1',
                broker: { nodeId: 1, host: 'broker-1.example.com', port: 9092, rack: 'us-east-1a' }
            } as any);

            sandbox.stub(clientManager, 'getBrokerDetails').resolves({
                nodeId: 1,
                host: 'broker-1.example.com',
                port: 9092,
                rack: 'us-east-1a',
                configuration: []
            });

            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
            sandbox.stub(vscode.window, 'showTextDocument').resolves({} as any);

            await brokerCommands.findBroker(clientManager);

            // withProgress is called twice: once for finding brokers, once for showing details
            assert.ok(withProgressStub.called);
            assert.ok(quickPickStub.calledOnce);
        });

        test('should abort if user cancels broker selection', async () => {
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);
            sandbox.stub(clientManager, 'getBrokers').resolves([
                { nodeId: 1, host: 'broker-1.example.com', port: 9092, rack: null }
            ]);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: any, task: any) => {
                return await task({ report: () => {} }, { isCancellationRequested: false });
            });

            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

            const getBrokerDetailsStub = sandbox.stub(clientManager, 'getBrokerDetails');

            await brokerCommands.findBroker(clientManager);

            assert.ok(!getBrokerDetailsStub.called);
        });

        test('should handle errors during broker search', async () => {
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);
            sandbox.stub(clientManager, 'getBrokers').rejects(new Error('Connection timeout'));

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: any, task: any) => {
                return await task({ report: () => {} }, { isCancellationRequested: false });
            });

            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

            await brokerCommands.findBroker(clientManager);

            assert.ok(showErrorStub.calledOnce);
            assert.ok(showErrorStub.firstCall.args[0].includes('Failed to search brokers'));
        });

        test('should show message when no brokers found', async () => {
            sandbox.stub(clientManager, 'getClusters').returns(['test-cluster']);
            sandbox.stub(clientManager, 'getBrokers').resolves([]);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: any, task: any) => {
                return await task({ report: () => {} }, { isCancellationRequested: false });
            });

            const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            await brokerCommands.findBroker(clientManager);

            assert.ok(showInfoStub.calledOnce);
            assert.ok(showInfoStub.firstCall.args[0].includes('No brokers found'));
        });

        test('should allow cluster selection when multiple clusters exist', async () => {
            sandbox.stub(clientManager, 'getClusters').returns(['cluster-1', 'cluster-2']);
            sandbox.stub(clientManager, 'getBrokers').resolves([
                { nodeId: 1, host: 'broker-1.example.com', port: 9092, rack: null }
            ]);

            const quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves('cluster-1' as any);
            quickPickStub.onSecondCall().resolves(undefined);

            sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: any, task: any) => {
                return await task({ report: () => {} }, { isCancellationRequested: false });
            });

            await brokerCommands.findBroker(clientManager);

            assert.strictEqual(quickPickStub.callCount, 2);
            const firstCallArgs = quickPickStub.firstCall.args[0];
            assert.ok(Array.isArray(firstCallArgs));
        });
    });
});
