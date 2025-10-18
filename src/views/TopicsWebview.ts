import * as vscode from 'vscode';
import { Logger } from '../infrastructure/Logger';

/**
 * Webview for displaying large lists of topics with pagination
 * Used when topic count exceeds kafka.explorer.largeListThreshold
 */
export class TopicsWebview {
    private static instance: TopicsWebview | null = null;
    private panel: vscode.WebviewPanel | null = null;
    private logger = Logger.getLogger('TopicsWebview');
    private readonly PAGE_SIZE = 100; // Topics per page

    private constructor() {}

    public static getInstance(): TopicsWebview {
        if (!TopicsWebview.instance) {
            TopicsWebview.instance = new TopicsWebview();
        }
        return TopicsWebview.instance;
    }

    /**
     * Show topics in a paginated webview
     */
    public async show(clusterName: string, topics: string[]): Promise<void> {
        this.logger.info(`Showing ${topics.length} topics for cluster: ${clusterName}`);

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'kafkaTopicsList',
                `📋 Topics: ${clusterName}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = null;
            });

            this.panel.webview.onDidReceiveMessage(
                message => this.handleMessage(message, clusterName, topics),
                undefined
            );
        }

        this.panel.webview.html = this.getHtmlContent(clusterName, topics);
    }

    private handleMessage(message: any, clusterName: string, _topics: string[]): void {
        switch (message.command) {
            case 'viewTopic':
                // Trigger topic selection in tree view
                vscode.commands.executeCommand('kafka.showTopicDetails', {
                    clusterName,
                    topicName: message.topicName
                });
                break;
            case 'consumeTopic':
                vscode.commands.executeCommand('kafka.consumeMessages', {
                    clusterName,
                    topicName: message.topicName
                });
                break;
            case 'produceTopic':
                vscode.commands.executeCommand('kafka.produceMessage', {
                    clusterName,
                    topicName: message.topicName
                });
                break;
            default:
                // SEC-3.7-3: Ignore unknown commands (whitelist approach)
                this.logger.warn(`Unknown command received: ${message.command}`);
        }
    }

    private getHtmlContent(clusterName: string, topics: string[]): string {
        // SEC-3.7-1: Escape HTML to prevent XSS
        const escapeHtml = (unsafe: string): string => {
            return unsafe
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const escapedClusterName = escapeHtml(clusterName);
        const totalTopics = topics.length;
        const totalPages = Math.ceil(totalTopics / this.PAGE_SIZE);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Topics: ${escapedClusterName}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .title {
            font-size: 20px;
            font-weight: 600;
        }

        .stats {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }

        .search-bar {
            margin-bottom: 20px;
        }

        .search-input {
            width: 100%;
            padding: 8px 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 14px;
        }

        .search-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .topics-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        .topics-table th {
            text-align: left;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 2px solid var(--vscode-panel-border);
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .topics-table td {
            padding: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .topics-table tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .topic-name {
            font-family: 'Courier New', monospace;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
        }

        .topic-name:hover {
            text-decoration: underline;
        }

        .actions {
            display: flex;
            gap: 8px;
        }

        .btn {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            margin-top: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
        }

        .pagination button {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }

        .pagination button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .pagination button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }

        .page-info {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }

        .filter-info {
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">📋 Topics: ${escapedClusterName}</div>
        <div class="stats">Total: <strong id="totalTopics">${totalTopics}</strong> topics</div>
    </div>

    <div class="search-bar">
        <input 
            type="text" 
            id="searchInput" 
            class="search-input" 
            placeholder="🔍 Search topics... (client-side filtering)"
            oninput="filterTopics()"
        >
    </div>

    <div id="filterInfo" class="filter-info" style="display: none;">
        Showing <strong id="filteredCount">0</strong> of ${totalTopics} topics
    </div>

    <div id="tableContainer">
        <table class="topics-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Topic Name</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="topicsBody">
                <!-- Topics will be rendered here -->
            </tbody>
        </table>
    </div>

    <div class="pagination">
        <button onclick="goToPage(1)" id="firstBtn">⏮️ First</button>
        <button onclick="goToPage(currentPage - 1)" id="prevBtn">◀️ Previous</button>
        <span class="page-info">
            Page <strong id="currentPageDisplay">1</strong> of <strong id="totalPagesDisplay">${totalPages}</strong>
        </span>
        <button onclick="goToPage(currentPage + 1)" id="nextBtn">Next ▶️</button>
        <button onclick="goToPage(totalPages)" id="lastBtn">Last ⏭️</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // SEC-3.7-1: All topic names are escaped before rendering
        const allTopics = ${JSON.stringify(topics.map(t => escapeHtml(t)))};
        let filteredTopics = [...allTopics];
        let currentPage = 1;
        const pageSize = ${this.PAGE_SIZE};
        const totalPages = Math.ceil(allTopics.length / pageSize);

        function escapeHtml(unsafe) {
            const div = document.createElement('div');
            div.textContent = unsafe;
            return div.innerHTML;
        }

        function filterTopics() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            
            if (searchTerm === '') {
                filteredTopics = [...allTopics];
                document.getElementById('filterInfo').style.display = 'none';
            } else {
                filteredTopics = allTopics.filter(topic => 
                    topic.toLowerCase().includes(searchTerm)
                );
                document.getElementById('filterInfo').style.display = 'block';
                document.getElementById('filteredCount').textContent = filteredTopics.length;
            }
            
            currentPage = 1;
            renderPage();
        }

        function renderPage() {
            const tbody = document.getElementById('topicsBody');
            const start = (currentPage - 1) * pageSize;
            const end = Math.min(start + pageSize, filteredTopics.length);
            const pageTopics = filteredTopics.slice(start, end);

            if (pageTopics.length === 0) {
                tbody.innerHTML = \`
                    <tr>
                        <td colspan="3">
                            <div class="empty-state">
                                <div class="empty-state-icon">🔍</div>
                                <div>No topics found matching your search.</div>
                            </div>
                        </td>
                    </tr>
                \`;
            } else {
                tbody.innerHTML = pageTopics.map((topic, idx) => {
                    const globalIndex = start + idx + 1;
                    return \`
                        <tr>
                            <td>\${globalIndex}</td>
                            <td>
                                <span class="topic-name" onclick="viewTopic('\${topic}')">\${topic}</span>
                            </td>
                            <td>
                                <div class="actions">
                                    <button class="btn btn-secondary" onclick="viewTopic('\${topic}')">📊 Details</button>
                                    <button class="btn btn-secondary" onclick="consumeTopic('\${topic}')">📥 Consume</button>
                                    <button class="btn btn-secondary" onclick="produceTopic('\${topic}')">📤 Produce</button>
                                </div>
                            </td>
                        </tr>
                    \`;
                }).join('');
            }

            updatePagination();
        }

        function updatePagination() {
            const currentTotalPages = Math.ceil(filteredTopics.length / pageSize);
            
            document.getElementById('currentPageDisplay').textContent = currentPage;
            document.getElementById('totalPagesDisplay').textContent = currentTotalPages;
            
            document.getElementById('firstBtn').disabled = currentPage === 1;
            document.getElementById('prevBtn').disabled = currentPage === 1;
            document.getElementById('nextBtn').disabled = currentPage >= currentTotalPages;
            document.getElementById('lastBtn').disabled = currentPage >= currentTotalPages;
        }

        function goToPage(page) {
            const maxPage = Math.ceil(filteredTopics.length / pageSize);
            if (page < 1 || page > maxPage) return;
            
            currentPage = page;
            renderPage();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function viewTopic(topicName) {
            vscode.postMessage({
                command: 'viewTopic',
                topicName: topicName
            });
        }

        function consumeTopic(topicName) {
            vscode.postMessage({
                command: 'consumeTopic',
                topicName: topicName
            });
        }

        function produceTopic(topicName) {
            vscode.postMessage({
                command: 'produceTopic',
                topicName: topicName
            });
        }

        // Initial render
        renderPage();
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }
}

