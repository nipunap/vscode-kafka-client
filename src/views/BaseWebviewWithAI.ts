/**
 * BaseWebviewWithAI - Abstract base class for webviews with AI features
 * Provides common AI-related functionality and eliminates code duplication
 */

import * as vscode from 'vscode';
import { BaseWebview, WebviewConfig } from './BaseWebview';

export abstract class BaseWebviewWithAI extends BaseWebview {
    private extensionUri: vscode.Uri;

    constructor(
        config: WebviewConfig,
        context: vscode.ExtensionContext,
        loggerName?: string
    ) {
        super(config, loggerName);
        this.extensionUri = context.extensionUri;
    }

    /**
     * Get webview URI for a script file
     * @param scriptName - Name of the script file (e.g., 'formatAIResponse.js')
     * @returns Webview URI for the script
     */
    protected getScriptUri(scriptName: string): vscode.Uri {
        const scriptPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webviewScripts', scriptName);

        if (!this.panel) {
            // Return file URI if panel not initialized (for testing)
            return scriptPath;
        }
        return this.panel.webview.asWebviewUri(scriptPath);
    }

    /**
     * Get common AI scripts that should be included in all AI-enabled webviews
     * @param _nonce - CSP nonce (kept for backwards compatibility but not used)
     * @returns HTML string with script tags
     */
    protected getCommonAIScripts(_nonce: string): string {
        const escapeHtmlUri = this.getScriptUri('escapeHtml.js');
        const formatAIResponseUri = this.getScriptUri('formatAIResponse.js');

        return `
            <script src="${escapeHtmlUri}"></script>
            <script src="${formatAIResponseUri}"></script>
        `;
    }

    /**
     * Generate a random nonce for CSP
     * @returns Random nonce string
     */
    protected getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Get Content Security Policy meta tag
     * Note: We use 'unsafe-inline' without nonces because inline event handlers
     * (onclick, etc.) require it. When a nonce is present, 'unsafe-inline' is ignored.
     * We also need to allow the webview CSP source for external script files.
     * This is safe because we control all HTML generation and use proper escaping.
     * @param _nonce - CSP nonce (kept for backwards compatibility but not used)
     * @returns CSP meta tag HTML string
     */
    protected getCSP(_nonce: string): string {
        return `
            <meta http-equiv="Content-Security-Policy"
                  content="default-src 'none';
                           style-src 'unsafe-inline';
                           script-src ${this.panel?.webview.cspSource} 'unsafe-inline';">
        `;
    }
}
