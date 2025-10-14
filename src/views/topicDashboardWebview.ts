import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { Logger } from '../infrastructure/Logger';

// Constants for topic dashboard
const TOPIC_CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes cache validity for topic data

export class TopicDashboardWebview {
    private panel: vscode.WebviewPanel | undefined;
    private logger = Logger.getLogger('TopicDashboardWebview');
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private readonly CACHE_TTL_MS = TOPIC_CACHE_TTL_MS;

    constructor(
        private context: vscode.ExtensionContext,
        private clientManager: KafkaClientManager
    ) {}

    async show(clusterName: string, topicName: string) {
        this.logger.info(`Opening topic dashboard for ${clusterName}/${topicName}`);

        const cacheKey = `${clusterName}/${topicName}`;

        // Create webview panel
        this.panel = vscode.window.createWebviewPanel(
            'topicDashboard',
            `📊 ${topicName} Dashboard`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'resources')
                ]
            }
        );

        // Handle panel disposal
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message, clusterName, topicName),
            undefined,
            this.context.subscriptions
        );

        // Check if we have cached data that's still valid
        const cached = this.cache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.CACHE_TTL_MS) {
            // Use cached data
            this.logger.debug(`Using cached data for ${cacheKey} (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
            this.updateDashboardFromCache(topicName, cached.data, cached.timestamp);
        } else {
            // Show loading and fetch fresh data
            this.logger.debug(`Fetching fresh data for ${cacheKey} (cache ${cached ? 'expired' : 'missing'})`);
            this.panel.webview.html = this.getLoadingHtml(topicName);
            this.loadTopicData(clusterName, topicName);
        }
    }

    private async loadTopicData(clusterName: string, topicName: string, forceRefresh: boolean = false) {
        const cacheKey = `${clusterName}/${topicName}`;

        try {
            this.logger.debug(`Loading topic data for ${clusterName}/${topicName} (force: ${forceRefresh})`);

            // Fetch topic details, metadata, and ACLs in parallel
            const [topicDetails, topicMetadata, topicACLs] = await Promise.all([
                this.clientManager.getTopicDetails(clusterName, topicName),
                this.clientManager.getTopicMetadata(clusterName, topicName),
                this.clientManager.getTopicACLs(clusterName, topicName).catch(() => [])
            ]);

            // Calculate metrics
            const metrics = this.calculateTopicMetrics(topicDetails);
            const partitionInfo = this.extractPartitionInfo(topicMetadata);

            // Cache the data
            const timestamp = Date.now();
            this.cache.set(cacheKey, {
                data: { metrics, partitionInfo, topicDetails, topicACLs },
                timestamp
            });

            this.logger.debug(`Cached data for ${cacheKey}`);

            // Update webview with data
            this.updateDashboard(topicName, metrics, partitionInfo, topicDetails, topicACLs, timestamp);

        } catch (error: any) {
            this.logger.error(`Failed to load topic data for ${clusterName}/${topicName}`, error);
            this.showError(`Failed to load topic data: ${error?.message || error}`);
        }
    }

    private calculateTopicMetrics(topicDetails: any): any {
        this.logger.debug('Calculating metrics for topic details:', topicDetails);

        if (!topicDetails) {
            this.logger.warn('No topic details provided');
            return this.getEmptyMetrics();
        }

        // topicDetails.partitions is a number (partition count)
        // topicDetails.partitionDetails is an object with partition data
        const partitionCount = topicDetails.partitions || 0;
        const partitionDetails = topicDetails.partitionDetails || {};

        if (partitionCount === 0) {
            this.logger.warn('No partitions found in topic details');
            return this.getEmptyMetrics();
        }

        let totalMessages = 0;
        let totalSize = 0;
        const partitions: any[] = [];

        // Process each partition from partitionDetails object
        Object.keys(partitionDetails).forEach(partitionId => {
            const partition = partitionDetails[partitionId];

            if (partition.lowWaterMark && partition.highWaterMark) {
                try {
                    const messages = BigInt(partition.highWaterMark) - BigInt(partition.lowWaterMark);
                    const messageCount = Number(messages);
                    totalMessages += messageCount;

                    partitions.push({
                        id: partition.partition,
                        leader: partition.leader,
                        replicas: partition.replicas || [],
                        isr: partition.isr || [],
                        earliestOffset: partition.lowWaterMark,
                        latestOffset: partition.highWaterMark,
                        messageCount: messageCount
                    });
                } catch (error) {
                    this.logger.warn(`Error calculating messages for partition ${partition.partition}:`, error);
                    partitions.push({
                        id: partition.partition,
                        leader: partition.leader,
                        replicas: partition.replicas || [],
                        isr: partition.isr || [],
                        earliestOffset: partition.lowWaterMark,
                        latestOffset: partition.highWaterMark,
                        messageCount: 0
                    });
                }
            } else {
                partitions.push({
                    id: partition.partition,
                    leader: partition.leader,
                    replicas: partition.replicas || [],
                    isr: partition.isr || [],
                    earliestOffset: partition.lowWaterMark || '0',
                    latestOffset: partition.highWaterMark || '0',
                    messageCount: 0
                });
            }
        });

        return {
            totalMessages,
            totalSize: totalSize, // We don't have size info from current API
            partitionCount: partitionCount,
            replicationFactor: topicDetails.replicationFactor || 0,
            partitions: partitions
        };
    }

    private getEmptyMetrics(): any {
        return {
            totalMessages: 0,
            totalSize: 0,
            partitionCount: 0,
            replicationFactor: 0,
            partitions: []
        };
    }

    private extractPartitionInfo(topicMetadata: any): any {
        this.logger.debug('Extracting partition info from metadata:', topicMetadata);

        if (!topicMetadata) {
            this.logger.warn('No topic metadata provided');
            return { partitions: [], brokerDistribution: [] };
        }

        if (!topicMetadata.partitions) {
            this.logger.warn('No partitions found in topic metadata');
            return { partitions: [], brokerDistribution: [] };
        }

        const partitions = topicMetadata.partitions;

        // Ensure partitions is an array
        if (!Array.isArray(partitions)) {
            this.logger.error(`Partitions in metadata is not an array: ${typeof partitions}`, partitions);
            return { partitions: [], brokerDistribution: [] };
        }

        // Calculate broker distribution
        const brokerStats = new Map<number, { leader: number; replica: number; isr: number }>();

        partitions.forEach((p: any) => {
            // Count leader partitions
            const leaderId = p.leader;
            if (leaderId !== undefined && leaderId !== -1) {
                if (!brokerStats.has(leaderId)) {
                    brokerStats.set(leaderId, { leader: 0, replica: 0, isr: 0 });
                }
                brokerStats.get(leaderId)!.leader++;
            }

            // Count replica partitions
            if (p.replicas) {
                for (const brokerId of p.replicas) {
                    if (!brokerStats.has(brokerId)) {
                        brokerStats.set(brokerId, { leader: 0, replica: 0, isr: 0 });
                    }
                    brokerStats.get(brokerId)!.replica++;
                }
            }

            // Count ISR partitions
            if (p.isr) {
                for (const brokerId of p.isr) {
                    if (!brokerStats.has(brokerId)) {
                        brokerStats.set(brokerId, { leader: 0, replica: 0, isr: 0 });
                    }
                    brokerStats.get(brokerId)!.isr++;
                }
            }
        });

        // Convert broker stats to array and sort by broker ID
        const brokerDistribution = Array.from(brokerStats.entries())
            .map(([brokerId, stats]) => ({
                brokerId,
                leaderCount: stats.leader,
                replicaCount: stats.replica,
                isrCount: stats.isr
            }))
            .sort((a, b) => a.brokerId - b.brokerId);

        return {
            partitions: partitions.map((p: any) => ({
                id: p.partitionId,
                leader: p.leader,
                replicas: p.replicas || [],
                isr: p.isr || []
            })),
            brokerDistribution
        };
    }

    private updateDashboard(topicName: string, metrics: any, _partitionInfo: any, _topicDetails: any, acls: any[] = [], timestamp?: number) {
        if (!this.panel) {
            return;
        }

        const html = this.getDashboardHtml(topicName, metrics, _partitionInfo, _topicDetails, acls, timestamp);
        this.panel.webview.html = html;
    }

    private updateDashboardFromCache(topicName: string, cachedData: any, timestamp: number) {
        if (!this.panel) {
            return;
        }

        const { metrics, partitionInfo, topicDetails, topicACLs } = cachedData;
        this.updateDashboard(topicName, metrics, partitionInfo, topicDetails, topicACLs, timestamp);
    }

    private showError(message: string) {
        if (!this.panel) {
            return;
        }

        this.panel.webview.html = this.getErrorHtml(message);
    }

    private handleMessage(message: any, clusterName: string, topicName: string) {
        switch (message.command) {
            case 'refresh':
                this.logger.info(`Refreshing dashboard for ${clusterName}/${topicName}`);
                // Clear cache entry for this topic and force refresh
                const cacheKey = `${clusterName}/${topicName}`;
                this.cache.delete(cacheKey);
                // Show loading state
                if (this.panel) {
                    this.panel.webview.html = this.getLoadingHtml(topicName);
                }
                this.loadTopicData(clusterName, topicName, true);
                break;
            case 'showLogs':
                this.logger.show();
                break;
        }
    }

    private getLoadingHtml(topicName: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Topic Dashboard</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        margin: 0;
                        padding: 20px;
                    }
                    .loading-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 300px;
                    }
                    .spinner {
                        border: 4px solid var(--vscode-panel-border);
                        border-top: 4px solid var(--vscode-textLink-foreground);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin-bottom: 20px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .loading-text {
                        font-size: 16px;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <div class="loading-container">
                    <div class="spinner"></div>
                    <div class="loading-text">Loading ${topicName} dashboard...</div>
                </div>
            </body>
            </html>
        `;
    }

    private getErrorHtml(message: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Topic Dashboard Error</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        margin: 0;
                        padding: 20px;
                    }
                    .error-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 300px;
                        text-align: center;
                    }
                    .error-icon {
                        font-size: 48px;
                        margin-bottom: 20px;
                    }
                    .error-message {
                        font-size: 16px;
                        color: var(--vscode-errorForeground);
                        margin-bottom: 20px;
                    }
                    .error-actions {
                        display: flex;
                        gap: 10px;
                    }
                    button {
                        padding: 8px 16px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 2px;
                        cursor: pointer;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">❌</div>
                    <div class="error-message">${message}</div>
                    <div class="error-actions">
                        <button onclick="refresh()">🔄 Retry</button>
                        <button onclick="showLogs()">📝 Show Logs</button>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    function refresh() {
                        vscode.postMessage({ command: 'refresh' });
                    }
                    function showLogs() {
                        vscode.postMessage({ command: 'showLogs' });
                    }
                </script>
            </body>
            </html>
        `;
    }

    private getDashboardHtml(topicName: string, metrics: any, _partitionInfo: any, _topicDetails: any, acls: any[] = [], timestamp?: number): string {
        const cacheAge = timestamp ? Math.round((Date.now() - timestamp) / 1000) : 0;
        const cacheInfo = timestamp
            ? `📍 Data age: ${cacheAge < 60 ? `${cacheAge}s` : `${Math.round(cacheAge / 60)}m`} | Last updated: ${new Date(timestamp).toLocaleTimeString()}`
            : '📍 Live data';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${topicName} Dashboard</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        margin: 0;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 30px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    .header h1 {
                        margin: 0;
                        color: var(--vscode-textLink-foreground);
                    }
                    .header-info {
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                    }
                    .cache-badge {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        background: var(--vscode-badge-background);
                        padding: 2px 8px;
                        border-radius: 10px;
                        display: inline-block;
                    }
                    .header-actions {
                        display: flex;
                        gap: 10px;
                    }
                    button {
                        padding: 6px 12px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 2px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .metrics-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .metric-card {
                        background: var(--vscode-panel-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        padding: 15px;
                        text-align: center;
                    }
                    .metric-value {
                        font-size: 24px;
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                        margin-bottom: 5px;
                    }
                    .metric-label {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        text-transform: uppercase;
                    }
        .charts-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }

        .chart-container {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
        }
                    .chart-title {
                        font-size: 16px;
                        font-weight: bold;
                        margin-bottom: 15px;
                        color: var(--vscode-foreground);
                    }
                    .partitions-table {
                        background: var(--vscode-panel-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        overflow: hidden;
                    }
                    .table-header {
                        background: var(--vscode-panel-border);
                        padding: 12px;
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .table-row {
                        padding: 10px 12px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        display: grid;
                        grid-template-columns: 1fr 1fr 2fr 1fr;
                        gap: 10px;
                        align-items: center;
                    }
                    .table-row:last-child {
                        border-bottom: none;
                    }
                    .partition-id {
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                    }
                    .leader-info {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .message-count {
                        font-weight: bold;
                        color: var(--vscode-charts-green);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-info">
                        <h1>📊 ${topicName} Dashboard</h1>
                        <span class="cache-badge">${cacheInfo}</span>
                    </div>
                    <div class="header-actions">
                        <button onclick="refresh()">🔄 Refresh</button>
                        <button onclick="showLogs()">📝 Logs</button>
                    </div>
                </div>

                <div class="metrics-grid">
                    <div class="metric-card" title="Sum of all messages across all partitions in this topic" style="cursor: help;">
                        <div class="metric-value">${metrics.totalMessages.toLocaleString()}</div>
                        <div class="metric-label">Total Messages</div>
                    </div>
                    <div class="metric-card" title="Number of partitions in this topic (higher = more parallelism for consumers)" style="cursor: help;">
                        <div class="metric-value">${metrics.partitionCount}</div>
                        <div class="metric-label">Partitions</div>
                    </div>
                    <div class="metric-card" title="Number of replicas for each partition (higher = more fault tolerance)" style="cursor: help;">
                        <div class="metric-value">${metrics.replicationFactor}</div>
                        <div class="metric-label">Replication Factor</div>
                    </div>
                    <div class="metric-card" title="Average number of messages per partition (total messages / partition count)" style="cursor: help;">
                        <div class="metric-value">${metrics.partitions.length > 0 ?
                            Math.round(metrics.totalMessages / metrics.partitionCount).toLocaleString() : 0}</div>
                        <div class="metric-label">Avg Messages/Partition</div>
                    </div>
                </div>

                <div class="charts-row">
                    <div class="chart-container">
                        <div class="chart-title" title="Shows how messages are distributed across partitions (hover over bars for details)" style="cursor: help;">📈 Message Distribution Over Partitions</div>
                        <canvas id="partitionChart" width="400" height="200"></canvas>
                    </div>

                    <div class="chart-container">
                        <div class="chart-title" title="Partition distribution: Leaders (blue), Replicas (green), ISR (orange) across brokers" style="cursor: help;">🔄 Broker Partition Distribution</div>
                        <canvas id="brokerDistributionChart" width="400" height="200"></canvas>
                    </div>
                </div>

                <div class="partitions-table">
                    <div class="table-header" title="Detailed information about each partition in this topic" style="cursor: help;">Partition Details</div>
                    ${metrics.partitions.map((p: any) => `
                        <div class="table-row">
                            <div class="partition-id" title="Partition identifier within the topic">Partition ${p.id}</div>
                            <div class="leader-info" title="Broker ID that is the leader for this partition">Leader: ${p.leader}</div>
                            <div class="leader-info" title="Broker IDs that store replicas of this partition">Replicas: ${p.replicas.join(', ')}</div>
                            <div class="message-count" title="Total number of messages in this partition">${p.messageCount.toLocaleString()} messages</div>
                        </div>
                    `).join('')}
                </div>

                ${acls.length > 0 ? `
                <div class="partitions-table" style="margin-top: 30px;">
                    <div class="table-header" title="Access control rules that define who can perform operations on this topic" style="cursor: help;">🔒 Access Control Lists (ACLs)</div>
                    ${acls.map((acl: any) => {
                        const icon = acl.permissionType?.toLowerCase() === 'allow' ? '✓' : '✗';
                        const color = acl.permissionType?.toLowerCase() === 'allow' ? '#4caf50' : '#f44336';
                        const principal = acl.principal?.replace('User:', '') || 'Unknown';
                        return `
                        <div class="table-row" title="ACL: ${principal} can ${acl.operation} from ${acl.host || '*'}">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="color: ${color}; font-weight: bold; font-size: 18px;" title="${acl.permissionType} permission">${icon}</span>
                                <div>
                                    <div style="font-weight: bold;">${principal} → ${acl.operation || 'Unknown'}</div>
                                    <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">
                                        ${acl.permissionType || 'Unknown'} | Resource: ${acl.resourceName || 'Unknown'} | Host: ${acl.host || '*'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                ` : `
                <div class="partitions-table" style="margin-top: 30px;">
                    <div class="table-header" title="No access control rules are configured for this topic" style="cursor: help;">🔒 Access Control Lists (ACLs)</div>
                    <div class="table-row">
                        <div style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground);">
                            No ACLs configured for this topic, or ACL management CLI tool is not available.
                        </div>
                    </div>
                </div>
                `}

                <script>
                    const vscode = acquireVsCodeApi();

                    function refresh() {
                        vscode.postMessage({ command: 'refresh' });
                    }

                    function showLogs() {
                        vscode.postMessage({ command: 'showLogs' });
                    }

                    // Initialize partition distribution chart
                    const partitionCtx = document.getElementById('partitionChart').getContext('2d');
                    const partitionData = ${JSON.stringify(metrics.partitions.map((p: any) => ({
                        partition: p.id,
                        messages: p.messageCount
                    })))};

                    new Chart(partitionCtx, {
                        type: 'bar',
                        data: {
                            labels: partitionData.map(p => \`Partition \${p.partition}\`),
                            datasets: [{
                                label: 'Messages',
                                data: partitionData.map(p => p.messages),
                                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: {
                                    display: false
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: function(value) {
                                            return value.toLocaleString();
                                        }
                                    }
                                }
                            }
                        }
                    });

                    // Initialize broker distribution chart with leaders, replicas, and ISR
                    const brokerDistCtx = document.getElementById('brokerDistributionChart').getContext('2d');
                    const brokerDistribution = ${JSON.stringify(_partitionInfo.brokerDistribution || [])};

                    new Chart(brokerDistCtx, {
                        type: 'bar',
                        data: {
                            labels: brokerDistribution.map(b => \`Broker \${b.brokerId}\`),
                            datasets: [
                                {
                                    label: 'Leaders',
                                    data: brokerDistribution.map(b => b.leaderCount),
                                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                                    borderWidth: 0
                                },
                                {
                                    label: 'Replicas',
                                    data: brokerDistribution.map(b => b.replicaCount),
                                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                                    borderWidth: 0
                                },
                                {
                                    label: 'ISR',
                                    data: brokerDistribution.map(b => b.isrCount),
                                    backgroundColor: 'rgba(255, 159, 64, 0.8)',
                                    borderWidth: 0
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top'
                                },
                                tooltip: {
                                    callbacks: {
                                        label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1,
                                        callback: function(value) {
                                            return Math.floor(value);
                                        }
                                    }
                                }
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
