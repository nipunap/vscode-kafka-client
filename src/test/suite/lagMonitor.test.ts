import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { LagMonitor } from '../../services/LagMonitor';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';
import { EventBus, KafkaEvents } from '../../infrastructure/EventBus';

suite('LagMonitor Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let clientManager: sinon.SinonStubbedInstance<KafkaClientManager>;
    let eventBus: EventBus;
    let lagMonitor: LagMonitor;
    let mockConfig: sinon.SinonStubbedInstance<vscode.WorkspaceConfiguration>;

    setup(() => {
        sandbox = sinon.createSandbox();
        clientManager = sandbox.createStubInstance(KafkaClientManager);
        eventBus = new EventBus();

        // Mock workspace configuration
        mockConfig = {
            get: sandbox.stub()
        } as any;

        sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);

        lagMonitor = new LagMonitor(clientManager as any, eventBus);
    });

    teardown(() => {
        lagMonitor.stop();
        sandbox.restore();
    });

    suite('Start and Stop', () => {
        test('should not start when disabled', () => {
            mockConfig.get.withArgs('enabled', false).returns(false);

            lagMonitor.start();

            // Should not set up interval
            assert.ok(!(lagMonitor as any).intervalHandle, 'Should not create interval when disabled');
        });

        test('should start when enabled', () => {
            mockConfig.get.withArgs('enabled', false).returns(true);
            mockConfig.get.withArgs('pollIntervalSeconds', 30).returns(30);
            clientManager.getClusters.returns([]);

            lagMonitor.start();

            assert.ok((lagMonitor as any).intervalHandle, 'Should create interval when enabled');
        });

        test('should stop monitoring', () => {
            mockConfig.get.withArgs('enabled', false).returns(true);
            mockConfig.get.withArgs('pollIntervalSeconds', 30).returns(30);
            clientManager.getClusters.returns([]);

            lagMonitor.start();
            const intervalHandle = (lagMonitor as any).intervalHandle;
            assert.ok(intervalHandle, 'Should have interval handle');

            lagMonitor.stop();
            assert.strictEqual((lagMonitor as any).intervalHandle, null, 'Should clear interval handle');
        });
    });

    suite('Lag Calculation', () => {
        test('should calculate lag for consumer group', async () => {
            const mockAdmin = {
                fetchOffsets: sandbox.stub().resolves([
                    {
                        topic: 'test-topic',
                        partitions: [
                            { partition: 0, offset: '100' }
                        ]
                    }
                ]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '150', low: '0' }
                ])
            };

            clientManager.getAdminClient.resolves(mockAdmin as any);

            const lag = await lagMonitor.getConsumerGroupLag('test-cluster', 'test-group');

            assert.strictEqual(lag.length, 1, 'Should return lag for one partition');
            assert.strictEqual(lag[0].groupId, 'test-group');
            assert.strictEqual(lag[0].topic, 'test-topic');
            assert.strictEqual(lag[0].partition, 0);
            assert.strictEqual(lag[0].lag, 50, 'Should calculate lag correctly (150 - 100)');
        });

        test('should handle multiple partitions', async () => {
            const mockAdmin = {
                fetchOffsets: sandbox.stub().resolves([
                    {
                        topic: 'test-topic',
                        partitions: [
                            { partition: 0, offset: '100' },
                            { partition: 1, offset: '200' }
                        ]
                    }
                ]),
                fetchTopicOffsets: sandbox.stub()
                    .onFirstCall().resolves([{ partition: 0, high: '150', low: '0' }])
                    .onSecondCall().resolves([{ partition: 1, high: '250', low: '0' }])
            };

            clientManager.getAdminClient.resolves(mockAdmin as any);

            const lag = await lagMonitor.getConsumerGroupLag('test-cluster', 'test-group');

            assert.strictEqual(lag.length, 2, 'Should return lag for two partitions');
            assert.strictEqual(lag[0].lag, 50, 'Partition 0 lag should be 50');
            assert.strictEqual(lag[1].lag, 50, 'Partition 1 lag should be 50');
        });

        test('should handle zero lag', async () => {
            const mockAdmin = {
                fetchOffsets: sandbox.stub().resolves([
                    {
                        topic: 'test-topic',
                        partitions: [
                            { partition: 0, offset: '100' }
                        ]
                    }
                ]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '100', low: '0' }
                ])
            };

            clientManager.getAdminClient.resolves(mockAdmin as any);

            const lag = await lagMonitor.getConsumerGroupLag('test-cluster', 'test-group');

            assert.strictEqual(lag[0].lag, 0, 'Should return zero lag when caught up');
        });
    });

    suite('Alert Thresholds', () => {
        test('should trigger warning alert at threshold', async () => {
            mockConfig.get.withArgs('enabled', false).returns(true);
            mockConfig.get.withArgs('pollIntervalSeconds', 30).returns(1); // Fast polling for test
            mockConfig.get.withArgs('warningThreshold', 1000).returns(1000);
            mockConfig.get.withArgs('criticalThreshold', 10000).returns(10000);

            const mockAdmin = {
                listGroups: sandbox.stub().resolves({
                    groups: [{ groupId: 'test-group' }]
                }),
                fetchOffsets: sandbox.stub().resolves([
                    {
                        topic: 'test-topic',
                        partitions: [{ partition: 0, offset: '0' }]
                    }
                ]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '1500', low: '0' }
                ])
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            const showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            // Manually trigger check
            await (lagMonitor as any).checkClusterLag('test-cluster');

            assert.ok(showWarningStub.called, 'Should show warning message');
            const message = showWarningStub.firstCall.args[0];
            assert.ok(message.includes('Warning'), 'Should indicate warning severity');
            assert.ok(message.includes('test-group'), 'Should include group ID');
        });

        test('should trigger critical alert at threshold', async () => {
            mockConfig.get.withArgs('enabled', false).returns(true);
            mockConfig.get.withArgs('warningThreshold', 1000).returns(1000);
            mockConfig.get.withArgs('criticalThreshold', 10000).returns(10000);

            const mockAdmin = {
                listGroups: sandbox.stub().resolves({
                    groups: [{ groupId: 'test-group' }]
                }),
                fetchOffsets: sandbox.stub().resolves([
                    {
                        topic: 'test-topic',
                        partitions: [{ partition: 0, offset: '0' }]
                    }
                ]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '15000', low: '0' }
                ])
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

            await (lagMonitor as any).checkClusterLag('test-cluster');

            assert.ok(showErrorStub.called, 'Should show error message');
            const message = showErrorStub.firstCall.args[0];
            assert.ok(message.includes('Critical'), 'Should indicate critical severity');
        });

        test('should not alert when below threshold', async () => {
            mockConfig.get.withArgs('warningThreshold', 1000).returns(1000);
            mockConfig.get.withArgs('criticalThreshold', 10000).returns(10000);

            const mockAdmin = {
                listGroups: sandbox.stub().resolves({
                    groups: [{ groupId: 'test-group' }]
                }),
                fetchOffsets: sandbox.stub().resolves([
                    {
                        topic: 'test-topic',
                        partitions: [{ partition: 0, offset: '0' }]
                    }
                ]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '500', low: '0' }
                ])
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            const showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage');
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await (lagMonitor as any).checkClusterLag('test-cluster');

            assert.ok(!showWarningStub.called, 'Should not show warning');
            assert.ok(!showErrorStub.called, 'Should not show error');
        });
    });

    suite('Alert Throttling (SEC-3.2-1)', () => {
        test('should throttle alerts (max 1 per 5 minutes)', async () => {
            mockConfig.get.withArgs('warningThreshold', 1000).returns(1000);
            mockConfig.get.withArgs('criticalThreshold', 10000).returns(10000);

            const mockAdmin = {
                listGroups: sandbox.stub().resolves({
                    groups: [{ groupId: 'test-group' }]
                }),
                fetchOffsets: sandbox.stub().resolves([
                    {
                        topic: 'test-topic',
                        partitions: [{ partition: 0, offset: '0' }]
                    }
                ]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '1500', low: '0' }
                ])
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            const showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            // First alert should go through
            await (lagMonitor as any).checkClusterLag('test-cluster');
            assert.strictEqual(showWarningStub.callCount, 1, 'First alert should be sent');

            // Second alert within 5 minutes should be throttled
            await (lagMonitor as any).checkClusterLag('test-cluster');
            assert.strictEqual(showWarningStub.callCount, 1, 'Second alert should be throttled');

            // Simulate time passing (5 minutes + 1ms)
            const lastAlertTime = (lagMonitor as any).lastAlertTime;
            lastAlertTime.set('test-cluster', Date.now() - (5 * 60 * 1000 + 1));

            // Third alert after throttle period should go through
            await (lagMonitor as any).checkClusterLag('test-cluster');
            assert.strictEqual(showWarningStub.callCount, 2, 'Alert after throttle period should be sent');
        });
    });

    suite('Alert Aggregation (SEC-3.2-2)', () => {
        test('should aggregate multiple groups into single alert', async () => {
            mockConfig.get.withArgs('warningThreshold', 1000).returns(1000);
            mockConfig.get.withArgs('criticalThreshold', 10000).returns(10000);

            const mockAdmin = {
                listGroups: sandbox.stub().resolves({
                    groups: [
                        { groupId: 'group-1' },
                        { groupId: 'group-2' },
                        { groupId: 'group-3' }
                    ]
                }),
                fetchOffsets: sandbox.stub()
                    .onFirstCall().resolves([{ topic: 'test-topic', partitions: [{ partition: 0, offset: '0' }] }])
                    .onSecondCall().resolves([{ topic: 'test-topic', partitions: [{ partition: 0, offset: '0' }] }])
                    .onThirdCall().resolves([{ topic: 'test-topic', partitions: [{ partition: 0, offset: '0' }] }]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '1500', low: '0' }
                ])
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            const showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            await (lagMonitor as any).checkClusterLag('test-cluster');

            assert.strictEqual(showWarningStub.callCount, 1, 'Should send single aggregated alert');
            const message = showWarningStub.firstCall.args[0];
            assert.ok(message.includes('3 groups'), 'Should show count of affected groups');
            assert.ok(message.includes('group-1'), 'Should list first group');
            assert.ok(message.includes('group-2'), 'Should list second group');
            assert.ok(message.includes('group-3'), 'Should list third group');
        });

        test('should limit displayed groups to 3 + "and X more"', async () => {
            mockConfig.get.withArgs('warningThreshold', 1000).returns(1000);
            mockConfig.get.withArgs('criticalThreshold', 10000).returns(10000);

            const mockAdmin = {
                listGroups: sandbox.stub().resolves({
                    groups: Array.from({ length: 5 }, (_, i) => ({ groupId: `group-${i}` }))
                }),
                fetchOffsets: sandbox.stub().resolves([
                    { topic: 'test-topic', partitions: [{ partition: 0, offset: '0' }] }
                ]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '1500', low: '0' }
                ])
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            const showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            await (lagMonitor as any).checkClusterLag('test-cluster');

            const message = showWarningStub.firstCall.args[0];
            assert.ok(message.includes('5 groups'), 'Should show total count');
            assert.ok(message.includes('and 2 more'), 'Should indicate additional groups');
        });
    });

    suite('Telemetry Events', () => {
        test('should emit LAG_ALERT_SENT event', async () => {
            mockConfig.get.withArgs('warningThreshold', 1000).returns(1000);
            mockConfig.get.withArgs('criticalThreshold', 10000).returns(10000);

            const mockAdmin = {
                listGroups: sandbox.stub().resolves({
                    groups: [{ groupId: 'test-group' }]
                }),
                fetchOffsets: sandbox.stub().resolves([
                    { topic: 'test-topic', partitions: [{ partition: 0, offset: '0' }] }
                ]),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '1500', low: '0' }
                ])
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            let eventEmitted = false;
            let eventData: any;
            eventBus.on(KafkaEvents.LAG_ALERT_SENT, (data) => {
                eventEmitted = true;
                eventData = data;
            });

            await (lagMonitor as any).checkClusterLag('test-cluster');

            assert.ok(eventEmitted, 'Should emit LAG_ALERT_SENT event');
            assert.strictEqual(eventData.clusterName, 'test-cluster');
            assert.strictEqual(eventData.warningCount, 1);
            assert.strictEqual(eventData.criticalCount, 0);
            assert.strictEqual(eventData.totalGroups, 1);
        });
    });

    suite('Error Handling', () => {
        test('should handle errors gracefully when fetching groups', async () => {
            const mockAdmin = {
                listGroups: sandbox.stub().rejects(new Error('Connection failed'))
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            // Should not throw
            await (lagMonitor as any).checkClusterLag('test-cluster');

            // No alerts should be shown
            const showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage');
            assert.ok(!showWarningStub.called, 'Should not show alert on error');
        });

        test('should skip groups that fail to fetch offsets', async () => {
            mockConfig.get.withArgs('warningThreshold', 1000).returns(1000);
            mockConfig.get.withArgs('criticalThreshold', 10000).returns(10000);

            const mockAdmin = {
                listGroups: sandbox.stub().resolves({
                    groups: [
                        { groupId: 'good-group' },
                        { groupId: 'bad-group' }
                    ]
                }),
                fetchOffsets: sandbox.stub()
                    .onFirstCall().resolves([{ topic: 'test-topic', partitions: [{ partition: 0, offset: '0' }] }])
                    .onSecondCall().rejects(new Error('Group rebalancing')),
                fetchTopicOffsets: sandbox.stub().resolves([
                    { partition: 0, high: '1500', low: '0' }
                ])
            };

            clientManager.getClusters.returns(['test-cluster']);
            clientManager.getAdminClient.resolves(mockAdmin as any);

            const showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            // Should not throw and should still process good group
            await (lagMonitor as any).checkClusterLag('test-cluster');

            assert.ok(showWarningStub.called, 'Should still send alert for good group');
            const message = showWarningStub.firstCall.args[0];
            assert.ok(message.includes('good-group'), 'Should include good group');
            assert.ok(!message.includes('bad-group'), 'Should not include failed group');
        });
    });
});
