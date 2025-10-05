import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as ini from 'ini';
import { ClusterConnection } from './clusterConnectionForm';

interface AWSProfile {
    name: string;
    hasCredentials: boolean;
    expiresAt?: Date;
    isExpired?: boolean;
}

interface MSKCluster {
    clusterName: string;
    clusterArn: string;
    state: string;
    clusterType: string;
}

export class ClusterConnectionWebview {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private resolvePromise: ((value: ClusterConnection | undefined) => void) | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async show(): Promise<ClusterConnection | undefined> {
        // Create webview panel
        this.panel = vscode.window.createWebviewPanel(
            'kafkaClusterForm',
            'Add Kafka Cluster',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Set HTML content
        this.panel.webview.html = this.getHtmlContent();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        // Wait for form submission or cancellation
        return new Promise<ClusterConnection | undefined>((resolve) => {
            this.resolvePromise = resolve;

            // Handle panel disposal
            this.panel!.onDidDispose(() => {
                if (this.resolvePromise) {
                    this.resolvePromise(undefined);
                }
            });
        });
    }

    private async handleMessage(message: any) {
        switch (message.command) {
            case 'getProfiles':
                const profiles = await this.getAWSProfiles();
                this.panel?.webview.postMessage({
                    command: 'profilesLoaded',
                    profiles: profiles.map(p => ({
                        name: p.name,
                        status: this.getProfileStatus(p)
                    }))
                });
                break;

            case 'listClusters':
                await this.listMSKClusters(message.profile, message.region, message.assumeRoleArn);
                break;

            case 'submit':
                const connection = this.buildConnection(message.data);
                if (this.resolvePromise) {
                    this.resolvePromise(connection);
                }
                this.panel?.dispose();
                break;

            case 'cancel':
                if (this.resolvePromise) {
                    this.resolvePromise(undefined);
                }
                this.panel?.dispose();
                break;
        }
    }

    private buildConnection(data: any): ClusterConnection {
        const connection: ClusterConnection = {
            name: data.name,
            type: data.type,
            securityProtocol: 'PLAINTEXT'
        };

        if (data.type === 'kafka') {
            connection.brokers = data.brokers.split(',').map((b: string) => b.trim());
            connection.securityProtocol = data.securityProtocol;

            if (data.securityProtocol.includes('SASL')) {
                connection.saslMechanism = data.saslMechanism;
                connection.saslUsername = data.saslUsername;
                connection.saslPassword = data.saslPassword;
            }

            if (data.securityProtocol.includes('SSL') || data.securityProtocol === 'SSL') {
                connection.sslCaFile = data.sslCaFile;
                connection.sslCertFile = data.sslCertFile;
                connection.sslKeyFile = data.sslKeyFile;
                connection.sslPassword = data.sslPassword;
                connection.rejectUnauthorized = data.rejectUnauthorized !== false;
            }
        } else if (data.type === 'msk') {
            connection.region = data.region;
            connection.clusterArn = data.clusterArn;
            connection.awsProfile = data.awsProfile;
            connection.assumeRoleArn = data.assumeRoleArn || undefined;

            if (data.authMethod === 'iam') {
                connection.securityProtocol = 'SASL_SSL';
                connection.saslMechanism = 'AWS_MSK_IAM';
            } else if (data.authMethod === 'sasl_scram') {
                connection.securityProtocol = 'SASL_SSL';
                connection.saslMechanism = 'SCRAM-SHA-512';
                connection.saslUsername = data.saslUsername;
                connection.saslPassword = data.saslPassword;
            } else {
                connection.securityProtocol = 'SSL';
            }
        }

        return connection;
    }

    private async getAWSProfiles(): Promise<AWSProfile[]> {
        const profiles: AWSProfile[] = [];
        const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');

        if (!fs.existsSync(credentialsPath)) {
            return profiles;
        }

        try {
            const credentialsContent = fs.readFileSync(credentialsPath, 'utf-8');
            const credentialsData = ini.parse(credentialsContent);

            for (const profileName in credentialsData) {
                const profileData = credentialsData[profileName];

                const profile: AWSProfile = {
                    name: profileName,
                    hasCredentials: !!(profileData.aws_access_key_id && profileData.aws_secret_access_key)
                };

                if (profileData.x_security_token_expires) {
                    try {
                        const expiresAt = new Date(profileData.x_security_token_expires);
                        if (!isNaN(expiresAt.getTime())) {
                            profile.expiresAt = expiresAt;
                            profile.isExpired = expiresAt < new Date();
                        }
                    } catch (error) {
                        // Ignore parse errors
                    }
                }

                profiles.push(profile);
            }
        } catch (error) {
            console.error('Failed to read AWS credentials:', error);
        }

        profiles.sort((a, b) => {
            if (a.name === 'default') {return -1;}
            if (b.name === 'default') {return 1;}
            if (a.isExpired && !b.isExpired) {return 1;}
            if (!a.isExpired && b.isExpired) {return -1;}
            return a.name.localeCompare(b.name);
        });

        return profiles;
    }

    private getProfileStatus(profile: AWSProfile): string {
        if (!profile.hasCredentials) {
            return '⚠️ No credentials';
        } else if (profile.isExpired) {
            return '🔴 Expired';
        } else if (profile.expiresAt) {
            const now = new Date();
            const minutesLeft = Math.floor((profile.expiresAt.getTime() - now.getTime()) / (1000 * 60));

            if (minutesLeft < 0) {
                return '🔴 Expired';
            } else if (minutesLeft < 60) {
                return `🔴 Expires in ${minutesLeft}m`;
            } else if (minutesLeft < 1440) { // Less than 24 hours
                const hoursLeft = Math.floor(minutesLeft / 60);
                const remainingMinutes = minutesLeft % 60;
                return `🟡 ${hoursLeft}h ${remainingMinutes}m left`;
            } else {
                const daysLeft = Math.floor(minutesLeft / 1440);
                return `🟢 ${daysLeft} day${daysLeft > 1 ? 's' : ''} left`;
            }
        }
        return '🟢 Active';
    }

    private async listMSKClusters(profile: string, region: string, assumeRoleArn?: string) {
        try {
            const { KafkaClient, ListClustersV2Command } = require('@aws-sdk/client-kafka');
            const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
            const { fromIni } = require('@aws-sdk/credential-providers');

            let credentials;

            if (assumeRoleArn) {
                const baseCredentials = fromIni({ profile });
                const stsClient = new STSClient({ region, credentials: baseCredentials });
                const assumeRoleResponse = await stsClient.send(new AssumeRoleCommand({
                    RoleArn: assumeRoleArn,
                    RoleSessionName: 'vscode-kafka-extension'
                }));

                if (!assumeRoleResponse.Credentials) {
                    throw new Error('Failed to assume role');
                }

                credentials = {
                    accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
                    secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
                    sessionToken: assumeRoleResponse.Credentials.SessionToken
                };
            } else {
                credentials = fromIni({ profile });
            }

            const kafkaClient = new KafkaClient({ region, credentials });
            const clusters: MSKCluster[] = [];
            let nextToken: string | undefined;

            do {
                const response = await kafkaClient.send(new ListClustersV2Command({
                    NextToken: nextToken,
                    MaxResults: 100
                }));

                if (response.ClusterInfoList) {
                    for (const cluster of response.ClusterInfoList) {
                        clusters.push({
                            clusterName: cluster.ClusterName || 'Unknown',
                            clusterArn: cluster.ClusterArn || '',
                            state: cluster.State || 'UNKNOWN',
                            clusterType: cluster.ClusterType || 'PROVISIONED'
                        });
                    }
                }

                nextToken = response.NextToken;
            } while (nextToken);

            this.panel?.webview.postMessage({
                command: 'clustersLoaded',
                clusters: clusters
            });
        } catch (error: any) {
            this.panel?.webview.postMessage({
                command: 'error',
                message: `Failed to list clusters: ${error?.message || error}`
            });
        }
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Kafka Cluster</title>
    <style>
        body {
            padding: 20px;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }

        .form-section {
            margin-bottom: 25px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background: var(--vscode-editor-background);
        }

        .form-section h3 {
            margin-top: 0;
            color: var(--vscode-foreground);
            font-size: 14px;
            font-weight: 600;
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 4px;
            font-size: 13px;
            color: var(--vscode-foreground);
        }

        input[type="text"],
        input[type="password"],
        select,
        textarea {
            width: 100%;
            padding: 6px 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            box-sizing: border-box;
        }

        input:focus,
        select:focus,
        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        button {
            padding: 6px 14px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            margin-right: 8px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .hidden {
            display: none;
        }

        .button-group {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .status-badge {
            display: inline-block;
            margin-left: 8px;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 2px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .loading {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .error {
            color: var(--vscode-errorForeground);
            padding: 8px;
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 2px;
            margin-top: 8px;
        }

        .cluster-option {
            padding: 8px;
            margin: 4px 0;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            cursor: pointer;
        }

        .cluster-option:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .cluster-option.selected {
            background: var(--vscode-list-activeSelectionBackground);
            border-color: var(--vscode-focusBorder);
        }
    </style>
</head>
<body>
    <h2>Add Kafka Cluster Connection</h2>

    <form id="clusterForm">
        <!-- Basic Info -->
        <div class="form-section">
            <h3>Basic Information</h3>

            <div class="form-group">
                <label for="clusterType">Cluster Type *</label>
                <select id="clusterType" required>
                    <option value="">-- Select Type --</option>
                    <option value="kafka">Apache Kafka</option>
                    <option value="msk">AWS MSK</option>
                </select>
            </div>

            <div class="form-group">
                <label for="name">Connection Name *</label>
                <input type="text" id="name" required placeholder="my-kafka-cluster">
                <div class="help-text">A friendly name for this connection</div>
            </div>
        </div>

        <!-- Kafka Section -->
        <div id="kafkaSection" class="form-section hidden">
            <h3>Kafka Configuration</h3>

            <div class="form-group">
                <label for="brokers">Bootstrap Servers *</label>
                <input type="text" id="brokers" placeholder="localhost:9092,localhost:9093">
                <div class="help-text">Comma-separated list of broker addresses</div>
            </div>

            <div class="form-group">
                <label for="securityProtocol">Security Protocol</label>
                <select id="securityProtocol">
                    <option value="PLAINTEXT">PLAINTEXT</option>
                    <option value="SSL">SSL</option>
                    <option value="SASL_PLAINTEXT">SASL_PLAINTEXT</option>
                    <option value="SASL_SSL">SASL_SSL</option>
                </select>
            </div>

            <div id="saslSection" class="hidden">
                <div class="form-group">
                    <label for="saslMechanism">SASL Mechanism</label>
                    <select id="saslMechanism">
                        <option value="PLAIN">PLAIN</option>
                        <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                        <option value="SCRAM-SHA-512">SCRAM-SHA-512</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="saslUsername">Username</label>
                    <input type="text" id="saslUsername">
                </div>

                <div class="form-group">
                    <label for="saslPassword">Password</label>
                    <input type="password" id="saslPassword">
                </div>
            </div>

            <div id="sslSection" class="hidden">
                <div class="form-group">
                    <label for="sslCaFile">CA Certificate Path</label>
                    <input type="text" id="sslCaFile" placeholder="/path/to/ca-cert.pem">
                </div>

                <div class="form-group">
                    <label for="sslCertFile">Client Certificate Path</label>
                    <input type="text" id="sslCertFile" placeholder="/path/to/client-cert.pem">
                </div>

                <div class="form-group">
                    <label for="sslKeyFile">Client Key Path</label>
                    <input type="text" id="sslKeyFile" placeholder="/path/to/client-key.pem">
                </div>

                <div class="form-group">
                    <label for="sslPassword">Key Password</label>
                    <input type="password" id="sslPassword">
                </div>
            </div>
        </div>

        <!-- MSK Section -->
        <div id="mskSection" class="form-section hidden">
            <h3>AWS MSK Configuration</h3>

            <div class="form-group">
                <label for="authMethod">Authentication Method *</label>
                <select id="authMethod">
                    <option value="">-- Select Method --</option>
                    <option value="iam">IAM</option>
                    <option value="sasl_scram">SASL/SCRAM</option>
                    <option value="tls">TLS</option>
                </select>
            </div>

            <div id="mskIamSection" class="hidden">
                <div class="form-group">
                    <label for="awsProfile">AWS Profile *</label>
                    <select id="awsProfile">
                        <option value="">Loading profiles...</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="useAssumeRole">
                        Assume IAM Role
                    </label>
                </div>

                <div id="assumeRoleSection" class="hidden form-group">
                    <label for="assumeRoleArn">Role ARN</label>
                    <input type="text" id="assumeRoleArn" placeholder="arn:aws:iam::123456789012:role/MyRole">
                </div>

                <div class="form-group">
                    <label for="region">AWS Region *</label>
                    <select id="region">
                        <option value="">-- Select Region --</option>
                        <option value="us-east-1">us-east-1</option>
                        <option value="us-east-2">us-east-2</option>
                        <option value="us-west-1">us-west-1</option>
                        <option value="us-west-2">us-west-2</option>
                        <option value="eu-west-1">eu-west-1</option>
                        <option value="eu-west-2">eu-west-2</option>
                        <option value="eu-west-3">eu-west-3</option>
                        <option value="eu-central-1">eu-central-1</option>
                        <option value="ap-south-1">ap-south-1</option>
                        <option value="ap-southeast-1">ap-southeast-1</option>
                        <option value="ap-southeast-2">ap-southeast-2</option>
                        <option value="ap-northeast-1">ap-northeast-1</option>
                        <option value="ap-northeast-2">ap-northeast-2</option>
                        <option value="sa-east-1">sa-east-1</option>
                        <option value="ca-central-1">ca-central-1</option>
                    </select>
                </div>

                <div class="form-group">
                    <button type="button" id="discoverClusters" class="secondary">
                        Discover Clusters
                    </button>
                    <span id="discoverStatus"></span>
                </div>

                <div id="clusterList" class="hidden">
                    <label>Select Cluster *</label>
                    <div id="clusters"></div>
                </div>

                <div class="form-group">
                    <label for="clusterArn">Or Enter Cluster ARN Manually</label>
                    <input type="text" id="clusterArn" placeholder="arn:aws:kafka:region:account:cluster/...">
                </div>
            </div>

            <div id="mskScramSection" class="hidden">
                <div class="form-group">
                    <label for="mskRegion">AWS Region *</label>
                    <select id="mskRegion">
                        <option value="us-east-1">us-east-1</option>
                        <option value="us-west-2">us-west-2</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="mskClusterArn">Cluster ARN *</label>
                    <input type="text" id="mskClusterArn" placeholder="arn:aws:kafka:...">
                </div>

                <div class="form-group">
                    <label for="mskUsername">Username *</label>
                    <input type="text" id="mskUsername">
                </div>

                <div class="form-group">
                    <label for="mskPassword">Password *</label>
                    <input type="password" id="mskPassword">
                </div>
            </div>
        </div>

        <div class="button-group">
            <button type="submit">Connect</button>
            <button type="button" id="cancelBtn" class="secondary">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();

        // Load AWS profiles when page loads
        vscode.postMessage({ command: 'getProfiles' });

        // Handle cluster type change
        document.getElementById('clusterType').addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('kafkaSection').classList.toggle('hidden', type !== 'kafka');
            document.getElementById('mskSection').classList.toggle('hidden', type !== 'msk');
        });

        // Handle security protocol change
        document.getElementById('securityProtocol').addEventListener('change', (e) => {
            const protocol = e.target.value;
            document.getElementById('saslSection').classList.toggle('hidden', !protocol.includes('SASL'));
            document.getElementById('sslSection').classList.toggle('hidden', !protocol.includes('SSL') && protocol !== 'SSL');
        });

        // Handle auth method change
        document.getElementById('authMethod').addEventListener('change', (e) => {
            const method = e.target.value;
            document.getElementById('mskIamSection').classList.toggle('hidden', method !== 'iam');
            document.getElementById('mskScramSection').classList.toggle('hidden', method !== 'sasl_scram');
        });

        // Handle assume role checkbox
        document.getElementById('useAssumeRole').addEventListener('change', (e) => {
            document.getElementById('assumeRoleSection').classList.toggle('hidden', !e.target.checked);
        });

        // Discover clusters button
        document.getElementById('discoverClusters').addEventListener('click', () => {
            const profile = document.getElementById('awsProfile').value;
            const region = document.getElementById('region').value;
            const assumeRoleArn = document.getElementById('useAssumeRole').checked
                ? document.getElementById('assumeRoleArn').value
                : undefined;

            if (!profile || !region) {
                alert('Please select profile and region first');
                return;
            }

            document.getElementById('discoverStatus').textContent = 'Discovering...';
            document.getElementById('discoverStatus').className = 'loading';

            vscode.postMessage({
                command: 'listClusters',
                profile,
                region,
                assumeRoleArn
            });
        });

        // Form submission
        document.getElementById('clusterForm').addEventListener('submit', (e) => {
            e.preventDefault();

            const type = document.getElementById('clusterType').value;
            const data = {
                name: document.getElementById('name').value,
                type: type
            };

            if (type === 'kafka') {
                data.brokers = document.getElementById('brokers').value;
                data.securityProtocol = document.getElementById('securityProtocol').value;
                data.saslMechanism = document.getElementById('saslMechanism').value;
                data.saslUsername = document.getElementById('saslUsername').value;
                data.saslPassword = document.getElementById('saslPassword').value;
                data.sslCaFile = document.getElementById('sslCaFile').value;
                data.sslCertFile = document.getElementById('sslCertFile').value;
                data.sslKeyFile = document.getElementById('sslKeyFile').value;
                data.sslPassword = document.getElementById('sslPassword').value;
            } else if (type === 'msk') {
                data.authMethod = document.getElementById('authMethod').value;

                if (data.authMethod === 'iam') {
                    data.awsProfile = document.getElementById('awsProfile').value;
                    data.region = document.getElementById('region').value;
                    data.clusterArn = document.getElementById('clusterArn').value;
                    if (document.getElementById('useAssumeRole').checked) {
                        data.assumeRoleArn = document.getElementById('assumeRoleArn').value;
                    }
                } else if (data.authMethod === 'sasl_scram') {
                    data.region = document.getElementById('mskRegion').value;
                    data.clusterArn = document.getElementById('mskClusterArn').value;
                    data.saslUsername = document.getElementById('mskUsername').value;
                    data.saslPassword = document.getElementById('mskPassword').value;
                }
            }

            vscode.postMessage({
                command: 'submit',
                data: data
            });
        });

        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'profilesLoaded':
                    const profileSelect = document.getElementById('awsProfile');
                    profileSelect.innerHTML = '<option value="">-- Select Profile --</option>';
                    message.profiles.forEach(p => {
                        const option = document.createElement('option');
                        option.value = p.name;
                        option.textContent = p.name + ' ' + p.status;
                        profileSelect.appendChild(option);
                    });
                    break;

                case 'clustersLoaded':
                    document.getElementById('discoverStatus').textContent =
                        message.clusters.length + ' clusters found';
                    document.getElementById('discoverStatus').className = '';

                    const clusterList = document.getElementById('clusters');
                    clusterList.innerHTML = '';

                    message.clusters.forEach(cluster => {
                        const div = document.createElement('div');
                        div.className = 'cluster-option';
                        div.innerHTML = \`
                            <strong>\${cluster.clusterName}</strong>
                            <span class="status-badge">\${cluster.state}</span><br>
                            <small>\${cluster.clusterType} - \${cluster.clusterArn}</small>
                        \`;
                        div.onclick = () => {
                            document.querySelectorAll('.cluster-option').forEach(el =>
                                el.classList.remove('selected'));
                            div.classList.add('selected');
                            document.getElementById('clusterArn').value = cluster.clusterArn;
                        };
                        clusterList.appendChild(div);
                    });

                    document.getElementById('clusterList').classList.remove('hidden');
                    break;

                case 'error':
                    document.getElementById('discoverStatus').innerHTML =
                        '<div class="error">' + message.message + '</div>';
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
