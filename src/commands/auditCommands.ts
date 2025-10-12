/**
 * Audit Log Commands - View and manage audit logs
 */

import * as vscode from 'vscode';
import { AuditLog } from '../infrastructure/AuditLog';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { InputValidator } from '../utils/inputValidator';
import { Logger } from '../infrastructure/Logger';

/**
 * Show audit log viewer
 */
export async function showAuditLog(): Promise<void> {
    const logger = Logger.getLogger('AuditCommands');
    try {
        const stats = AuditLog.getStatistics();
        const entries = AuditLog.getEntries();

        const panel = vscode.window.createWebviewPanel(
            'auditLog',
            '📋 Audit Log',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = getAuditLogHtml(entries, stats);

        // Handle messages from webview with validation
        panel.webview.onDidReceiveMessage(
            message => {
                // Validate command
                const allowedCommands = ['export', 'clear'];
                if (!InputValidator.isValidCommand(message?.command, allowedCommands)) {
                    logger.warn(`Invalid command received: ${message?.command}`);
                    return;
                }

                switch (message.command) {
                    case 'export':
                        exportAuditLog();
                        break;
                    case 'clear':
                        vscode.window.showWarningMessage(
                            'Clear audit log? This cannot be undone.',
                            'Clear',
                            'Cancel'
                        ).then(response => {
                            if (response === 'Clear') {
                                AuditLog.clear();
                                vscode.window.showInformationMessage('Audit log cleared');
                                panel.webview.html = getAuditLogHtml([], AuditLog.getStatistics());
                            }
                        });
                        break;
                }
            },
            undefined,
            []
        );
    } catch (error: any) {
        ErrorHandler.handle(error, 'showAuditLog');
    }
}

/**
 * Export audit log to file
 */
export async function exportAuditLog(): Promise<void> {
    try {
        const exportData = AuditLog.export();

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`kafka-audit-log-${new Date().toISOString().split('T')[0]}.json`),
            filters: {
                'JSON': ['json']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(exportData, 'utf-8'));
            vscode.window.showInformationMessage(`Audit log exported to ${uri.fsPath}`);
        }
    } catch (error: any) {
        ErrorHandler.handle(error, 'exportAuditLog');
    }
}

function getAuditLogHtml(entries: any[], stats: any): string {
    const nonce = getNonce();
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy"
                  content="default-src 'none';
                           style-src 'unsafe-inline';
                           script-src 'nonce-${nonce}';">
            <title>Audit Log</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    padding: 20px;
                }
                .header {
                    margin-bottom: 20px;
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: var(--vscode-textBlockQuote-background);
                    border: 1px solid var(--vscode-textBlockQuote-border);
                    padding: 15px;
                    border-radius: 4px;
                }
                .stat-label {
                    font-size: 12px;
                    opacity: 0.7;
                    margin-bottom: 5px;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                }
                .controls {
                    margin-bottom: 20px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    margin-right: 10px;
                    cursor: pointer;
                    border-radius: 2px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                th {
                    background: var(--vscode-textBlockQuote-background);
                    padding: 8px;
                    text-align: left;
                    border-bottom: 2px solid var(--vscode-textBlockQuote-border);
                }
                td {
                    padding: 8px;
                    border-bottom: 1px solid var(--vscode-textBlockQuote-border);
                }
                .success {
                    color: #4ec9b0;
                }
                .failure {
                    color: #f48771;
                }
                .empty {
                    text-align: center;
                    padding: 40px;
                    opacity: 0.5;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📋 Audit Log</h1>
            </div>

            <div class="stats">
                <div class="stat-card">
                    <div class="stat-label">Total Operations</div>
                    <div class="stat-value">${stats.total}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Successful</div>
                    <div class="stat-value success">${stats.successful}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Failed</div>
                    <div class="stat-value failure">${stats.failed}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Avg Duration</div>
                    <div class="stat-value">${stats.avgDuration.toFixed(0)}ms</div>
                </div>
            </div>

            <div class="controls">
                <button onclick="exportLog()">📤 Export</button>
                <button onclick="clearLog()">🗑️ Clear</button>
            </div>

            ${entries.length === 0 ? `
                <div class="empty">
                    No audit entries yet. Operations will be logged here.
                </div>
            ` : `
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Operation</th>
                            <th>Cluster</th>
                            <th>Resource</th>
                            <th>Result</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entries.map(entry => `
                            <tr>
                                <td>${new Date(entry.timestamp).toLocaleString()}</td>
                                <td>${entry.operation}</td>
                                <td>${entry.cluster}</td>
                                <td>${entry.resource || '-'}</td>
                                <td class="${entry.result.toLowerCase()}">${entry.result}</td>
                                <td>${entry.duration ? entry.duration + 'ms' : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();

                function exportLog() {
                    vscode.postMessage({ command: 'export' });
                }

                function clearLog() {
                    vscode.postMessage({ command: 'clear' });
                }
            </script>
        </body>
        </html>
    `;
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
