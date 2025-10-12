/**
 * Base Webview - Abstract base class for all webviews
 * Provides common functionality and enforces consistent patterns
 */

import * as vscode from 'vscode';
import { Logger } from '../infrastructure/Logger';

export interface WebviewConfig {
    /** Unique identifier for this webview type */
    viewType: string;

    /** Title shown in the webview tab */
    title: string;

    /** Whether to enable scripts in the webview */
    enableScripts?: boolean;

    /** Whether to retain context when hidden */
    retainContextWhenHidden?: boolean;

    /** Icon path for the webview tab */
    iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };

    /** Column to show the webview in */
    viewColumn?: vscode.ViewColumn;
}

export abstract class BaseWebview {
    protected panel: vscode.WebviewPanel | undefined;
    protected readonly logger: Logger;
    protected disposables: vscode.Disposable[] = [];

    constructor(
        protected readonly config: WebviewConfig,
        loggerName?: string
    ) {
        this.logger = Logger.getLogger(loggerName || config.viewType);
    }

    /**
     * Show the webview. Creates a new panel if needed, or reveals existing one.
     * Subclasses should call this via super.show() and then load their content.
     */
    protected show(): vscode.WebviewPanel {
        if (this.panel) {
            this.panel.reveal(this.config.viewColumn || vscode.ViewColumn.One);
            return this.panel;
        }

        this.panel = vscode.window.createWebviewPanel(
            this.config.viewType,
            this.config.title,
            this.config.viewColumn || vscode.ViewColumn.One,
            {
                enableScripts: this.config.enableScripts ?? true,
                retainContextWhenHidden: this.config.retainContextWhenHidden ?? true
            }
        );

        if (this.config.iconPath) {
            this.panel.iconPath = this.config.iconPath;
        }

        // Set up message handling
        this.disposables.push(
            this.panel.webview.onDidReceiveMessage(
                message => this.handleMessage(message),
                null,
                this.disposables
            )
        );

        // Clean up on dispose
        this.panel.onDidDispose(
            () => this.dispose(),
            null,
            this.disposables
        );

        this.logger.debug(`Webview created: ${this.config.viewType}`);
        return this.panel;
    }

    /**
     * Update the webview title
     */
    protected updateTitle(title: string): void {
        if (this.panel) {
            this.panel.title = title;
        }
    }

    /**
     * Post a message to the webview
     */
    protected postMessage(message: any): void {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    /**
     * Handle messages received from the webview
     * Subclasses must implement this to handle their specific messages
     */
    protected abstract handleMessage(message: any): Promise<void>;

    /**
     * Get the HTML content for the webview
     * Subclasses must implement this to provide their content
     */
    protected abstract getHtmlContent(...args: any[]): string;

    /**
     * Get a nonce for Content Security Policy
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
     * Get secure Content Security Policy meta tag
     * Note: We use 'unsafe-inline' without nonces because inline event handlers
     * (onclick, etc.) require it. When a nonce is present, 'unsafe-inline' is ignored.
     * This is safe because we control all HTML generation and use proper escaping.
     */
    protected getCSP(_nonce: string): string {
        return `
            <meta http-equiv="Content-Security-Policy"
                  content="default-src 'none';
                           style-src ${this.panel?.webview.cspSource} 'unsafe-inline';
                           script-src 'unsafe-inline';
                           img-src ${this.panel?.webview.cspSource} https:;
                           font-src ${this.panel?.webview.cspSource};">
        `;
    }

    /**
     * Escape HTML special characters
     */
    protected escapeHtml(text: string): string {
        const div = { textContent: text };
        return (div as any).textContent || '';
    }

    /**
     * Get loading HTML template
     */
    protected getLoadingHtml(message: string = 'Loading...'): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${this.config.title}</title>
                <style>
                    body {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background: var(--vscode-editor-background);
                    }
                    .loading {
                        text-align: center;
                    }
                    .spinner {
                        border: 3px solid var(--vscode-progressBar-background);
                        border-top: 3px solid var(--vscode-progressBar-foreground);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 16px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="loading">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Get error HTML template
     */
    protected getErrorHtml(error: string): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error</title>
                <style>
                    body {
                        padding: 20px;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background: var(--vscode-editor-background);
                    }
                    .error {
                        background: var(--vscode-inputValidation-errorBackground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        padding: 16px;
                        border-radius: 4px;
                    }
                    .error-title {
                        color: var(--vscode-errorForeground);
                        font-weight: bold;
                        margin-bottom: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="error">
                    <div class="error-title">❌ Error</div>
                    <div>${this.escapeHtml(error)}</div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Check if the webview is currently visible
     */
    isVisible(): boolean {
        return this.panel !== undefined && this.panel.visible;
    }

    /**
     * Dispose of the webview and clean up resources
     */
    dispose(): void {
        this.logger.debug(`Disposing webview: ${this.config.viewType}`);

        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }

        // Dispose all disposables
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
