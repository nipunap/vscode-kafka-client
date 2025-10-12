import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { Logger } from '../infrastructure/Logger';

interface ConsumedMessage {
    topic: string;
    partition: number;
    offset: string;
    key: string | null;
    value: string;
    timestamp: string;
    headers?: Record<string, string>;
}

interface ConsumerState {
    isRunning: boolean;
    isPaused: boolean;
    messageCount: number;
    startTime: number | null;
    lastMessageTime: number | null;
}

export class MessageConsumerWebview {
    private static instance: MessageConsumerWebview | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private readonly clientManager: KafkaClientManager;
    private readonly logger: Logger;
    private messages: ConsumedMessage[] = [];
    private consumerState: ConsumerState = {
        isRunning: false,
        isPaused: false,
        messageCount: 0,
        startTime: null,
        lastMessageTime: null
    };
    private readonly MAX_MESSAGES = 1000; // Prevent memory issues
    private consumerHandle: any = null;
    private clusterName: string = '';
    private topicName: string = '';

    private constructor(
        clientManager: KafkaClientManager,
        logger: Logger
    ) {
        this.clientManager = clientManager;
        this.logger = logger;
    }

    public static getInstance(
        clientManager: KafkaClientManager,
        logger: Logger
    ): MessageConsumerWebview {
        if (!MessageConsumerWebview.instance) {
            MessageConsumerWebview.instance = new MessageConsumerWebview(
                clientManager,
                logger
            );
        }
        return MessageConsumerWebview.instance;
    }

    public async show(clusterName: string, topicName: string, fromBeginning: boolean = false) {
        this.clusterName = clusterName;
        this.topicName = topicName;

        // Stop any existing consumer
        if (this.consumerHandle) {
            await this.stopConsumer();
        }

        // Reset state
        this.messages = [];
        this.consumerState = {
            isRunning: false,
            isPaused: false,
            messageCount: 0,
            startTime: null,
            lastMessageTime: null
        };

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'kafkaMessageConsumer',
                `📨 Messages: ${topicName}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
                }
            );

            this.panel.onDidDispose(() => {
                this.stopConsumer();
                this.panel = undefined;
            });

            this.panel.webview.onDidReceiveMessage(async (message) => {
                await this.handleMessage(message);
            });
        }

        this.panel.webview.html = this.getHtmlContent();

        // Auto-start consumer
        await this.startConsumer(fromBeginning);
    }

    private async handleMessage(message: any) {
        switch (message.command) {
            case 'start':
                await this.startConsumer(message.fromBeginning);
                break;
            case 'stop':
                await this.stopConsumer();
                break;
            case 'pause':
                await this.pauseConsumer();
                break;
            case 'resume':
                await this.resumeConsumer();
                break;
            case 'clear':
                this.clearMessages();
                break;
            case 'export':
                await this.exportMessages();
                break;
        }
    }

    private async startConsumer(fromBeginning: boolean = false) {
        if (this.consumerState.isRunning) {
            this.logger.info('Consumer already running');
            return;
        }

        try {
            this.logger.info(`Starting consumer for ${this.clusterName}/${this.topicName} (fromBeginning: ${fromBeginning})`);

            this.consumerState.isRunning = true;
            this.consumerState.isPaused = false;
            this.consumerState.startTime = Date.now();
            this.updateStatus();

            // Start consuming messages
            const consumer = await this.clientManager.getConsumer(this.clusterName);

            await consumer.subscribe({
                topics: [this.topicName],
                fromBeginning
            });

            this.consumerHandle = consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    if (this.consumerState.isPaused) {
                        return;
                    }

                    const consumedMessage: ConsumedMessage = {
                        topic,
                        partition,
                        offset: message.offset,
                        key: message.key ? message.key.toString() : null,
                        value: message.value ? message.value.toString() : '',
                        timestamp: message.timestamp,
                        headers: message.headers ? this.parseHeaders(message.headers) : undefined
                    };

                    this.addMessage(consumedMessage);
                }
            });

            this.logger.info('Consumer started successfully');
        } catch (error: any) {
            this.logger.error('Failed to start consumer', error);
            this.consumerState.isRunning = false;
            this.updateStatus();
            vscode.window.showErrorMessage(`Failed to start consumer: ${error.message}`);
        }
    }

    private async stopConsumer() {
        if (!this.consumerState.isRunning) {
            return;
        }

        try {
            this.logger.info('Stopping consumer');

            if (this.consumerHandle) {
                const consumer = await this.clientManager.getConsumer(this.clusterName);
                await consumer.disconnect();
                this.consumerHandle = null;
            }

            this.consumerState.isRunning = false;
            this.consumerState.isPaused = false;
            this.updateStatus();

            this.logger.info('Consumer stopped successfully');
        } catch (error: any) {
            this.logger.error('Error stopping consumer', error);
        }
    }

    private async pauseConsumer() {
        if (!this.consumerState.isRunning || this.consumerState.isPaused) {
            return;
        }

        try {
            const consumer = await this.clientManager.getConsumer(this.clusterName);
            await consumer.pause([{ topic: this.topicName }]);

            this.consumerState.isPaused = true;
            this.updateStatus();
            this.logger.info('Consumer paused');
        } catch (error: any) {
            this.logger.error('Error pausing consumer', error);
        }
    }

    private async resumeConsumer() {
        if (!this.consumerState.isRunning || !this.consumerState.isPaused) {
            return;
        }

        try {
            const consumer = await this.clientManager.getConsumer(this.clusterName);
            await consumer.resume([{ topic: this.topicName }]);

            this.consumerState.isPaused = false;
            this.updateStatus();
            this.logger.info('Consumer resumed');
        } catch (error: any) {
            this.logger.error('Error resuming consumer', error);
        }
    }

    private addMessage(message: ConsumedMessage) {
        // Add to beginning (newest first)
        this.messages.unshift(message);

        // Limit message buffer
        if (this.messages.length > this.MAX_MESSAGES) {
            this.messages = this.messages.slice(0, this.MAX_MESSAGES);
        }

        this.consumerState.messageCount++;
        this.consumerState.lastMessageTime = Date.now();

        // Update webview
        this.sendMessageUpdate(message);
        this.updateStatus();
    }

    private clearMessages() {
        this.messages = [];
        this.consumerState.messageCount = 0;
        this.panel?.webview.postMessage({ command: 'clear' });
        this.updateStatus();
    }

    private sendMessageUpdate(message: ConsumedMessage) {
        this.panel?.webview.postMessage({
            command: 'newMessage',
            message: message
        });
    }

    private updateStatus() {
        this.panel?.webview.postMessage({
            command: 'updateStatus',
            state: this.consumerState
        });
    }

    private parseHeaders(headers: any): Record<string, string> {
        const parsed: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
            if (Buffer.isBuffer(value)) {
                parsed[key] = value.toString();
            } else {
                parsed[key] = String(value);
            }
        }
        return parsed;
    }

    private async exportMessages() {
        if (this.messages.length === 0) {
            vscode.window.showInformationMessage('No messages to export');
            return;
        }

        try {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${this.topicName}-messages.json`),
                filters: {
                    'JSON': ['json'],
                    'All Files': ['*']
                }
            });

            if (uri) {
                const content = JSON.stringify(this.messages, null, 2);
                await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
                vscode.window.showInformationMessage(`Exported ${this.messages.length} messages to ${uri.fsPath}`);
            }
        } catch (error: any) {
            this.logger.error('Error exporting messages', error);
            vscode.window.showErrorMessage(`Failed to export messages: ${error.message}`);
        }
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kafka Message Consumer</title>
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
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .title {
            font-size: 24px;
            font-weight: 600;
        }

        .controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            border-radius: 3px;
            font-size: 13px;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-success {
            background-color: #28a745;
            color: white;
        }

        .btn-danger {
            background-color: #dc3545;
            color: white;
        }

        .btn-warning {
            background-color: #ffc107;
            color: black;
        }

        .status-bar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
        }

        .status-item {
            display: flex;
            flex-direction: column;
        }

        .status-label {
            font-size: 12px;
            opacity: 0.7;
            margin-bottom: 4px;
        }

        .status-value {
            font-size: 18px;
            font-weight: 600;
        }

        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .status-running {
            background-color: #28a745;
        }

        .status-paused {
            background-color: #ffc107;
        }

        .status-stopped {
            background-color: #dc3545;
        }

        .messages-container {
            margin-top: 20px;
            max-height: calc(100vh - 300px);
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }

        .message-row {
            display: grid;
            grid-template-columns: 80px 120px 150px 200px 1fr;
            gap: 10px;
            padding: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 13px;
        }

        .message-row:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .message-header {
            font-weight: 600;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .message-cell {
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .message-value {
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .timestamp-toggle {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .human-icon {
            font-size: 16px;
            cursor: pointer;
            opacity: 0.6;
            transition: all 0.2s;
            user-select: none;
        }

        .human-icon:hover {
            opacity: 1;
            transform: scale(1.15);
        }

        .format-toggle[data-format="human"] .human-icon {
            opacity: 1;
            filter: brightness(1.2);
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

        .empty-state-text {
            font-size: 16px;
        }

        code {
            font-family: 'Courier New', monospace;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">📨 Message Consumer: ${this.topicName}</div>
    </div>

    <div class="controls">
        <button class="btn btn-success" id="startBtn" onclick="startConsumer(false)">▶️ Start (Latest)</button>
        <button class="btn btn-success" id="startBeginningBtn" onclick="startConsumer(true)">⏮️ Start (From Beginning)</button>
        <button class="btn btn-warning" id="pauseBtn" onclick="pauseConsumer()" disabled>⏸️ Pause</button>
        <button class="btn btn-success" id="resumeBtn" onclick="resumeConsumer()" disabled style="display:none;">▶️ Resume</button>
        <button class="btn btn-danger" id="stopBtn" onclick="stopConsumer()" disabled>⏹️ Stop</button>
        <button class="btn" onclick="clearMessages()">🗑️ Clear</button>
        <button class="btn" onclick="exportMessages()">💾 Export</button>
    </div>

    <div class="status-bar">
        <div class="status-item">
            <div class="status-label">Status</div>
            <div class="status-value">
                <span class="status-indicator status-stopped" id="statusIndicator"></span>
                <span id="statusText">Stopped</span>
            </div>
        </div>
        <div class="status-item">
            <div class="status-label">Messages</div>
            <div class="status-value" id="messageCount">0</div>
        </div>
        <div class="status-item">
            <div class="status-label">Uptime</div>
            <div class="status-value" id="uptime">-</div>
        </div>
        <div class="status-item">
            <div class="status-label">Last Message</div>
            <div class="status-value" id="lastMessage">-</div>
        </div>
    </div>

    <div class="messages-container">
        <div class="message-row message-header">
            <div class="message-cell">Partition</div>
            <div class="message-cell">Offset</div>
            <div class="message-cell">Timestamp</div>
            <div class="message-cell">Key</div>
            <div class="message-cell">Value</div>
        </div>
        <div id="messagesBody">
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">No messages yet. Click "Start" to begin consuming.</div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let uptimeInterval = null;

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'newMessage':
                    addMessage(message.message);
                    break;
                case 'updateStatus':
                    updateStatus(message.state);
                    break;
                case 'clear':
                    clearMessagesList();
                    break;
            }
        });

        function startConsumer(fromBeginning) {
            vscode.postMessage({ command: 'start', fromBeginning });
        }

        function stopConsumer() {
            vscode.postMessage({ command: 'stop' });
        }

        function pauseConsumer() {
            vscode.postMessage({ command: 'pause' });
        }

        function resumeConsumer() {
            vscode.postMessage({ command: 'resume' });
        }

        function clearMessages() {
            vscode.postMessage({ command: 'clear' });
        }

        function exportMessages() {
            vscode.postMessage({ command: 'export' });
        }

        function addMessage(msg) {
            const messagesBody = document.getElementById('messagesBody');

            // Remove empty state if present
            const emptyState = messagesBody.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }

            const row = document.createElement('div');
            row.className = 'message-row';

            const timestamp = msg.timestamp;
            const humanTimestamp = formatTimestamp(timestamp);

            row.innerHTML = \`
                <div class="message-cell">\${msg.partition}</div>
                <div class="message-cell"><code>\${msg.offset}</code></div>
                <div class="message-cell">
                    <span class="format-toggle" data-raw="\${escapeHtml(timestamp)}" data-human="\${escapeHtml(humanTimestamp)}" data-format="raw">
                        \${escapeHtml(timestamp)}
                        <span class="human-icon" onclick="toggleTimestamp(this.parentElement)" title="Click to show human-readable time">👤</span>
                    </span>
                </div>
                <div class="message-cell"><code>\${escapeHtml(msg.key || '-')}</code></div>
                <div class="message-cell message-value">\${escapeHtml(msg.value).substring(0, 200)}\${msg.value.length > 200 ? '...' : ''}</div>
            \`;

            messagesBody.insertBefore(row, messagesBody.firstChild);
        }

        function toggleTimestamp(element) {
            const currentFormat = element.getAttribute('data-format');
            const rawValue = element.getAttribute('data-raw');
            const humanValue = element.getAttribute('data-human');

            if (currentFormat === 'raw') {
                element.setAttribute('data-format', 'human');
                element.childNodes[0].textContent = humanValue;
                element.querySelector('.human-icon').title = 'Click to show raw timestamp';
            } else {
                element.setAttribute('data-format', 'raw');
                element.childNodes[0].textContent = rawValue;
                element.querySelector('.human-icon').title = 'Click to show human-readable time';
            }
        }

        function formatTimestamp(timestamp) {
            const date = new Date(parseInt(timestamp));
            return date.toLocaleString();
        }

        function updateStatus(state) {
            const statusIndicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');
            const messageCount = document.getElementById('messageCount');
            const startBtn = document.getElementById('startBtn');
            const startBeginningBtn = document.getElementById('startBeginningBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            const resumeBtn = document.getElementById('resumeBtn');
            const stopBtn = document.getElementById('stopBtn');

            messageCount.textContent = state.messageCount.toLocaleString();

            if (state.isRunning) {
                if (state.isPaused) {
                    statusIndicator.className = 'status-indicator status-paused';
                    statusText.textContent = 'Paused';
                    startBtn.disabled = true;
                    startBeginningBtn.disabled = true;
                    pauseBtn.disabled = true;
                    pauseBtn.style.display = 'none';
                    resumeBtn.disabled = false;
                    resumeBtn.style.display = 'inline-block';
                    stopBtn.disabled = false;
                } else {
                    statusIndicator.className = 'status-indicator status-running';
                    statusText.textContent = 'Running';
                    startBtn.disabled = true;
                    startBeginningBtn.disabled = true;
                    pauseBtn.disabled = false;
                    pauseBtn.style.display = 'inline-block';
                    resumeBtn.disabled = true;
                    resumeBtn.style.display = 'none';
                    stopBtn.disabled = false;

                    // Start uptime counter
                    if (!uptimeInterval && state.startTime) {
                        startUptimeCounter(state.startTime);
                    }
                }
            } else {
                statusIndicator.className = 'status-indicator status-stopped';
                statusText.textContent = 'Stopped';
                startBtn.disabled = false;
                startBeginningBtn.disabled = false;
                pauseBtn.disabled = true;
                pauseBtn.style.display = 'inline-block';
                resumeBtn.disabled = true;
                resumeBtn.style.display = 'none';
                stopBtn.disabled = true;

                // Stop uptime counter
                if (uptimeInterval) {
                    clearInterval(uptimeInterval);
                    uptimeInterval = null;
                }
                document.getElementById('uptime').textContent = '-';
            }

            if (state.lastMessageTime) {
                const elapsed = Date.now() - state.lastMessageTime;
                document.getElementById('lastMessage').textContent = elapsed < 1000 ? 'Just now' : \`\${Math.floor(elapsed / 1000)}s ago\`;
            } else {
                document.getElementById('lastMessage').textContent = '-';
            }
        }

        function startUptimeCounter(startTime) {
            uptimeInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const seconds = Math.floor(elapsed / 1000);
                const minutes = Math.floor(seconds / 60);
                const hours = Math.floor(minutes / 60);

                if (hours > 0) {
                    document.getElementById('uptime').textContent = \`\${hours}h \${minutes % 60}m\`;
                } else if (minutes > 0) {
                    document.getElementById('uptime').textContent = \`\${minutes}m \${seconds % 60}s\`;
                } else {
                    document.getElementById('uptime').textContent = \`\${seconds}s\`;
                }
            }, 1000);
        }

        function clearMessagesList() {
            const messagesBody = document.getElementById('messagesBody');
            messagesBody.innerHTML = \`
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-text">No messages. Cleared.</div>
                </div>
            \`;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }
}
