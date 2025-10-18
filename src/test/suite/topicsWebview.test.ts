import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { TopicsWebview } from '../../views/TopicsWebview';

suite('TopicsWebview Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let topicsWebview: TopicsWebview;

    setup(() => {
        sandbox = sinon.createSandbox();
        topicsWebview = TopicsWebview.getInstance();
    });

    teardown(() => {
        sandbox.restore();
        // Reset the singleton instance
        (TopicsWebview as any).instance = null;
    });

    suite('Pagination', () => {
        test('should paginate 200 topics into pages of 100', async () => {
            const topics = Array.from({ length: 200 }, (_, i) => `topic-${i}`);
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            await topicsWebview.show(clusterName, topics);

            assert.ok(createWebviewPanelStub.called, 'Should create webview panel');

            // Verify HTML contains pagination info
            const html = mockPanel.webview.html;
            assert.ok(html.includes('Total: <strong id="totalTopics">200</strong>'), 'Should show total topics');
            assert.ok(html.includes('Page <strong id="currentPageDisplay">1</strong>'), 'Should show current page');
        });

        test('should handle exactly 100 topics (single page)', async () => {
            const topics = Array.from({ length: 100 }, (_, i) => `topic-${i}`);
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            await topicsWebview.show(clusterName, topics);

            const html = mockPanel.webview.html;
            assert.ok(html.includes('Total: <strong id="totalTopics">100</strong>'), 'Should show 100 topics');
        });

        test('should handle 1000+ topics', async () => {
            const topics = Array.from({ length: 1500 }, (_, i) => `topic-${i}`);
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            await topicsWebview.show(clusterName, topics);

            const html = mockPanel.webview.html;
            assert.ok(html.includes('Total: <strong id="totalTopics">1500</strong>'), 'Should show 1500 topics');
            // Should have 15 pages (1500 / 100)
            assert.ok(html.includes('pageSize = 100'), 'Should use 100 items per page');
        });
    });

    suite('Client-Side Search', () => {
        test('should include search input in HTML', async () => {
            const topics = ['topic-1', 'topic-2'];
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            await topicsWebview.show(clusterName, topics);

            const html = mockPanel.webview.html;
            assert.ok(html.includes('id="searchInput"'), 'Should have search input');
            assert.ok(html.includes('oninput="filterTopics()"'), 'Should have filter function');
        });

        test('should include filterTopics JavaScript function', async () => {
            const topics = ['topic-1', 'topic-2'];
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            await topicsWebview.show(clusterName, topics);

            const html = mockPanel.webview.html;
            assert.ok(html.includes('function filterTopics()'), 'Should have filterTopics function');
            assert.ok(html.includes('filteredTopics = allTopics.filter'), 'Should filter topics');
        });
    });

    suite('XSS Protection (SEC-3.7-1)', () => {
        test('should escape HTML in topic names', async () => {
            const topics = ['<script>alert("xss")</script>', 'topic&test', 'topic"with"quotes'];
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            await topicsWebview.show(clusterName, topics);

            const html = mockPanel.webview.html;

            // Topics are escaped in the JavaScript array using JSON.stringify
            // which automatically escapes special characters
            assert.ok(html.includes('const allTopics ='), 'Should have topics array');
            // JSON.stringify escapes < > as unicode
            assert.ok(html.includes('\\u003c') || html.includes('&lt;'), 'Should escape < in topics');
            assert.ok(html.includes('function escapeHtml'), 'Should have escapeHtml function for runtime escaping');
        });

        test('should escape HTML in cluster name', async () => {
            const topics = ['topic-1'];
            const clusterName = '<img src=x onerror=alert(1)>';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            await topicsWebview.show(clusterName, topics);

            const html = mockPanel.webview.html;
            assert.ok(!html.includes('<img src=x'), 'Should escape img tags');
            assert.ok(html.includes('&lt;img'), 'Should show escaped img tag');
        });

        test('should use escapeHtml function in JavaScript', async () => {
            const topics = ['topic-1'];
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            await topicsWebview.show(clusterName, topics);

            const html = mockPanel.webview.html;
            assert.ok(html.includes('function escapeHtml(unsafe)'), 'Should have escapeHtml function');
            assert.ok(html.includes('div.textContent = unsafe'), 'Should use textContent for escaping');
        });
    });

    suite('Command Whitelist (SEC-3.7-3)', () => {
        test('should only handle whitelisted commands', async () => {
            const topics = ['topic-1'];
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            let messageHandler: any;
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: (handler: any) => {
                        messageHandler = handler;
                        return { dispose: () => {} };
                    }
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

            await topicsWebview.show(clusterName, topics);

            // Test valid commands
            messageHandler({ command: 'viewTopic', topicName: 'test' });
            assert.ok(executeCommandStub.calledWith('kafka.showTopicDetails'), 'Should handle viewTopic');

            executeCommandStub.resetHistory();
            messageHandler({ command: 'consumeTopic', topicName: 'test' });
            assert.ok(executeCommandStub.calledWith('kafka.consumeMessages'), 'Should handle consumeTopic');

            executeCommandStub.resetHistory();
            messageHandler({ command: 'produceTopic', topicName: 'test' });
            assert.ok(executeCommandStub.calledWith('kafka.produceMessage'), 'Should handle produceTopic');

            // Test unknown command (should be ignored)
            executeCommandStub.resetHistory();
            messageHandler({ command: 'maliciousCommand', data: 'evil' });
            assert.ok(!executeCommandStub.called, 'Should ignore unknown commands');
        });
    });

    suite('Performance', () => {
        test('should handle 1000 topics efficiently', async () => {
            const topics = Array.from({ length: 1000 }, (_, i) => `topic-${i}`);
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: sandbox.stub(),
                dispose: sandbox.stub()
            };
            createWebviewPanelStub.returns(mockPanel as any);

            const startTime = Date.now();
            await topicsWebview.show(clusterName, topics);
            const duration = Date.now() - startTime;

            assert.ok(duration < 1000, `Should render 1000 topics in < 1s (took ${duration}ms)`);
        });
    });

    suite('Reuse and Disposal', () => {
        test('should reuse existing panel if already open', async () => {
            const topics = ['topic-1'];
            const clusterName = 'test-cluster';

            const createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel');
            const revealStub = sandbox.stub();
            const mockPanel = {
                webview: {
                    html: '',
                    onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} })
                },
                onDidDispose: sandbox.stub().returns({ dispose: () => {} }),
                reveal: revealStub
            };
            createWebviewPanelStub.returns(mockPanel as any);

            // First call creates panel
            await topicsWebview.show(clusterName, topics);
            assert.strictEqual(createWebviewPanelStub.callCount, 1, 'Should create panel once');

            // Second call reuses panel
            await topicsWebview.show(clusterName, topics);
            assert.strictEqual(createWebviewPanelStub.callCount, 1, 'Should not create new panel');
            assert.ok(revealStub.called, 'Should reveal existing panel');
        });

        test('should dispose panel correctly', () => {
            const disposeStub = sandbox.stub();
            (topicsWebview as any).panel = {
                dispose: disposeStub
            };

            topicsWebview.dispose();

            assert.ok(disposeStub.called, 'Should dispose panel');
            assert.strictEqual((topicsWebview as any).panel, null, 'Should clear panel reference');
        });
    });
});
