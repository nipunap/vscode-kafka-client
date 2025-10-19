import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ConsumerGroupsWebview } from '../../views/ConsumerGroupsWebview';

suite('ConsumerGroupsWebview Test Suite', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        ConsumerGroupsWebview.resetInstance();
    });

    teardown(() => {
        sandbox.restore();
        ConsumerGroupsWebview.resetInstance();
    });

    suite('Singleton Pattern', () => {
        test('should return same instance', () => {
            const instance1 = ConsumerGroupsWebview.getInstance();
            const instance2 = ConsumerGroupsWebview.getInstance();
            assert.strictEqual(instance1, instance2, 'Should return same instance');
        });

        test('should reset instance', () => {
            const instance1 = ConsumerGroupsWebview.getInstance();
            ConsumerGroupsWebview.resetInstance();
            const instance2 = ConsumerGroupsWebview.getInstance();
            assert.notStrictEqual(instance1, instance2, 'Should return new instance after reset');
        });
    });

    suite('Webview Creation', () => {
        test('should create webview panel with correct title', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = [
                { groupId: 'test-group-1', state: 'Stable' },
                { groupId: 'test-group-2', state: 'Empty' }
            ];

            await webview.show('test-cluster', groups);

            const createStub = vscode.window.createWebviewPanel as sinon.SinonStub;
            assert.ok(
                createStub.calledWith(
                    'kafkaConsumerGroupsList',
                    sinon.match.string,
                    vscode.ViewColumn.One,
                    sinon.match.object
                ),
                'Should create webview panel with correct parameters'
            );
        });

        test('should reuse existing panel if already open', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            const createStub = sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = [{ groupId: 'test-group', state: 'Stable' }];

            await webview.show('test-cluster', groups);
            await webview.show('test-cluster', groups);

            assert.strictEqual(createStub.callCount, 1, 'Should only create panel once');
            assert.ok(mockPanel.reveal.called, 'Should reveal existing panel');
        });
    });

    suite('HTML Content Generation', () => {
        test('should generate HTML with consumer groups data', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = [
                { groupId: 'consumer-group-1', state: 'Stable' },
                { groupId: 'consumer-group-2', state: 'Empty' },
                { groupId: 'consumer-group-3', state: 'Dead' }
            ];

            await webview.show('prod-cluster', groups);

            const html = mockPanel.webview.html;
            assert.ok(html.includes('prod-cluster'), 'Should include cluster name');
            assert.ok(html.includes('Total: 3 groups'), 'Should include total count');
            assert.ok(html.includes('consumer-group-1'), 'Should include group IDs in data');
        });

        test('should escape HTML in cluster name (XSS protection)', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = [{ groupId: 'test-group', state: 'Stable' }];

            await webview.show('<script>alert("xss")</script>', groups);

            const html = mockPanel.webview.html;
            // Should escape HTML tags
            assert.ok(!html.includes('<script>alert'), 'Should not contain unescaped script tag');
            assert.ok(html.includes('&lt;script&gt;') || html.includes('\\u003c'), 'Should escape HTML entities');
        });

        test('should include pagination controls', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = Array.from({ length: 150 }, (_, i) => ({
                groupId: `group-${i}`,
                state: 'Stable'
            }));

            await webview.show('test-cluster', groups);

            const html = mockPanel.webview.html;
            assert.ok(html.includes('pagination'), 'Should include pagination section');
            assert.ok(html.includes('First'), 'Should include First button');
            assert.ok(html.includes('Previous'), 'Should include Previous button');
            assert.ok(html.includes('Next'), 'Should include Next button');
            assert.ok(html.includes('Last'), 'Should include Last button');
        });
    });

    suite('Message Handling', () => {
        test('should handle viewConsumerGroup command', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);
            const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = [{ groupId: 'test-group', state: 'Stable' }];

            await webview.show('test-cluster', groups);

            // Simulate message from webview
            const messageHandler = mockPanel.webview.onDidReceiveMessage.getCall(0).args[0];
            messageHandler({
                command: 'viewConsumerGroup',
                groupId: 'test-group'
            });

            assert.ok(
                executeCommandStub.calledWith('kafka.showConsumerGroupDetails', {
                    clusterName: 'test-cluster',
                    groupId: 'test-group'
                }),
                'Should execute showConsumerGroupDetails command'
            );
        });

        test('should ignore unknown commands (SEC-3.7-3)', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);
            const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = [{ groupId: 'test-group', state: 'Stable' }];

            await webview.show('test-cluster', groups);

            // Simulate unknown command
            const messageHandler = mockPanel.webview.onDidReceiveMessage.getCall(0).args[0];
            messageHandler({
                command: 'maliciousCommand',
                data: 'payload'
            });

            assert.ok(!executeCommandStub.called, 'Should not execute any command for unknown commands');
        });
    });

    suite('State Badge Rendering', () => {
        test('should include state information in data', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = [
                { groupId: 'stable-group', state: 'Stable' },
                { groupId: 'empty-group', state: 'Empty' },
                { groupId: 'dead-group', state: 'Dead' },
                { groupId: 'rebalancing-group', state: 'PreparingRebalance' }
            ];

            await webview.show('test-cluster', groups);

            const html = mockPanel.webview.html;
            // Check that states are included in the JSON data
            assert.ok(html.includes('"state":"Stable"'), 'Should include Stable state');
            assert.ok(html.includes('"state":"Empty"'), 'Should include Empty state');
            assert.ok(html.includes('"state":"Dead"'), 'Should include Dead state');
            assert.ok(html.includes('"state":"PreparingRebalance"'), 'Should include PreparingRebalance state');
        });
    });

    suite('Search Functionality', () => {
        test('should include search input', async () => {
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub()
                },
                onDidDispose: sandbox.stub(),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };

            sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);

            const webview = ConsumerGroupsWebview.getInstance();
            const groups = [{ groupId: 'test-group', state: 'Stable' }];

            await webview.show('test-cluster', groups);

            const html = mockPanel.webview.html;
            assert.ok(html.includes('searchInput'), 'Should include search input');
            assert.ok(html.includes('filterGroups'), 'Should include filter function');
            assert.ok(html.includes('Search consumer groups'), 'Should include search placeholder');
        });
    });
});

