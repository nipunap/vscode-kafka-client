import * as vscode from 'vscode';
import { Logger } from '../infrastructure/Logger';

interface ConsumerGroupInfo {
    groupId: string;
    state: string;
}

/**
 * Webview for displaying large lists of consumer groups with pagination
 * Used when consumer group count exceeds kafka.explorer.largeListThreshold
 */
export class ConsumerGroupsWebview {
    private static instance: ConsumerGroupsWebview | null = null;
    private panel: vscode.WebviewPanel | null = null;
    private logger = Logger.getLogger('ConsumerGroupsWebview');
    private readonly PAGE_SIZE = 100; // Consumer groups per page

    private constructor() {}

    public static getInstance(): ConsumerGroupsWebview {
        if (!ConsumerGroupsWebview.instance) {
            ConsumerGroupsWebview.instance = new ConsumerGroupsWebview();
        }
        return ConsumerGroupsWebview.instance;
    }

    /**
     * Show consumer groups in a paginated webview
     */
    public async show(clusterName: string, groups: ConsumerGroupInfo[]): Promise<void> {
        this.logger.info(`Showing ${groups.length} consumer groups for cluster: ${clusterName}`);

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'kafkaConsumerGroupsList',
                `👥 Consumer Groups: ${clusterName}`,
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
                message => this.handleMessage(message, clusterName, groups),
                undefined
            );
        }

        this.panel.webview.html = this.getHtmlContent(clusterName, groups);
    }

    private handleMessage(message: any, clusterName: string, _groups: ConsumerGroupInfo[]): void {
        switch (message.command) {
            case 'viewConsumerGroup':
                // Trigger consumer group selection in tree view
                vscode.commands.executeCommand('kafka.showConsumerGroupDetails', {
                    clusterName,
                    groupId: message.groupId
                });
                break;
            default:
                // SEC-3.7-3: Ignore unknown commands (whitelist approach)
                this.logger.warn(`Unknown command received: ${message.command}`);
        }
    }

    private getHtmlContent(clusterName: string, groups: ConsumerGroupInfo[]): string {
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
        const totalGroups = groups.length;
        const totalPages = Math.ceil(totalGroups / this.PAGE_SIZE);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consumer Groups: ${escapedClusterName}</title>
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

        .groups-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        .groups-table th {
            text-align: left;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 2px solid var(--vscode-panel-border);
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .groups-table td {
            padding: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .groups-table tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .group-name {
            font-family: 'Courier New', monospace;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
        }

        .group-name:hover {
            text-decoration: underline;
        }

        .state-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .state-stable {
            background-color: rgba(0, 255, 0, 0.2);
            color: #00ff00;
        }

        .state-empty {
            background-color: rgba(255, 165, 0, 0.2);
            color: #ffa500;
        }

        .state-dead {
            background-color: rgba(255, 0, 0, 0.2);
            color: #ff0000;
        }

        .state-rebalancing {
            background-color: rgba(255, 255, 0, 0.2);
            color: #ffff00;
        }

        .state-unknown {
            background-color: rgba(128, 128, 128, 0.2);
            color: #808080;
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
    </style>
</head>
<body>
    <div class="header">
        <div class="title">👥 Consumer Groups: ${escapedClusterName}</div>
        <div class="stats">Total: ${totalGroups} groups</div>
    </div>

    <div class="search-bar">
        <input 
            type="text" 
            id="searchInput" 
            class="search-input" 
            placeholder="🔍 Search consumer groups by name or state..." 
            oninput="filterGroups()"
        >
    </div>

    <table class="groups-table" id="groupsTable">
        <thead>
            <tr>
                <th style="width: 50px;">#</th>
                <th>Group ID</th>
                <th style="width: 150px;">State</th>
                <th style="width: 120px;">Actions</th>
            </tr>
        </thead>
        <tbody id="groupsBody">
            <!-- Populated by JavaScript -->
        </tbody>
    </table>

    <div class="pagination">
        <button onclick="goToPage(1)" id="firstBtn">⏮️ First</button>
        <button onclick="goToPage(currentPage - 1)" id="prevBtn">◀️ Previous</button>
        <span class="page-info">
            Page <span id="currentPageDisplay">1</span> of <span id="totalPagesDisplay">${totalPages}</span>
        </span>
        <button onclick="goToPage(currentPage + 1)" id="nextBtn">Next ▶️</button>
        <button onclick="goToPage(totalPages)" id="lastBtn">Last ⏭️</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // SEC-3.7-2: Escape HTML in JavaScript context
        const allGroups = ${JSON.stringify(groups.map(g => ({ groupId: g.groupId, state: g.state })))};
        let filteredGroups = [...allGroups];
        let currentPage = 1;
        const pageSize = ${this.PAGE_SIZE};
        const totalPages = Math.ceil(filteredGroups.length / pageSize);

        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function getStateClass(state) {
            const lowerState = state.toLowerCase();
            if (lowerState === 'stable') {
                return 'state-stable';
            } else if (lowerState === 'empty') {
                return 'state-empty';
            } else if (lowerState === 'dead') {
                return 'state-dead';
            } else if (lowerState.includes('rebalance')) {
                return 'state-rebalancing';
            }
            return 'state-unknown';
        }

        function getStateLabel(state) {
            const lowerState = state.toLowerCase();
            if (lowerState === 'stable') {
                return 'Active';
            } else if (lowerState === 'empty') {
                return 'Empty';
            } else if (lowerState === 'dead') {
                return 'Dead';
            }
            return state;
        }

        function renderGroups() {
            const tbody = document.getElementById('groupsBody');
            const startIdx = (currentPage - 1) * pageSize;
            const endIdx = Math.min(startIdx + pageSize, filteredGroups.length);
            const pageGroups = filteredGroups.slice(startIdx, endIdx);

            if (pageGroups.length === 0) {
                tbody.innerHTML = \`
                    <tr>
                        <td colspan="4">
                            <div class="empty-state">
                                <div class="empty-state-icon">🔍</div>
                                <div>No consumer groups found matching your search</div>
                            </div>
                        </td>
                    </tr>
                \`;
                return;
            }

            tbody.innerHTML = pageGroups.map((group, idx) => {
                const globalIdx = startIdx + idx + 1;
                const escapedGroupId = escapeHtml(group.groupId);
                const escapedState = escapeHtml(group.state);
                const stateClass = getStateClass(group.state);
                const stateLabel = getStateLabel(group.state);

                return \`
                    <tr>
                        <td>\${globalIdx}</td>
                        <td>
                            <span class="group-name" onclick="viewConsumerGroup('\${escapedGroupId}')">
                                \${escapedGroupId}
                            </span>
                        </td>
                        <td>
                            <span class="state-badge \${stateClass}">\${stateLabel}</span>
                        </td>
                        <td>
                            <div class="actions">
                                <button class="btn" onclick="viewConsumerGroup('\${escapedGroupId}')">
                                    📊 Details
                                </button>
                            </div>
                        </td>
                    </tr>
                \`;
            }).join('');

            updatePaginationControls();
        }

        function updatePaginationControls() {
            const totalPagesForFiltered = Math.ceil(filteredGroups.length / pageSize);
            
            document.getElementById('currentPageDisplay').textContent = currentPage;
            document.getElementById('totalPagesDisplay').textContent = totalPagesForFiltered;
            
            document.getElementById('firstBtn').disabled = currentPage === 1;
            document.getElementById('prevBtn').disabled = currentPage === 1;
            document.getElementById('nextBtn').disabled = currentPage >= totalPagesForFiltered;
            document.getElementById('lastBtn').disabled = currentPage >= totalPagesForFiltered;
        }

        function goToPage(page) {
            const totalPagesForFiltered = Math.ceil(filteredGroups.length / pageSize);
            if (page < 1 || page > totalPagesForFiltered) {
                return;
            }
            currentPage = page;
            renderGroups();
        }

        function filterGroups() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            
            if (!searchTerm) {
                filteredGroups = [...allGroups];
            } else {
                filteredGroups = allGroups.filter(group => 
                    group.groupId.toLowerCase().includes(searchTerm) ||
                    group.state.toLowerCase().includes(searchTerm)
                );
            }
            
            currentPage = 1; // Reset to first page on filter
            renderGroups();
        }

        function viewConsumerGroup(groupId) {
            vscode.postMessage({
                command: 'viewConsumerGroup',
                groupId: groupId
            });
        }

        // Initial render
        renderGroups();
    </script>
</body>
</html>`;
    }

    /**
     * Reset singleton instance (for testing)
     */
    public static resetInstance(): void {
        if (ConsumerGroupsWebview.instance?.panel) {
            ConsumerGroupsWebview.instance.panel.dispose();
        }
        ConsumerGroupsWebview.instance = null;
    }
}

