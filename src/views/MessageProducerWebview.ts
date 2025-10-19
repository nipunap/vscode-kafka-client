import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { Logger } from '../infrastructure/Logger';

interface ProducerMessage {
    key?: string;
    value: string;
    headers?: Record<string, string>;
    partition?: number;
    timestamp?: string;
    compression?: 'gzip' | 'none';
}

interface ProducerState {
    messageCount: number;
    lastMessageTime: number | null;
    errorCount: number;
}

export class MessageProducerWebview {
    private static instance: MessageProducerWebview | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private readonly clientManager: KafkaClientManager;
    private readonly logger: Logger;
    private producerState: ProducerState = {
        messageCount: 0,
        lastMessageTime: null,
        errorCount: 0
    };
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
    ): MessageProducerWebview {
        if (!MessageProducerWebview.instance) {
            MessageProducerWebview.instance = new MessageProducerWebview(
                clientManager,
                logger
            );
        }
        return MessageProducerWebview.instance;
    }

    public async show(clusterName: string, topicName: string) {
        this.clusterName = clusterName;
        this.topicName = topicName;

        // Reset state
        this.producerState = {
            messageCount: 0,
            lastMessageTime: null,
            errorCount: 0
        };

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'kafkaMessageProducer',
                `📤 Producer: ${topicName}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });

            this.panel.webview.onDidReceiveMessage(async (message) => {
                await this.handleMessage(message);
            });
        }

        this.panel.webview.html = this.getHtmlContent();
        this.updateStatus();
    }

    private async handleMessage(message: any) {
        switch (message.command) {
            case 'produce':
                await this.produceMessage(message.data);
                break;
            case 'produceBatch':
                await this.produceBatch(message.data);
                break;
            case 'loadTemplate':
                this.loadTemplate(message.template);
                break;
        }
    }

    private async produceMessage(data: ProducerMessage) {
        try {
            this.logger.info(`Producing message to ${this.clusterName}/${this.topicName}`);

            // SEC-3.1-4: Validate message against schema if available
            await this.validateMessageSchema(data.value);

            const messages = [{
                key: data.key || undefined,
                value: data.value,
                headers: data.headers || undefined,
                partition: data.partition !== undefined && data.partition >= 0 ? data.partition : undefined
            }];

            await this.clientManager.produceAdvancedMessages(this.clusterName, this.topicName, messages, data.compression);

            this.producerState.messageCount++;
            this.producerState.lastMessageTime = Date.now();
            this.updateStatus();

            this.panel?.webview.postMessage({
                command: 'produceSuccess',
                message: 'Message sent successfully!'
            });

            this.logger.info('Message produced successfully');
        } catch (error: any) {
            this.logger.error('Failed to produce message', error);
            this.producerState.errorCount++;
            this.updateStatus();

            this.panel?.webview.postMessage({
                command: 'produceError',
                error: error.message
            });
        }
    }

    private async produceBatch(data: { messages: ProducerMessage[] }) {
        try {
            this.logger.info(`Producing batch of ${data.messages.length} messages to ${this.clusterName}/${this.topicName}`);

            const messages = data.messages.map(msg => ({
                key: msg.key || undefined,
                value: msg.value,
                headers: msg.headers || undefined,
                partition: msg.partition !== undefined && msg.partition >= 0 ? msg.partition : undefined
            }));

            // Use compression from first message if specified
            const compression = data.messages[0]?.compression;
            await this.clientManager.produceAdvancedMessages(this.clusterName, this.topicName, messages, compression);

            this.producerState.messageCount += data.messages.length;
            this.producerState.lastMessageTime = Date.now();
            this.updateStatus();

            this.panel?.webview.postMessage({
                command: 'produceSuccess',
                message: `Batch of ${data.messages.length} messages sent successfully!`
            });

            this.logger.info(`Batch of ${data.messages.length} messages produced successfully`);
        } catch (error: any) {
            this.logger.error('Failed to produce batch', error);
            this.producerState.errorCount++;
            this.updateStatus();

            this.panel?.webview.postMessage({
                command: 'produceError',
                error: error.message
            });
        }
    }

    /**
     * Validate message against schema if Schema Registry is configured
     * SEC-3.1-4: Schema validation before producing
     */
    private async validateMessageSchema(messageValue: string): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('kafka');
            const schemaRegistryUrl = config.get<string>('schemaRegistry.url');
            
            if (!schemaRegistryUrl) {
                // No schema registry configured, skip validation
                return;
            }

            // Import dynamically to avoid circular dependencies
            const { SchemaRegistryService } = await import('../services/SchemaRegistryService');
            const { CredentialManager } = await import('../infrastructure/CredentialManager');
            
            // Get extension context from global state (set during activation)
            const context = (global as any).extensionContext;
            if (!context) {
                this.logger.warn('Extension context not available, skipping schema validation');
                return;
            }

            const credentialManager = new CredentialManager(context.secrets);
            const schemaService = new SchemaRegistryService(
                { url: schemaRegistryUrl },
                credentialManager,
                this.clusterName
            );

            // Check if schema registry is available
            const isAvailable = await schemaService.isAvailable();
            if (!isAvailable) {
                this.logger.warn('Schema Registry not available, skipping validation');
                return;
            }

            // Try to validate against value subject
            const valueSubject = `${this.topicName}-value`;
            try {
                // Parse message value to validate it's valid JSON
                const payload = JSON.parse(messageValue);
                
                // Validate against schema
                const isValid = await schemaService.validateMessage(valueSubject, payload);
                
                if (!isValid) {
                    throw new Error(`Message does not conform to schema for subject: ${valueSubject}`);
                }
                
                this.logger.info(`Message validated successfully against schema: ${valueSubject}`);
            } catch (validationError: any) {
                // If validation fails, throw error to prevent producing
                if (validationError.message.includes('does not conform')) {
                    throw validationError;
                }
                // If schema doesn't exist, allow producing (optional schema)
                this.logger.debug(`Schema validation skipped: ${validationError.message}`);
            }
        } catch (error: any) {
            // If it's a validation error, re-throw to prevent producing
            if (error.message.includes('does not conform')) {
                throw error;
            }
            // For other errors (config issues, etc.), log and continue
            this.logger.warn(`Schema validation error: ${error.message}`);
        }
    }

    private loadTemplate(templateName: string) {
        const templates: Record<string, ProducerMessage> = {
            'simple': {
                value: JSON.stringify({
                    message: "Hello, Kafka!",
                    timestamp: new Date().toISOString()
                }, null, 2)
            },
            'user-event': {
                key: "user-123",
                value: JSON.stringify({
                    userId: "user-123",
                    event: "login",
                    timestamp: new Date().toISOString(),
                    metadata: {
                        ip: "192.168.1.1",
                        userAgent: "Mozilla/5.0"
                    }
                }, null, 2),
                headers: {
                    'event-type': 'user-login',
                    'source': 'web-app'
                }
            },
            'order': {
                key: "order-456",
                value: JSON.stringify({
                    orderId: "order-456",
                    customerId: "customer-789",
                    items: [
                        { productId: "prod-1", quantity: 2, price: 29.99 },
                        { productId: "prod-2", quantity: 1, price: 49.99 }
                    ],
                    total: 109.97,
                    timestamp: new Date().toISOString()
                }, null, 2),
                headers: {
                    'order-type': 'online',
                    'payment-method': 'credit-card'
                }
            },
            'iot-telemetry': {
                key: "device-001",
                value: JSON.stringify({
                    deviceId: "device-001",
                    temperature: 23.5,
                    humidity: 60,
                    batteryLevel: 85,
                    location: {
                        lat: 37.7749,
                        lon: -122.4194
                    },
                    timestamp: new Date().toISOString()
                }, null, 2),
                headers: {
                    'device-type': 'temperature-sensor',
                    'location': 'building-a'
                }
            },
            'avro-user': {
                key: "user-001",
                value: JSON.stringify({
                    id: 1,
                    name: "John Doe",
                    email: "john@example.com",
                    age: 30,
                    created_at: new Date().toISOString()
                }, null, 2),
                headers: {
                    'content-type': 'application/avro',
                    'schema-version': '1'
                }
            }
        };

        const template = templates[templateName];
        if (template) {
            this.panel?.webview.postMessage({
                command: 'loadTemplate',
                template
            });
        }
    }

    private updateStatus() {
        this.panel?.webview.postMessage({
            command: 'updateStatus',
            state: this.producerState
        });
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kafka Message Producer</title>
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

        .status-bar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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

        .form-section {
            margin-bottom: 25px;
        }

        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-size: 13px;
            font-weight: 500;
        }

        input[type="text"],
        input[type="number"],
        textarea {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }

        textarea {
            font-family: 'Courier New', monospace;
            resize: vertical;
            min-height: 150px;
        }

        .btn {
            padding: 8px 16px;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            border-radius: 3px;
            font-size: 13px;
            transition: background-color 0.2s;
            margin-right: 10px;
        }

        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .btn-primary {
            background-color: #007acc;
            color: white;
        }

        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }

        .btn-group {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .alert {
            padding: 12px;
            margin: 15px 0;
            border-radius: 5px;
            display: none;
        }

        .alert-success {
            background-color: rgba(40, 167, 69, 0.2);
            border: 1px solid #28a745;
            color: #28a745;
        }

        .alert-error {
            background-color: rgba(220, 53, 69, 0.2);
            border: 1px solid #dc3545;
            color: #dc3545;
        }

        .header-row {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 10px;
            align-items: end;
            margin-bottom: 10px;
        }

        .header-add-btn {
            padding: 8px 16px;
        }

        #headersContainer {
            margin-bottom: 15px;
        }

        .help-text {
            font-size: 12px;
            opacity: 0.7;
            margin-top: 4px;
        }

        .templates {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .template-btn {
            padding: 6px 12px;
            font-size: 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .template-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        code {
            font-family: 'Courier New', monospace;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
        }

        .divider {
            height: 1px;
            background-color: var(--vscode-panel-border);
            margin: 25px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">📤 Message Producer: ${this.topicName}</div>
    </div>

    <div class="status-bar">
        <div class="status-item">
            <div class="status-label">Messages Sent</div>
            <div class="status-value" id="messageCount">0</div>
        </div>
        <div class="status-item">
            <div class="status-label">Errors</div>
            <div class="status-value" id="errorCount">0</div>
        </div>
        <div class="status-item">
            <div class="status-label">Last Sent</div>
            <div class="status-value" id="lastMessage">-</div>
        </div>
    </div>

    <div id="alertContainer"></div>

    <div class="form-section">
        <div class="section-title">📝 Message Templates</div>
        <div class="templates">
            <button class="btn template-btn" onclick="loadTemplate('simple')">Simple Message</button>
            <button class="btn template-btn" onclick="loadTemplate('user-event')">User Event</button>
            <button class="btn template-btn" onclick="loadTemplate('order')">Order</button>
            <button class="btn template-btn" onclick="loadTemplate('iot-telemetry')">IoT Telemetry</button>
            <button class="btn template-btn" onclick="loadTemplate('avro-user')">Avro User</button>
        </div>
    </div>

    <div class="divider"></div>

    <div class="form-section">
        <div class="section-title">🔑 Message Key (Optional)</div>
        <div class="form-group">
            <input type="text" id="messageKey" placeholder="e.g., user-123, order-456">
            <div class="help-text">Messages with the same key go to the same partition</div>
        </div>
    </div>

    <div class="form-section">
        <div class="section-title">📄 Message Value *</div>
        <div class="form-group">
            <textarea id="messageValue" placeholder='{"message": "Hello, Kafka!"}'></textarea>
            <div class="help-text">Enter your message payload (JSON, text, or any format)</div>
        </div>
    </div>

    <div class="form-section">
        <div class="section-title">🏷️ Headers (Optional)</div>
        <div id="headersContainer"></div>
        <button class="btn btn-secondary" onclick="addHeaderRow()">+ Add Header</button>
        <div class="help-text">Optional key-value metadata for the message</div>
    </div>

    <div class="form-section">
        <div class="section-title">📍 Partition (Optional)</div>
        <div class="form-group">
            <input type="number" id="partition" placeholder="Leave empty for automatic" min="0">
            <div class="help-text">Specify partition number, or leave empty for automatic assignment</div>
        </div>
    </div>

    <div class="form-section">
        <div class="section-title">🗜️ Compression (Optional)</div>
        <div class="form-group">
            <select id="compression">
                <option value="none">No Compression</option>
                <option value="gzip">GZIP</option>
            </select>
            <div class="help-text">Compress messages before sending (GZIP reduces bandwidth)</div>
        </div>
    </div>

    <div class="btn-group">
        <button class="btn btn-primary" onclick="produceMessage()">📤 Send Message</button>
        <button class="btn" onclick="clearForm()">🗑️ Clear</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateStatus':
                    updateStatus(message.state);
                    break;
                case 'produceSuccess':
                    showAlert('success', message.message);
                    break;
                case 'produceError':
                    showAlert('error', 'Error: ' + message.error);
                    break;
                case 'loadTemplate':
                    loadTemplateData(message.template);
                    break;
            }
        });

        function produceMessage() {
            const key = document.getElementById('messageKey').value.trim();
            const value = document.getElementById('messageValue').value.trim();
            const partition = document.getElementById('partition').value;
            const compression = document.getElementById('compression').value;

            if (!value) {
                showAlert('error', 'Message value is required');
                return;
            }

            // Collect headers
            const headers = {};
            const headerRows = document.querySelectorAll('.header-row');
            headerRows.forEach(row => {
                const keyInput = row.querySelector('.header-key');
                const valueInput = row.querySelector('.header-value');
                if (keyInput && valueInput && keyInput.value.trim() && valueInput.value.trim()) {
                    headers[keyInput.value.trim()] = valueInput.value.trim();
                }
            });

            const data = {
                key: key || undefined,
                value,
                headers: Object.keys(headers).length > 0 ? headers : undefined,
                partition: partition ? parseInt(partition) : undefined,
                compression: compression !== 'none' ? compression : undefined
            };

            vscode.postMessage({ command: 'produce', data });
        }

        function loadTemplate(templateName) {
            vscode.postMessage({ command: 'loadTemplate', template: templateName });
        }

        function loadTemplateData(template) {
            document.getElementById('messageKey').value = template.key || '';
            document.getElementById('messageValue').value = template.value || '';
            document.getElementById('partition').value = template.partition !== undefined ? template.partition : '';

            // Clear existing headers
            document.getElementById('headersContainer').innerHTML = '';

            // Load template headers
            if (template.headers) {
                Object.entries(template.headers).forEach(([key, value]) => {
                    addHeaderRow(key, value);
                });
            }

            showAlert('success', 'Template loaded successfully');
        }

        function addHeaderRow(key = '', value = '') {
            const container = document.getElementById('headersContainer');
            const row = document.createElement('div');
            row.className = 'header-row';
            row.innerHTML = \`
                <input type="text" class="header-key" placeholder="Header key" value="\${escapeHtml(key)}">
                <input type="text" class="header-value" placeholder="Header value" value="\${escapeHtml(value)}">
                <button class="btn" onclick="removeHeaderRow(this)">Remove</button>
            \`;
            container.appendChild(row);
        }

        function removeHeaderRow(button) {
            button.closest('.header-row').remove();
        }

        function clearForm() {
            document.getElementById('messageKey').value = '';
            document.getElementById('messageValue').value = '';
            document.getElementById('partition').value = '';
            document.getElementById('compression').value = 'none';
            document.getElementById('headersContainer').innerHTML = '';
            clearAlerts();
        }

        function updateStatus(state) {
            document.getElementById('messageCount').textContent = state.messageCount.toLocaleString();
            document.getElementById('errorCount').textContent = state.errorCount.toLocaleString();

            if (state.lastMessageTime) {
                const elapsed = Date.now() - state.lastMessageTime;
                document.getElementById('lastMessage').textContent = elapsed < 1000 ? 'Just now' : \`\${Math.floor(elapsed / 1000)}s ago\`;
            } else {
                document.getElementById('lastMessage').textContent = '-';
            }
        }

        function showAlert(type, message) {
            clearAlerts();
            const alertContainer = document.getElementById('alertContainer');
            const alert = document.createElement('div');
            alert.className = \`alert alert-\${type}\`;
            alert.textContent = message;
            alert.style.display = 'block';
            alertContainer.appendChild(alert);

            // Auto-hide after 5 seconds
            setTimeout(() => {
                alert.remove();
            }, 5000);
        }

        function clearAlerts() {
            document.getElementById('alertContainer').innerHTML = '';
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
