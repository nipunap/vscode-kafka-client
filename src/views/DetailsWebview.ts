import * as vscode from 'vscode';
import { FieldDescriptions } from '../utils/fieldDescriptions';
import { formatMilliseconds, formatBytes, isMillisecondsProperty, isBytesProperty } from '../utils/formatters';
import { Logger } from '../infrastructure/Logger';

/**
 * Utility class for creating consistent HTML detail views
 * Provides a foundation for future editing capabilities
 */
export class DetailsWebview {
    private panel: vscode.WebviewPanel | undefined;
    private aiRequestHandler: (() => Promise<void>) | undefined;

    constructor(
        private title: string,
        private icon: string = '📄'
    ) {}

    /**
     * Show the details view with the provided data
     */
    public show(data: DetailsData): void {

        // Create or reuse webview panel
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'kafkaDetails',
                `${this.icon} ${this.title}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.aiRequestHandler = undefined;
            });

            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'copyAsJson':
                            await vscode.env.clipboard.writeText(message.data);
                            vscode.window.showInformationMessage('📋 Copied to clipboard as JSON');
                            break;
                        case 'showMessage':
                            vscode.window.showInformationMessage(message.text);
                            break;
                        case 'requestAIAdvice':
                            // Call the AI request handler if set
                            if (this.aiRequestHandler) {
                                try {
                                    await this.aiRequestHandler();
                                } catch (error: any) {
                                    vscode.window.showErrorMessage(`AI Advisor: ${error.message}`);
                                    this.updateWithAIRecommendations(`Error: ${error.message}\n\nPlease ensure GitHub Copilot is installed and active.`);
                                }
                            }
                            break;
                        case 'getAIParameterDetails':
                            try {
                                const parameter = message.parameter;
                                Logger.getLogger('DetailsWebview').info(`Fetching AI details for parameter: ${parameter}`);
                                
                                // Use web search to get details from documentation
                                const { ParameterAIService } = await import('../services/parameterAIService');
                                const details = await ParameterAIService.getInstance().getParameterDetails(parameter);
                                
                                this.panel?.webview.postMessage({
                                    command: 'aiParameterDetailsResponse',
                                    success: true,
                                    content: details
                                });
                            } catch (error: any) {
                                Logger.getLogger('DetailsWebview').error(`Error fetching AI parameter details: ${error.message}`, error);
                                this.panel?.webview.postMessage({
                                    command: 'aiParameterDetailsResponse',
                                    success: false,
                                    error: error.message
                                });
                            }
                            break;
                    }
                },
                undefined,
                []
            );
        }

        // Set HTML content
        this.panel.webview.html = this.getHtml(data);
    }

    /**
     * Set the AI request handler
     */
    public setAIRequestHandler(handler: () => Promise<void>): void {
        this.aiRequestHandler = handler;
    }

    /**
     * Update the webview with AI recommendations
     */
    public updateWithAIRecommendations(recommendations: string): void {
        if (!this.panel) {
            return;
        }

        // Send the recommendations to the webview
        this.panel.webview.postMessage({
            command: 'showAIRecommendations',
            recommendations
        });
    }

    /**
     * Generate the search and copy script
     */
    private getScript(data: DetailsData): string {
        const dataJson = JSON.stringify(data);
        return `
            const vscode = acquireVsCodeApi();
            const detailsData = ${dataJson};
            let searchMatches = [];
            let currentMatchIndex = -1;

            function refresh() {
                vscode.postMessage({ command: 'refresh' });
            }

            function copyAsJson() {
                const exportData = convertToExportFormat(detailsData);
                const jsonString = JSON.stringify(exportData, null, 2);
                vscode.postMessage({
                    command: 'copyAsJson',
                    data: jsonString
                });
            }

            function convertToExportFormat(data) {
                const result = {};
                if (data.title) {
                    result.name = data.title;
                }
                data.sections.forEach(section => {
                    const sectionData = {};
                    if (section.properties) {
                        section.properties.forEach(prop => {
                            sectionData[prop.label] = prop.value;
                        });
                    }
                    if (section.table && section.table.rows) {
                        const tableData = section.table.rows.map(row => {
                            const obj = {};
                            section.table.headers.forEach((header, index) => {
                                obj[header] = row[index];
                            });
                            return obj;
                        });
                        sectionData[section.title] = tableData;
                    } else if (!section.properties) {
                        sectionData[section.title] = null;
                    }
                    Object.assign(result, sectionData);
                });
                return result;
            }

            function switchTab(tabId) {
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.getElementById(tabId).classList.add('active');
                document.querySelector('[data-tab="' + tabId + '"]').classList.add('active');
            }

            function performSearch(searchTerm) {
                clearHighlights();
                if (!searchTerm || searchTerm.length < 2) {
                    document.getElementById('searchInfo').textContent = '';
                    return;
                }
                const sections = document.querySelectorAll('.section');
                searchMatches = [];
                sections.forEach(section => {
                    highlightInElement(section, searchTerm);
                });
                if (searchMatches.length > 0) {
                    currentMatchIndex = 0;
                    scrollToMatch(0);
                    document.getElementById('searchInfo').textContent = (currentMatchIndex + 1) + ' of ' + searchMatches.length + ' matches';
                } else {
                    document.getElementById('searchInfo').textContent = 'No matches found';
                }
            }

            function highlightInElement(element, searchTerm) {
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
                const nodesToReplace = [];
                let node;
                while (node = walker.nextNode()) {
                    if (node.nodeValue && node.nodeValue.toLowerCase().includes(searchTerm.toLowerCase())) {
                        nodesToReplace.push(node);
                    }
                }
                nodesToReplace.forEach(node => {
                    const span = document.createElement('span');
                    // Use case-insensitive indexOf for simple highlighting without regex
                    const lowerText = node.nodeValue.toLowerCase();
                    const lowerTerm = searchTerm.toLowerCase();
                    let result = '';
                    let lastIndex = 0;
                    let index = lowerText.indexOf(lowerTerm);
                    while (index !== -1) {
                        result += node.nodeValue.substring(lastIndex, index);
                        result += '<mark class="highlight">' + node.nodeValue.substring(index, index + searchTerm.length) + '</mark>';
                        lastIndex = index + searchTerm.length;
                        index = lowerText.indexOf(lowerTerm, lastIndex);
                    }
                    result += node.nodeValue.substring(lastIndex);
                    span.innerHTML = result;
                    node.parentNode.replaceChild(span, node);
                    span.querySelectorAll('.highlight').forEach(mark => {
                        searchMatches.push(mark);
                    });
                });
            }

            function clearHighlights() {
                document.querySelectorAll('.highlight').forEach(mark => {
                    const parent = mark.parentNode;
                    parent.replaceWith(parent.textContent);
                });
                searchMatches = [];
                currentMatchIndex = -1;
                document.querySelectorAll('.section').forEach(section => {
                    section.normalize();
                });
            }

            function clearSearch() {
                document.getElementById('searchInput').value = '';
                clearHighlights();
                document.getElementById('searchInfo').textContent = '';
            }

            function scrollToMatch(index) {
                if (index < 0 || index >= searchMatches.length) return;
                searchMatches.forEach(match => match.classList.remove('current'));
                searchMatches[index].classList.add('current');
                searchMatches[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            function nextMatch() {
                if (searchMatches.length === 0) return;
                currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
                scrollToMatch(currentMatchIndex);
                document.getElementById('searchInfo').textContent = (currentMatchIndex + 1) + ' of ' + searchMatches.length + ' matches';
            }

            function previousMatch() {
                if (searchMatches.length === 0) return;
                currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
                scrollToMatch(currentMatchIndex);
                document.getElementById('searchInfo').textContent = (currentMatchIndex + 1) + ' of ' + searchMatches.length + ' matches';
            }

            document.getElementById('searchInput').addEventListener('input', (e) => {
                performSearch(e.target.value);
            });

            document.getElementById('searchInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        previousMatch();
                    } else {
                        nextMatch();
                    }
                }
            });

            document.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                }
            });

            // AI Advisor functions
            function getAIAdvice() {
                const aiButton = document.getElementById('aiButton');
                const aiRecommendations = document.getElementById('aiRecommendations');
                const aiContent = document.getElementById('aiContent');

                if (!aiButton || !aiRecommendations || !aiContent) return;

                // Show loading state
                aiButton.disabled = true;
                aiButton.textContent = '🤖 Analyzing...';
                aiRecommendations.classList.add('visible');
                aiContent.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span>Analyzing configuration and generating recommendations...</span></div>';

                // Request AI recommendations from extension
                vscode.postMessage({ command: 'requestAIAdvice' });
            }

            // Listen for AI recommendations from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'showAIRecommendations') {
                    const aiButton = document.getElementById('aiButton');
                    const aiRecommendations = document.getElementById('aiRecommendations');
                    const aiContent = document.getElementById('aiContent');

                    if (aiButton && aiRecommendations && aiContent) {
                        aiButton.disabled = false;
                        aiButton.textContent = '🤖 AI Advisor';
                        aiRecommendations.classList.add('visible');

                        // Format markdown-like text to HTML
                        const formattedText = formatAIResponse(message.recommendations);
                        aiContent.innerHTML = formattedText;
                    }
                }
            });

            function formatAIResponse(text) {
                // Enhanced markdown-like formatting
                let formatted = text;
                const backtick = String.fromCharCode(96);

                // Headers with bottom border for better separation
                formatted = formatted.replace(/^### (.+)$/gm, '<h4 style="margin-top: 20px; margin-bottom: 10px; color: var(--primary-color); font-weight: 600;">$1</h4>');
                formatted = formatted.replace(/^## (.+)$/gm, '<h3 style="margin-top: 25px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--border-color); color: var(--primary-color); font-weight: 700;">$1</h3>');
                formatted = formatted.replace(/^# (.+)$/gm, '<h2 style="margin-top: 30px; margin-bottom: 15px; color: var(--primary-color); font-weight: 800;">$1</h2>');

                // Bold text
                formatted = formatted.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong style="color: var(--text-color); font-weight: 600;">$1</strong>');

                // Code blocks with better styling
                const codeRegex = new RegExp(backtick + '([^' + backtick + ']+)' + backtick, 'g');
                formatted = formatted.replace(codeRegex, '<code style="background: var(--background); padding: 2px 6px; border-radius: 3px; font-size: 13px; border: 1px solid var(--border-color); color: var(--primary-color); font-family: monospace;">$1</code>');

                // Bullet points with custom styling
                formatted = formatted.replace(/^- (.+)$/gm, '<div style="margin: 8px 0; padding-left: 20px; position: relative;"><span style="position: absolute; left: 0; color: var(--primary-color);">•</span>$1</div>');

                // Numbered lists
                formatted = formatted.replace(/^(\\d+)\\. (.+)$/gm, '<div style="margin: 8px 0; padding-left: 25px; position: relative;"><span style="position: absolute; left: 0; color: var(--primary-color); font-weight: 600;">$1.</span>$2</div>');

                // Line breaks (but not after divs)
                formatted = formatted.split('\\n').map((line, i, arr) => {
                    // Don't add br after div elements or before headers
                    if (line.includes('</div>') || line.includes('</h') ||
                        (i < arr.length - 1 && arr[i + 1].includes('<h'))) {
                        return line;
                    }
                    return line + '<br>';
                }).join('');

                // Clean up extra br tags
                formatted = formatted.replace(/<br><br>/g, '<br>');
                formatted = formatted.replace(/<\\/div><br>/g, '</div>');
                formatted = formatted.replace(/<\\/h\\d><br>/g, match => match.replace('<br>', ''));

                return formatted;
            }
        `;
    }

    /**
     * Generate HTML for the details view
     */
    private getHtml(data: DetailsData): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${this.title}</title>
                <style>
                    :root {
                        --primary-color: var(--vscode-textLink-foreground);
                        --background: var(--vscode-editor-background);
                        --panel-background: var(--vscode-panel-background);
                        --border-color: var(--vscode-panel-border);
                        --text-color: var(--vscode-foreground);
                        --secondary-text: var(--vscode-descriptionForeground);
                        --success-color: #4caf50;
                        --warning-color: #ff9800;
                        --danger-color: #f44336;
                    }

                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--text-color);
                        background-color: var(--background);
                        padding: 20px;
                        line-height: 1.6;
                    }

                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 30px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid var(--border-color);
                    }

                    .header h1 {
                        font-size: 24px;
                        font-weight: 600;
                        color: var(--primary-color);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    .header-actions {
                        display: flex;
                        gap: 10px;
                    }

                    .btn {
                        padding: 8px 16px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-family: var(--vscode-font-family);
                        transition: background 0.2s;
                    }

                    .btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }

                    .btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    .btn-secondary {
                        background: var(--panel-background);
                        border: 1px solid var(--border-color);
                    }

                    .section {
                        background: var(--panel-background);
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        padding: 20px;
                        margin-bottom: 20px;
                    }

                    .section-title {
                        font-size: 16px;
                        font-weight: 600;
                        margin-bottom: 15px;
                        color: var(--primary-color);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .property-grid {
                        display: grid;
                        gap: 12px;
                    }

                    .property {
                        display: grid;
                        grid-template-columns: 200px 1fr;
                        gap: 15px;
                        padding: 10px 0;
                        border-bottom: 1px solid var(--border-color);
                    }

                    .property:last-child {
                        border-bottom: none;
                    }

                    .property-label {
                        font-weight: 600;
                        color: var(--secondary-text);
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .info-icon {
                        font-size: 14px;
                        cursor: pointer;
                        opacity: 0.7;
                        transition: opacity 0.2s;
                        display: inline-flex;
                        align-items: center;
                        margin-left: 4px;
                    }

                    .info-icon:hover {
                        opacity: 1;
                        transform: scale(1.1);
                    }

                    /* Human-readable format toggle */
                    .format-toggle {
                        display: inline-block;
                    }

                    .human-icon-header {
                        font-size: 18px;
                        cursor: pointer;
                        opacity: 0.6;
                        transition: all 0.2s;
                        display: inline-flex;
                        align-items: center;
                        user-select: none;
                        margin-left: 8px;
                        vertical-align: middle;
                    }

                    .human-icon-header:hover {
                        opacity: 1;
                        transform: scale(1.2);
                    }

                    .human-icon-header.active {
                        opacity: 1;
                        filter: brightness(1.3);
                    }

                    /* Info Modal Styles */
                    .info-modal {
                        display: none;
                        position: fixed;
                        z-index: 10000;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.6);
                        animation: fadeIn 0.2s;
                    }

                    .info-modal.show {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .info-modal-content {
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        padding: 20px;
                        max-width: 600px;
                        width: 90%;
                        max-height: 80vh;
                        overflow-y: auto;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                        animation: slideIn 0.2s;
                        position: relative;
                    }

                    .info-modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 15px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }

                    .info-modal-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                    }

                    .info-modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: var(--vscode-foreground);
                        opacity: 0.7;
                        padding: 0;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 4px;
                    }

                    .info-modal-close:hover {
                        opacity: 1;
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .info-modal-body {
                        color: var(--vscode-foreground);
                        line-height: 1.6;
                        font-size: 14px;
                        font-family: var(--vscode-font-family);
                    }

                    .info-modal-field {
                        display: inline-block;
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 2px 8px;
                        border-radius: 3px;
                        font-weight: 600;
                        margin-bottom: 10px;
                        font-family: var(--vscode-editor-font-family);
                    }

                    .info-modal-footer {
                        margin-top: 15px;
                        padding-top: 15px;
                        border-top: 1px solid var(--vscode-panel-border);
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                    }

                    .info-modal-ai-btn {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .info-modal-ai-btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                    }

                    .info-modal-ai-btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                        transform: none;
                    }

                    .info-modal-ai-content {
                        margin-top: 15px;
                        padding: 15px;
                        background: var(--vscode-textBlockQuote-background);
                        border-left: 3px solid #667eea;
                        border-radius: 4px;
                        font-size: 13px;
                        line-height: 1.6;
                        display: none;
                    }

                    .info-modal-ai-content.show {
                        display: block;
                        animation: fadeIn 0.3s;
                    }

                    .info-modal-ai-loading {
                        text-align: center;
                        padding: 20px;
                        color: var(--vscode-descriptionForeground);
                    }

                    .spinner {
                        display: inline-block;
                        width: 20px;
                        height: 20px;
                        border: 3px solid var(--vscode-descriptionForeground);
                        border-top-color: transparent;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }

                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    @keyframes slideIn {
                        from {
                            transform: translateY(-20px);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }

                    .property-value {
                        color: var(--text-color);
                        word-break: break-word;
                        font-family: var(--vscode-editor-font-family);
                    }

                    .property-value code {
                        background: var(--background);
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 12px;
                        border: 1px solid var(--border-color);
                    }

                    .badge {
                        display: inline-block;
                        padding: 4px 10px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    .badge-success {
                        background: var(--success-color);
                        color: white;
                    }

                    .badge-warning {
                        background: var(--warning-color);
                        color: white;
                    }

                    .badge-danger {
                        background: var(--danger-color);
                        color: white;
                    }

                    .badge-info {
                        background: var(--primary-color);
                        color: white;
                    }

                    .table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }

                    .table th {
                        text-align: left;
                        padding: 10px;
                        background: var(--background);
                        border-bottom: 2px solid var(--border-color);
                        font-weight: 600;
                        font-size: 12px;
                        text-transform: uppercase;
                        color: var(--secondary-text);
                    }

                    .table td {
                        padding: 12px 10px;
                        border-bottom: 1px solid var(--border-color);
                    }

                    .table tr:last-child td {
                        border-bottom: none;
                    }

                    .table tr:hover {
                        background: var(--background);
                    }

                    .empty-state {
                        text-align: center;
                        padding: 40px;
                        color: var(--secondary-text);
                    }

                    .notice {
                        padding: 12px 16px;
                        background: var(--panel-background);
                        border-left: 4px solid var(--primary-color);
                        margin-bottom: 20px;
                        border-radius: 4px;
                    }

                    .notice-info {
                        border-left-color: var(--primary-color);
                    }

                    .notice-warning {
                        border-left-color: var(--warning-color);
                    }

                    .notice-text {
                        font-size: 13px;
                        color: var(--secondary-text);
                    }

                    .tabs {
                        display: flex;
                        gap: 5px;
                        margin-bottom: 20px;
                        border-bottom: 1px solid var(--border-color);
                    }

                    .tab {
                        padding: 10px 20px;
                        cursor: pointer;
                        border: none;
                        background: transparent;
                        color: var(--secondary-text);
                        font-family: var(--vscode-font-family);
                        font-size: 14px;
                        border-bottom: 2px solid transparent;
                        transition: all 0.2s;
                    }

                    .tab:hover {
                        color: var(--text-color);
                    }

                    .tab.active {
                        color: var(--primary-color);
                        border-bottom-color: var(--primary-color);
                    }

                    .tab-content {
                        display: none;
                    }

                    .tab-content.active {
                        display: block;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    .section {
                        animation: fadeIn 0.3s ease-out;
                    }

                    .search-container {
                        position: sticky;
                        top: 0;
                        background: var(--background);
                        padding: 10px 0;
                        margin-bottom: 20px;
                        border-bottom: 1px solid var(--border-color);
                        z-index: 100;
                    }

                    .search-box {
                        display: flex;
                        gap: 10px;
                        align-items: center;
                    }

                    .search-input {
                        flex: 1;
                        padding: 8px 12px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        font-family: var(--vscode-font-family);
                        font-size: 13px;
                    }

                    .search-input:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                    }

                    .search-info {
                        color: var(--secondary-text);
                        font-size: 12px;
                        white-space: nowrap;
                    }

                    .highlight {
                        background-color: rgba(255, 255, 0, 0.3);
                        padding: 2px 0;
                        border-radius: 2px;
                    }

                    .highlight.current {
                        background-color: rgba(255, 165, 0, 0.5);
                    }

                    .btn-ai {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        font-weight: 600;
                    }

                    .btn-ai:hover {
                        background: linear-gradient(135deg, #5568d3 0%, #663a8f 100%);
                    }

                    .btn-ai:disabled {
                        background: var(--panel-background);
                        opacity: 0.5;
                    }

                    .ai-recommendations {
                        display: none;
                        background: var(--panel-background);
                        border: 2px solid var(--primary-color);
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                        animation: fadeIn 0.3s ease-out;
                    }

                    .ai-recommendations.visible {
                        display: block;
                    }

                    .ai-recommendations h3 {
                        margin: 0 0 15px 0;
                        color: var(--primary-color);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    .ai-recommendations-content {
                        line-height: 1.8;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }

                    .ai-recommendations-content h1,
                    .ai-recommendations-content h2,
                    .ai-recommendations-content h3 {
                        color: var(--primary-color);
                        margin-top: 15px;
                        margin-bottom: 10px;
                    }

                    .ai-recommendations-content ul,
                    .ai-recommendations-content ol {
                        margin-left: 20px;
                        margin-bottom: 10px;
                    }

                    .ai-recommendations-content code {
                        background: var(--background);
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 12px;
                        border: 1px solid var(--border-color);
                    }

                    .ai-loading {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        color: var(--secondary-text);
                    }

                    .spinner {
                        border: 3px solid var(--border-color);
                        border-top: 3px solid var(--primary-color);
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        animation: spin 1s linear infinite;
                    }

                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${this.icon} ${data.title || this.title}</h1>
                    <div class="header-actions">
                        ${data.showAIAdvisor ? '<button class="btn btn-ai" onclick="getAIAdvice()" id="aiButton">🤖 AI Advisor</button>' : ''}
                        ${data.showCopyButton ? '<button class="btn btn-secondary" onclick="copyAsJson()">📋 Copy as JSON</button>' : ''}
                        ${data.showRefreshButton ? '<button class="btn" onclick="refresh()">🔄 Refresh</button>' : ''}
                        <button class="btn btn-secondary" disabled title="Edit mode coming soon">✏️ Edit</button>
                    </div>
                </div>

                <div class="search-container">
                    <div class="search-box">
                        <input
                            type="text"
                            class="search-input"
                            id="searchInput"
                            placeholder="Search... (Cmd+F or Ctrl+F)"
                            autocomplete="off"
                        />
                        <button class="btn btn-secondary" onclick="clearSearch()">Clear</button>
                        <span class="search-info" id="searchInfo"></span>
                    </div>
                </div>

                ${data.notice ? `
                <div class="notice notice-${data.notice.type || 'info'}">
                    <div class="notice-text">${data.notice.text}</div>
                </div>
                ` : ''}

                ${data.showAIAdvisor ? `
                <div class="ai-recommendations" id="aiRecommendations">
                    <h3>🤖 AI Recommendations</h3>
                    <div class="ai-recommendations-content" id="aiContent">
                        <div class="ai-loading">
                            <div class="spinner"></div>
                            <span>Analyzing configuration and generating recommendations...</span>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${this.renderSections(data.sections)}

                <!-- Info Modal -->
                <div id="infoModal" class="info-modal" onclick="closeInfoModalOnBackdrop(event)">
                    <div class="info-modal-content">
                        <div class="info-modal-header">
                            <div class="info-modal-title">
                                <span id="infoModalFieldName" class="info-modal-field"></span>
                            </div>
                            <button class="info-modal-close" onclick="closeInfoModal()" aria-label="Close">×</button>
                        </div>
                        <div class="info-modal-body" id="infoModalDescription"></div>
                        <div class="info-modal-ai-content" id="infoModalAIContent"></div>
                        ${data.showAIAdvisor ? `
                        <div class="info-modal-footer">
                            <button class="info-modal-ai-btn" id="infoModalAIButton" onclick="fetchAIDetails()">
                                🤖 Get AI Details
                            </button>
                        </div>
                        ` : `
                        <div class="info-modal-footer" style="justify-content: center;">
                            <div style="color: var(--vscode-descriptionForeground); font-size: 12px; text-align: center; padding: 8px;">
                                💡 Install <a href="https://marketplace.visualstudio.com/items?itemName=GitHub.copilot" target="_blank" style="color: var(--vscode-textLink-foreground);">GitHub Copilot</a> to enable AI-powered parameter details
                            </div>
                        </div>
                        `}
                    </div>
                </div>

                <script>
                    ${this.getScript(data)}

                    // Info Modal Functions
                    let currentFieldName = '';

                    function showInfoModal(element) {
                        const fieldName = element.getAttribute('data-field');
                        const description = element.getAttribute('data-description');

                        currentFieldName = fieldName;

                        const modal = document.getElementById('infoModal');
                        const fieldNameEl = document.getElementById('infoModalFieldName');
                        const descriptionEl = document.getElementById('infoModalDescription');
                        const aiContentEl = document.getElementById('infoModalAIContent');
                        const aiButton = document.getElementById('infoModalAIButton');

                        fieldNameEl.textContent = fieldName;
                        descriptionEl.textContent = description;
                        
                        // Reset AI content (only if AI is available)
                        if (aiContentEl) {
                            aiContentEl.classList.remove('show');
                            aiContentEl.innerHTML = '';
                        }
                        if (aiButton) {
                            aiButton.disabled = false;
                            aiButton.innerHTML = '🤖 Get AI Details';
                        }

                        modal.classList.add('show');
                    }

                    function closeInfoModal() {
                        const modal = document.getElementById('infoModal');
                        modal.classList.remove('show');
                        currentFieldName = '';
                    }

                    function closeInfoModalOnBackdrop(event) {
                        if (event.target.id === 'infoModal') {
                            closeInfoModal();
                        }
                    }

                    function fetchAIDetails() {
                        if (!currentFieldName) return;

                        const aiContentEl = document.getElementById('infoModalAIContent');
                        const aiButton = document.getElementById('infoModalAIButton');

                        // Check if AI button exists (AI might not be available)
                        if (!aiButton || !aiContentEl) {
                            console.warn('AI features not available');
                            return;
                        }

                        // Show loading state
                        aiButton.disabled = true;
                        aiButton.innerHTML = '<span class="spinner"></span> Loading...';
                        
                        aiContentEl.innerHTML = '<div class="info-modal-ai-loading"><span class="spinner"></span></div>';
                        aiContentEl.classList.add('show');

                        // Request AI details from extension
                        vscode.postMessage({
                            command: 'getAIParameterDetails',
                            parameter: currentFieldName
                        });
                    }

                    // Listen for AI response
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'aiParameterDetailsResponse') {
                            const aiContentEl = document.getElementById('infoModalAIContent');
                            const aiButton = document.getElementById('infoModalAIButton');

                            if (message.success) {
                                aiContentEl.innerHTML = \`
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-weight: 600; color: #667eea;">
                                        🤖 AI-Enhanced Details
                                    </div>
                                    <div style="white-space: pre-wrap;">\${message.content}</div>
                                \`;
                                aiButton.innerHTML = '✓ Details Loaded';
                            } else {
                                aiContentEl.innerHTML = \`
                                    <div style="color: var(--vscode-errorForeground);">
                                        ❌ Failed to fetch AI details: \${message.error || 'Unknown error'}
                                    </div>
                                \`;
                                aiButton.disabled = false;
                                aiButton.innerHTML = '🤖 Retry AI Details';
                            }
                        }
                    });

                    // Close modal on Escape key
                    document.addEventListener('keydown', function(event) {
                        if (event.key === 'Escape') {
                            closeInfoModal();
                        }
                    });

                    // Toggle all values between raw and human-readable format
                    function toggleAllFormats() {
                        const allToggles = document.querySelectorAll('.format-toggle');
                        if (allToggles.length === 0) return;

                        // Check current format of first element to determine what to do
                        const firstToggle = allToggles[0];
                        const currentFormat = firstToggle.getAttribute('data-format');
                        const newFormat = currentFormat === 'raw' ? 'human' : 'raw';

                        // Toggle all elements
                        allToggles.forEach(element => {
                            const rawValue = element.getAttribute('data-raw');
                            const humanValue = element.getAttribute('data-human');

                            element.setAttribute('data-format', newFormat);

                            // Update text content (first text node)
                            const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                            if (textNode) {
                                textNode.textContent = newFormat === 'human' ? humanValue : rawValue;
                            }
                        });

                        // Update header icon appearance
                        const headerIcon = document.querySelector('.human-icon-header');
                        if (headerIcon) {
                            if (newFormat === 'human') {
                                headerIcon.classList.add('active');
                                headerIcon.title = 'Click to show raw values';
                            } else {
                                headerIcon.classList.remove('active');
                                headerIcon.title = 'Click to show human-readable values';
                            }
                        }
                    }
                </script>
            </body>
            </html>
        `;
    }

    private renderSections(sections: Section[]): string {
        return sections.map(section => {
            if (section.type === 'tabs') {
                return this.renderTabs(section);
            }
            return this.renderSection(section);
        }).join('');
    }

    private renderSection(section: Section): string {
        return `
            <div class="section">
                <div class="section-title">${section.icon || '📊'} ${section.title}</div>
                ${section.properties ? this.renderProperties(section.properties) : ''}
                ${section.table ? this.renderTable(section.table) : ''}
                ${section.html ? section.html : ''}
            </div>
        `;
    }

    private renderProperties(properties: Property[]): string {
        const fieldDescriptions = FieldDescriptions.getInstance();

        return `
            <div class="property-grid">
                ${properties.map(prop => {
                    const infoIcon = fieldDescriptions.getInfoIconHtml(prop.label);
                    return `
                    <div class="property">
                        <div class="property-label">${prop.label}${infoIcon}</div>
                        <div class="property-value">
                            ${prop.badge ? `<span class="badge badge-${prop.badge.type}">${prop.badge.text}</span>` : ''}
                            ${prop.code ? `<code>${this.escapeHtml(prop.value)}</code>` : this.escapeHtml(prop.value)}
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    private renderTable(table: TableData): string {
        if (!table.rows || table.rows.length === 0) {
            return '<div class="empty-state">No data available</div>';
        }

        const fieldDescriptions = FieldDescriptions.getInstance();

        // Determine which columns contain Property and Value for config tables
        const propertyColIndex = table.headers.findIndex(h => {
            const label = typeof h === 'string' ? h : h.label;
            return label && label.toUpperCase() === 'PROPERTY';
        });
        const valueColIndex = table.headers.findIndex(h => {
            const label = typeof h === 'string' ? h : h.label;
            return label && label.toUpperCase() === 'VALUE';
        });

        const isConfigTable = propertyColIndex >= 0 && valueColIndex >= 0;

        return `
            <table class="table">
                <thead>
                    <tr>
                        ${table.headers.map((h, colIndex) => {
                            const isValueColumn = isConfigTable && colIndex === valueColIndex;

                            if (typeof h === 'string') {
                                // Check if this is a configuration property (from first column)
                                const infoIcon = fieldDescriptions.getInfoIconHtml(h);
                                // Add human icon to VALUE column header if it's a config table
                                const humanIcon = isValueColumn
                                    ? ` <span class="human-icon-header" onclick="toggleAllFormats()" title="Click to toggle between raw and human-readable format for all values">👤</span>`
                                    : '';
                                return `<th title="Column: ${h}">${h}${infoIcon}${humanIcon}</th>`;
                            } else {
                                const tooltip = h.tooltip || `Column: ${h.label}`;
                                const infoIcon = fieldDescriptions.getInfoIconHtml(h.label);
                                const humanIcon = isValueColumn
                                    ? ` <span class="human-icon-header" onclick="toggleAllFormats()" title="Click to toggle between raw and human-readable format for all values">👤</span>`
                                    : '';
                                return `<th title="${tooltip}" style="cursor: help;">${h.label}${infoIcon}${humanIcon}</th>`;
                            }
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${table.rows.map(row => `
                        <tr>
                            ${row.map((cell, colIndex) => {
                                let cellContent = this.escapeHtml(String(cell));

                                // Add info icon to first column cells (property names in config tables)
                                if (colIndex === 0 && typeof cell === 'string') {
                                    const infoIcon = fieldDescriptions.getInfoIconHtml(cell);
                                    cellContent = cellContent + infoIcon;
                                }

                                // Add human-readable data attributes for config table VALUE column
                                if (isConfigTable && colIndex === valueColIndex && propertyColIndex >= 0) {
                                    const propertyName = String(row[propertyColIndex]);
                                    const rawValue = String(cell);

                                    // Check if this property should have human-readable format
                                    if ((isMillisecondsProperty(propertyName) || isBytesProperty(propertyName)) &&
                                        rawValue !== 'N/A' && rawValue !== '' && !isNaN(parseFloat(rawValue))) {

                                        const formatType = isMillisecondsProperty(propertyName) ? 'ms' : 'bytes';
                                        const humanValue = formatType === 'ms'
                                            ? formatMilliseconds(rawValue)
                                            : formatBytes(rawValue);

                                        cellContent = `
                                            <span class="format-toggle" data-raw="${this.escapeHtml(rawValue)}" data-human="${this.escapeHtml(humanValue)}" data-format="raw">
                                                ${cellContent}
                                            </span>
                                        `;
                                    }
                                }

                                return `<td>${cellContent}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    private renderTabs(section: Section): string {
        const tabs = section.tabs || [];
        return `
            <div class="tabs">
                ${tabs.map((tab, i) => `
                    <button class="tab ${i === 0 ? 'active' : ''}" data-tab="tab-${i}" onclick="switchTab('tab-${i}')">
                        ${tab.title}
                    </button>
                `).join('')}
            </div>
            ${tabs.map((tab, i) => `
                <div id="tab-${i}" class="tab-content ${i === 0 ? 'active' : ''}">
                    ${this.renderSection(tab)}
                </div>
            `).join('')}
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}

// Type definitions
export interface DetailsData {
    title?: string;
    notice?: {
        type: 'info' | 'warning' | 'danger';
        text: string;
    };
    showCopyButton?: boolean;
    showRefreshButton?: boolean;
    showAIAdvisor?: boolean;
    sections: Section[];
}

export interface Section {
    title: string;
    icon?: string;
    type?: 'default' | 'tabs';
    properties?: Property[];
    table?: TableData;
    tabs?: Section[];
    html?: string;
}

export interface Property {
    label: string;
    value: string;
    code?: boolean;
    badge?: {
        type: 'success' | 'warning' | 'danger' | 'info';
        text: string;
    };
}

export interface TableData {
    headers: string[] | { label: string; tooltip?: string }[];
    rows: any[][];
}
