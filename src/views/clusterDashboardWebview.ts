import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';

export class ClusterDashboardWebview {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private clientManager: KafkaClientManager
    ) {}

    async show(clusterName: string) {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'kafkaClusterDashboard',
                `Dashboard: ${clusterName}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });

            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'refresh':
                            // Show loading state
                            this.panel?.webview.postMessage({
                                command: 'startLoading'
                            });

                            // Fetch data in background
                            try {
                                const refreshedStats = await this.getClusterStatistics(clusterName);
                                this.panel?.webview.postMessage({
                                    command: 'updateStats',
                                    data: refreshedStats
                                });
                            } catch (error: any) {
                                this.panel?.webview.postMessage({
                                    command: 'showError',
                                    error: error.message || 'Failed to load dashboard data'
                                });
                            }
                            break;
                    }
                }
            );
        }

        // Show loading state immediately
        this.panel.webview.html = this.getLoadingHtml(clusterName);

        // Fetch cluster statistics in background
        this.loadDashboardData(clusterName);
    }

    private async loadDashboardData(clusterName: string) {
        try {
            const stats = await this.getClusterStatisticsParallel(clusterName);

            // Send data to webview
            this.panel?.webview.postMessage({
                command: 'updateStats',
                data: stats
            });
        } catch (error: any) {
            this.panel?.webview.postMessage({
                command: 'showError',
                error: error.message || 'Failed to load dashboard data'
            });
        }
    }

    /**
     * Get cluster statistics with parallel data fetching and progress updates
     * Uses concurrent promises to fetch all data quickly even for large clusters
     */
    private async getClusterStatisticsParallel(clusterName: string): Promise<any> {
        try {
            // Update progress: Starting
            this.panel?.webview.postMessage({
                command: 'updateProgress',
                progress: { step: 'Starting...', percent: 0 }
            });

            // Phase 1: Get basic cluster info (fast)
            this.panel?.webview.postMessage({
                command: 'updateProgress',
                progress: { step: 'Fetching cluster info...', percent: 10 }
            });

            const [brokers, topics, consumerGroups, clusterStats] = await Promise.all([
                this.clientManager.getBrokers(clusterName),
                this.clientManager.getTopics(clusterName),
                this.clientManager.getConsumerGroups(clusterName),
                this.clientManager.getClusterStatistics(clusterName)
            ]);

            // Phase 2: Calculate partition distribution across ALL topics (parallel batches)
            this.panel?.webview.postMessage({
                command: 'updateProgress',
                progress: { step: `Analyzing ${topics.length} topics...`, percent: 30 }
            });

            const partitionDistribution = await this.calculatePartitionDistribution(
                clusterName,
                topics,
                brokers
            );

            // Phase 3: Get detailed topic info for top topics (parallel)
            this.panel?.webview.postMessage({
                command: 'updateProgress',
                progress: { step: 'Getting topic details...', percent: 70 }
            });

            const topicDetails = await this.getTopTopicsParallel(clusterName, topics);

            // Phase 4: Finalize
            this.panel?.webview.postMessage({
                command: 'updateProgress',
                progress: { step: 'Finalizing...', percent: 90 }
            });

            // Compile broker stats with partition counts
            const brokerStats = brokers.map(broker => ({
                id: broker.nodeId,
                host: broker.host,
                port: broker.port,
                rack: broker.rack || 'N/A',
                partitionCount: partitionDistribution.get(broker.nodeId) || 0
            }));

            // Consumer group states
            const consumerGroupStates = consumerGroups.reduce((acc: any, group: any) => {
                const state = group.state || 'Unknown';
                acc[state] = (acc[state] || 0) + 1;
                return acc;
            }, {});

            return {
                clusterName,
                timestamp: new Date().toISOString(),
                brokers: brokerStats,
                brokerCount: brokers.length,
                topicCount: topics.length,
                topicSample: topicDetails,
                isLimitedTopicScan: false, // We scan all topics now!
                topicsScanned: topics.length,
                consumerGroupCount: consumerGroups.length,
                consumerGroupStates,
                clusterStats
            };
        } catch (error: any) {
            throw new Error(`Failed to fetch cluster statistics: ${error.message}`);
        }
    }

    /**
     * Calculate partition distribution across ALL topics using parallel batch processing
     * Processes topics in concurrent batches for optimal performance
     */
    private async calculatePartitionDistribution(
        clusterName: string,
        topics: string[],
        brokers: any[]
    ): Promise<Map<number, number>> {
        const partitionDistribution: Map<number, number> = new Map();
        brokers.forEach(broker => partitionDistribution.set(broker.nodeId, 0));

        // Process topics in parallel batches of 20 for optimal performance
        const batchSize = 20;
        const batches: string[][] = [];
        for (let i = 0; i < topics.length; i += batchSize) {
            batches.push(topics.slice(i, i + batchSize));
        }

        let processedCount = 0;
        for (const batch of batches) {
            // Process each batch in parallel
            await Promise.all(
                batch.map(async topic => {
                    try {
                        const metadata = await this.clientManager.getTopicMetadata(clusterName, topic);
                        for (const partition of metadata.partitions) {
                            const leaderId = partition.leader;
                            if (leaderId !== undefined && leaderId !== -1) {
                                const count = partitionDistribution.get(leaderId) || 0;
                                partitionDistribution.set(leaderId, count + 1);
                            }
                        }
                    } catch (_error) {
                        // Skip topics we can't access
                    }
                })
            );

            // Update progress after each batch
            processedCount += batch.length;
            this.panel?.webview.postMessage({
                command: 'updateProgress',
                progress: {
                    step: `Analyzed ${processedCount}/${topics.length} topics...`,
                    percent: 30 + Math.floor((processedCount / topics.length) * 40)
                }
            });
        }

        return partitionDistribution;
    }

    /**
     * Get top topics by partition count using parallel processing
     * Fetches all topic metadata in parallel batches, then sorts
     */
    private async getTopTopicsParallel(
        clusterName: string,
        topics: string[]
    ): Promise<any[]> {
        const batchSize = 20;
        const allTopicDetails: any[] = [];

        // Process in batches
        for (let i = 0; i < topics.length; i += batchSize) {
            const batch = topics.slice(i, i + batchSize);

            const batchResults = await Promise.all(
                batch.map(async topicName => {
                    try {
                        const metadata = await this.clientManager.getTopicMetadata(clusterName, topicName);
                        return {
                            name: topicName,
                            partitions: metadata.partitions.length,
                            replicas: metadata.partitions[0]?.replicas?.length || 0
                        };
                    } catch (_error) {
                        return null;
                    }
                })
            );

            allTopicDetails.push(...batchResults.filter(r => r !== null));
        }

        // Sort by partition count and take top 10
        return allTopicDetails
            .sort((a, b) => b.partitions - a.partitions)
            .slice(0, 10);
    }

    private async getClusterStatistics(clusterName: string): Promise<any> {
        try {
            const [
                brokers,
                topics,
                consumerGroups,
                clusterStats
            ] = await Promise.all([
                this.clientManager.getBrokers(clusterName),
                this.clientManager.getTopics(clusterName),
                this.clientManager.getConsumerGroups(clusterName),
                this.clientManager.getClusterStatistics(clusterName)
            ]);

            // Calculate partition distribution per broker
            const partitionDistribution: Map<number, number> = new Map();
            brokers.forEach(broker => partitionDistribution.set(broker.nodeId, 0));

            // Count partitions per broker by examining topic metadata
            for (const topic of topics.slice(0, 100)) { // Limit for performance
                try {
                    const metadata = await this.clientManager.getTopicMetadata(clusterName, topic);
                    for (const partition of metadata.partitions) {
                        const leaderId = partition.leader;
                        if (leaderId !== undefined && leaderId !== -1) {
                            const count = partitionDistribution.get(leaderId) || 0;
                            partitionDistribution.set(leaderId, count + 1);
                        }
                    }
                } catch (_error) {
                    // Skip topics we can't access
                    continue;
                }
            }

            // Get detailed broker stats with partition counts
            const brokerStats = brokers.map(broker => ({
                id: broker.nodeId,
                host: broker.host,
                port: broker.port,
                rack: broker.rack || 'N/A',
                partitionCount: partitionDistribution.get(broker.nodeId) || 0
            }));

            // Get topic partition distribution
            // For performance, limit to first 100 topics if there are many
            // This balances between showing truly "top" topics and performance
            const maxTopicsToScan = 100;
            const topicsToFetch = topics.length > maxTopicsToScan ? topics.slice(0, maxTopicsToScan) : topics;
            const allTopicDetails = await Promise.all(
                topicsToFetch.map(async topicName => {
                    try {
                        const metadata = await this.clientManager.getTopicMetadata(clusterName, topicName);
                        return {
                            name: topicName,
                            partitions: metadata.partitions.length,
                            replicas: metadata.partitions[0]?.replicas?.length || 0
                        };
                    } catch (_error) {
                        return { name: topicName, partitions: 0, replicas: 0 };
                    }
                })
            );

            // Sort by partition count (descending) and take top 10
            const topicDetails = allTopicDetails
                .sort((a, b) => b.partitions - a.partitions)
                .slice(0, 10);

            const isLimitedScan = topics.length > maxTopicsToScan;

            // Consumer group states
            const consumerGroupStates = consumerGroups.reduce((acc: any, group: any) => {
                const state = group.state || 'Unknown';
                acc[state] = (acc[state] || 0) + 1;
                return acc;
            }, {});

            return {
                clusterName,
                timestamp: new Date().toISOString(),
                brokers: brokerStats,
                brokerCount: brokers.length,
                topicCount: topics.length,
                topicSample: topicDetails,
                isLimitedTopicScan: isLimitedScan,
                topicsScanned: topicsToFetch.length,
                consumerGroupCount: consumerGroups.length,
                consumerGroupStates,
                clusterStats
            };
        } catch (error: any) {
            throw new Error(`Failed to fetch cluster statistics: ${error.message}`);
        }
    }

    private getLoadingHtml(clusterName: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading Dashboard - ${clusterName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            overflow-y: auto;
            min-height: 100vh;
        }

        .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
            padding: 20px;
        }

        .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid var(--vscode-progressBar-background);
            border-top: 4px solid var(--vscode-button-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        h2 {
            margin-bottom: 10px;
            font-size: 20px;
        }

        p {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        .error-container {
            display: none;
            max-width: 600px;
            padding: 20px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 8px;
            text-align: center;
        }

        .error-container h2 {
            color: var(--vscode-errorForeground);
            margin-bottom: 10px;
        }

        .error-container p {
            color: var(--vscode-foreground);
            margin-bottom: 15px;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        #dashboardContent {
            display: none;
            width: 100%;
            padding: 20px;
        }

        #dashboardContent.visible {
            display: block;
        }
    </style>
</head>
<body>
    <div id="loadingContainer" class="loading-container">
        <div class="spinner"></div>
        <h2>Loading Dashboard</h2>
        <p id="loadingStep">Fetching cluster statistics for ${clusterName}...</p>
        <div style="width: 300px; margin: 20px auto 0;">
            <div style="background: var(--vscode-progressBar-background); height: 8px; border-radius: 4px; overflow: hidden;">
                <div id="progressBar" style="background: var(--vscode-button-background); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <p id="progressPercent" style="margin-top: 8px; font-size: 12px; text-align: center;">0%</p>
        </div>
    </div>

    <div id="errorContainer" class="error-container">
        <h2>⚠️ Error Loading Dashboard</h2>
        <p id="errorMessage"></p>
        <button onclick="retryLoad()">Retry</button>
    </div>

    <div id="dashboardContent"></div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'updateStats':
                    renderDashboard(message.data);
                    break;
                case 'showError':
                    showError(message.error);
                    break;
                case 'startLoading':
                    showLoading();
                    break;
                case 'updateProgress':
                    updateProgress(message.progress);
                    break;
            }
        });

        function showLoading() {
            document.getElementById('loadingContainer').style.display = 'block';
            document.getElementById('errorContainer').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'none';
        }

        function showError(errorMessage) {
            document.getElementById('loadingContainer').style.display = 'none';
            document.getElementById('errorContainer').style.display = 'block';
            document.getElementById('errorMessage').textContent = errorMessage;
            document.getElementById('dashboardContent').style.display = 'none';
        }

        function updateProgress(progress) {
            document.getElementById('loadingStep').textContent = progress.step;
            document.getElementById('progressBar').style.width = progress.percent + '%';
            document.getElementById('progressPercent').textContent = Math.round(progress.percent) + '%';
        }

        function retryLoad() {
            showLoading();
            vscode.postMessage({ command: 'refresh' });
        }

        function renderDashboard(stats) {
            document.getElementById('loadingContainer').style.display = 'none';
            document.getElementById('errorContainer').style.display = 'none';
            const contentDiv = document.getElementById('dashboardContent');
            contentDiv.style.display = 'block';
            contentDiv.className = 'visible';
            contentDiv.innerHTML = getDashboardHtml(stats);

            // Scroll to top
            window.scrollTo(0, 0);

            // Initialize charts after HTML is rendered
            setTimeout(() => initializeCharts(stats), 100);
        }

        function getDashboardHtml(stats) {
            return getDashboardTemplate(stats);
        }

        function initializeCharts(stats) {
            initCharts(stats);
        }

        function getDashboardTemplate(stats) {
            return \`
                <style>
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid var(--vscode-panel-border); }
                    .header h1 { font-size: 24px; font-weight: 600; }
                    .header-actions { display: flex; gap: 10px; }
                    button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; cursor: pointer; border-radius: 4px; font-size: 13px; }
                    button:hover { background-color: var(--vscode-button-hoverBackground); }
                    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .metric-card { background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; }
                    .metric-card h3 { font-size: 14px; color: var(--vscode-descriptionForeground); margin-bottom: 10px; text-transform: uppercase; font-weight: 500; }
                    .metric-value { font-size: 32px; font-weight: 600; margin-bottom: 5px; }
                    .metric-label { font-size: 12px; color: var(--vscode-descriptionForeground); }
                    .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .chart-card { background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; }
                    .chart-card h3 { font-size: 16px; margin-bottom: 15px; font-weight: 600; }
                    .chart-container { position: relative; height: 250px; }
                    .details-section { margin-bottom: 30px; }
                    .details-section h2 { font-size: 18px; margin-bottom: 15px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; overflow: hidden; }
                    th { background-color: var(--vscode-list-hoverBackground); padding: 12px; text-align: left; font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--vscode-panel-border); }
                    td { padding: 12px; font-size: 13px; border-bottom: 1px solid var(--vscode-panel-border); }
                    tr:last-child td { border-bottom: none; }
                    tr:hover { background-color: var(--vscode-list-hoverBackground); }
                    .timestamp { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 20px; text-align: center; }
                </style>

                <div class="header">
                    <div>
                        <h1>🎛️ Cluster Dashboard</h1>
                        <p style="margin-top: 5px; color: var(--vscode-descriptionForeground);">\${stats.clusterName}</p>
                    </div>
                    <div class="header-actions">
                        <button onclick="refreshDashboard()">🔄 Refresh</button>
                    </div>
                </div>

                <div class="metrics-grid">
                    <div class="metric-card"><h3>Brokers</h3><div class="metric-value">\${stats.brokerCount}</div><div class="metric-label">Active brokers in cluster</div></div>
                    <div class="metric-card"><h3>Topics</h3><div class="metric-value">\${stats.topicCount}</div><div class="metric-label">Total topics</div></div>
                    <div class="metric-card"><h3>Consumer Groups</h3><div class="metric-value">\${stats.consumerGroupCount}</div><div class="metric-label">Active consumer groups</div></div>
                    <div class="metric-card"><h3>Total Partitions</h3><div class="metric-value">\${stats.clusterStats.totalPartitions}</div><div class="metric-label">Across all topics</div></div>
                </div>

                <div class="charts-grid">
                    <div class="chart-card"><h3>Consumer Group States</h3><div class="chart-container"><canvas id="consumerGroupChart"></canvas></div></div>
                    <div class="chart-card"><h3>Partition Distribution Across Brokers</h3><div class="chart-container"><canvas id="brokerChart"></canvas></div></div>
                    <div class="chart-card"><h3>Replication Factor Distribution</h3><div class="chart-container"><canvas id="replicationChart"></canvas></div></div>
                </div>

                <div class="details-section">
                    <h2>📊 Broker Details</h2>
                    <table>
                        <thead><tr><th>Broker ID</th><th>Host</th><th>Port</th><th>Rack</th><th>Partition Leaders</th></tr></thead>
                        <tbody>\${stats.brokers.map(b => \`<tr><td><strong>\${b.id}</strong></td><td>\${b.host}</td><td>\${b.port}</td><td>\${b.rack}</td><td><strong>\${b.partitionCount}</strong> partitions</td></tr>\`).join('')}</tbody>
                    </table>
                </div>

                <div class="details-section">
                    <h2>📋 Top Topics by Partition Count</h2>
                    \${stats.isLimitedTopicScan ? \`<p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 10px;">ℹ️ Showing top 10 from \${stats.topicsScanned} topics scanned (\${stats.topicCount} total)</p>\` : ''}
                    <table>
                        <thead><tr><th>Topic Name</th><th>Partitions</th><th>Replication Factor</th></tr></thead>
                        <tbody>\${stats.topicSample.map(t => \`<tr><td><strong>\${t.name}</strong></td><td>\${t.partitions}</td><td>\${t.replicas}</td></tr>\`).join('')}</tbody>
                    </table>
                </div>

                <div class="timestamp">Last updated: \${new Date(stats.timestamp).toLocaleString()}</div>
            \`;
        }

        function initCharts(stats) {
            Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--vscode-foreground');
            Chart.defaults.borderColor = getComputedStyle(document.body).getPropertyValue('--vscode-panel-border');

            new Chart(document.getElementById('consumerGroupChart'), {
                type: 'doughnut',
                data: { labels: Object.keys(stats.consumerGroupStates), datasets: [{ data: Object.values(stats.consumerGroupStates), backgroundColor: ['rgba(75, 192, 192, 0.8)', 'rgba(255, 159, 64, 0.8)', 'rgba(255, 99, 132, 0.8)', 'rgba(153, 102, 255, 0.8)'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });

            new Chart(document.getElementById('brokerChart'), {
                type: 'bar',
                data: { labels: stats.brokers.map(b => 'Broker ' + b.id), datasets: [{ label: 'Partition Leaders', data: stats.brokers.map(b => b.partitionCount), backgroundColor: 'rgba(54, 162, 235, 0.8)', borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => 'Partitions: ' + ctx.parsed.y } } } }
            });

            const replicationFactors = stats.topicSample.reduce((acc, t) => { acc[t.replicas] = (acc[t.replicas] || 0) + 1; return acc; }, {});
            new Chart(document.getElementById('replicationChart'), {
                type: 'pie',
                data: { labels: Object.keys(replicationFactors).map(rf => 'RF ' + rf), datasets: [{ data: Object.values(replicationFactors), backgroundColor: ['rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)', 'rgba(75, 192, 192, 0.8)'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }

        function refreshDashboard() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
    }

    private getHtmlContent(clusterName: string, stats: any): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cluster Dashboard - ${clusterName}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h1 {
            font-size: 24px;
            font-weight: 600;
        }

        .header-actions {
            display: flex;
            gap: 10px;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .metric-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
        }

        .metric-card h3 {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
            text-transform: uppercase;
            font-weight: 500;
        }

        .metric-value {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 5px;
        }

        .metric-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .chart-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
        }

        .chart-card h3 {
            font-size: 16px;
            margin-bottom: 15px;
            font-weight: 600;
        }

        .chart-container {
            position: relative;
            height: 250px;
        }

        .details-section {
            margin-bottom: 30px;
        }

        .details-section h2 {
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
        }

        th {
            background-color: var(--vscode-list-hoverBackground);
            padding: 12px;
            text-align: left;
            font-size: 13px;
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        td {
            padding: 12px;
            font-size: 13px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .timestamp {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 20px;
            text-align: center;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
        }

        .status-stable {
            background-color: rgba(0, 255, 0, 0.2);
            color: #00ff00;
        }

        .status-empty {
            background-color: rgba(255, 165, 0, 0.2);
            color: #ffa500;
        }

        .status-dead {
            background-color: rgba(255, 0, 0, 0.2);
            color: #ff0000;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>🎛️ Cluster Dashboard</h1>
            <p style="margin-top: 5px; color: var(--vscode-descriptionForeground);">${clusterName}</p>
        </div>
        <div class="header-actions">
            <button onclick="refreshDashboard()">🔄 Refresh</button>
        </div>
    </div>

    <div class="metrics-grid">
        <div class="metric-card">
            <h3>Brokers</h3>
            <div class="metric-value">${stats.brokerCount}</div>
            <div class="metric-label">Active brokers in cluster</div>
        </div>
        <div class="metric-card">
            <h3>Topics</h3>
            <div class="metric-value">${stats.topicCount}</div>
            <div class="metric-label">Total topics</div>
        </div>
        <div class="metric-card">
            <h3>Consumer Groups</h3>
            <div class="metric-value">${stats.consumerGroupCount}</div>
            <div class="metric-label">Active consumer groups</div>
        </div>
        <div class="metric-card">
            <h3>Total Partitions</h3>
            <div class="metric-value">${stats.clusterStats.totalPartitions}</div>
            <div class="metric-label">Across all topics</div>
        </div>
    </div>

    <div class="charts-grid">
        <div class="chart-card">
            <h3>Consumer Group States</h3>
            <div class="chart-container">
                <canvas id="consumerGroupChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <h3>Partition Distribution Across Brokers</h3>
            <div class="chart-container">
                <canvas id="brokerChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <h3>Replication Factor Distribution</h3>
            <div class="chart-container">
                <canvas id="replicationChart"></canvas>
            </div>
        </div>
    </div>

    <div class="details-section">
        <h2>📊 Broker Details</h2>
        <table>
            <thead>
                <tr>
                    <th>Broker ID</th>
                    <th>Host</th>
                    <th>Port</th>
                    <th>Rack</th>
                    <th>Partition Leaders</th>
                </tr>
            </thead>
            <tbody>
                ${stats.brokers.map((broker: any) => `
                    <tr>
                        <td><strong>${broker.id}</strong></td>
                        <td>${broker.host}</td>
                        <td>${broker.port}</td>
                        <td>${broker.rack}</td>
                        <td><strong>${broker.partitionCount}</strong> partitions</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="details-section">
        <h2>📋 Top Topics by Partition Count</h2>
        ${stats.isLimitedTopicScan ? `
            <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 10px;">
                ℹ️ Showing top 10 from ${stats.topicsScanned} topics scanned (${stats.topicCount} total)
            </p>
        ` : ''}
        <table>
            <thead>
                <tr>
                    <th>Topic Name</th>
                    <th>Partitions</th>
                    <th>Replication Factor</th>
                </tr>
            </thead>
            <tbody>
                ${stats.topicSample.map((topic: any) => `
                    <tr>
                        <td><strong>${topic.name}</strong></td>
                        <td>${topic.partitions}</td>
                        <td>${topic.replicas}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="timestamp">
        Last updated: ${new Date(stats.timestamp).toLocaleString()}
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Chart.js configuration
        Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--vscode-foreground');
        Chart.defaults.borderColor = getComputedStyle(document.body).getPropertyValue('--vscode-panel-border');

        // Consumer Group States Chart
        const consumerGroupStates = ${JSON.stringify(stats.consumerGroupStates)};
        new Chart(document.getElementById('consumerGroupChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(consumerGroupStates),
                datasets: [{
                    data: Object.values(consumerGroupStates),
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(255, 159, 64, 0.8)',
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // Broker Partition Distribution Chart
        const brokers = ${JSON.stringify(stats.brokers)};
        new Chart(document.getElementById('brokerChart'), {
            type: 'bar',
            data: {
                labels: brokers.map(b => 'Broker ' + b.id),
                datasets: [{
                    label: 'Partition Leaders',
                    data: brokers.map(b => b.partitionCount),
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Partitions: ' + context.parsed.y;
                            }
                        }
                    }
                }
            }
        });

        // Replication Factor Distribution
        const topics = ${JSON.stringify(stats.topicSample)};
        const replicationFactors = topics.reduce((acc, t) => {
            acc[t.replicas] = (acc[t.replicas] || 0) + 1;
            return acc;
        }, {});
        new Chart(document.getElementById('replicationChart'), {
            type: 'pie',
            data: {
                labels: Object.keys(replicationFactors).map(rf => 'RF ' + rf),
                datasets: [{
                    data: Object.values(replicationFactors),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        function refreshDashboard() {
            vscode.postMessage({ command: 'refresh' });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateStats') {
                location.reload();
            }
        });
    </script>
</body>
</html>`;
    }
}
