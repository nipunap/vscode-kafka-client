import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ini from 'ini';
import { validateBrokerList } from '../utils/validators';

export interface ClusterConnection {
    name: string;
    type: 'kafka' | 'msk';
    brokers?: string[];

    // AWS MSK specific
    region?: string;
    clusterArn?: string;
    awsProfile?: string; // AWS profile name to use
    assumeRoleArn?: string; // ARN of role to assume (optional)

    // Security
    securityProtocol: 'PLAINTEXT' | 'SSL' | 'SASL_PLAINTEXT' | 'SASL_SSL';

    // SASL
    saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'AWS_MSK_IAM';
    saslUsername?: string;
    saslPassword?: string;

    // SSL/TLS
    sslCaFile?: string;
    sslCertFile?: string;
    sslKeyFile?: string;
    sslPassword?: string;
    rejectUnauthorized?: boolean;

    // Schema Registry
    schemaRegistryUrl?: string;
    schemaRegistryApiKey?: string;
    schemaRegistryApiSecret?: string;
}

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

export class ClusterConnectionForm {
    async show(): Promise<ClusterConnection | undefined> {
        // Step 1: Choose cluster type
        const clusterType = await this.selectClusterType();
        if (!clusterType) {
            return undefined;
        }

        // Step 2: Basic info
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this connection',
            placeHolder: 'my-kafka-cluster',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Name is required';
                }
                return undefined;
            }
        });

        if (!name) {
            return undefined;
        }

        let connection: ClusterConnection = {
            name,
            type: clusterType as 'kafka' | 'msk',
            securityProtocol: 'PLAINTEXT'
        };

        if (clusterType === 'msk') {
            // AWS MSK flow
            const mskConnection = await this.configureMSK(connection);
            if (!mskConnection) {
                return undefined;
            }
            connection = mskConnection;
        } else {
            // Regular Kafka flow
            const kafkaConnection = await this.configureKafka(connection);
            if (!kafkaConnection) {
                return undefined;
            }
            connection = kafkaConnection;
        }

        return connection;
    }

    private async selectClusterType(): Promise<string | undefined> {
        const options = [
            {
                label: '$(server) Apache Kafka',
                description: 'Connect to Apache Kafka cluster',
                value: 'kafka'
            },
            {
                label: '$(cloud) AWS MSK',
                description: 'Connect to Amazon Managed Streaming for Apache Kafka',
                value: 'msk'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select cluster type',
            ignoreFocusOut: true
        });

        return selected?.value;
    }

    private async configureKafka(connection: ClusterConnection): Promise<ClusterConnection | undefined> {
        // Step 1: Bootstrap servers
        const brokersInput = await vscode.window.showInputBox({
            prompt: 'Enter broker addresses (comma-separated)',
            placeHolder: 'localhost:9092,localhost:9093',
            validateInput: (value) => {
                return validateBrokerList(value);
            }
        });

        if (!brokersInput) {
            return undefined;
        }

        // Validation already done by validateInput, but split here
        connection.brokers = brokersInput.split(',').map(b => b.trim()).filter(b => b.length > 0);

        // Step 2: Security protocol
        const securityProtocol = await this.selectSecurityProtocol();
        if (!securityProtocol) {
            return undefined;
        }

        connection.securityProtocol = securityProtocol as any;

        // Step 3: Configure auth based on protocol
        if (securityProtocol.includes('SASL')) {
            const saslConfig = await this.configureSASL();
            if (!saslConfig) {
                return undefined;
            }
            Object.assign(connection, saslConfig);
        }

        if (securityProtocol.includes('SSL') || securityProtocol === 'SSL') {
            const sslConfig = await this.configureSSL();
            if (!sslConfig) {
                return undefined;
            }
            Object.assign(connection, sslConfig);
        }

        // Step 4: Optional Schema Registry configuration
        const schemaRegistryConfig = await this.configureSchemaRegistry();
        if (schemaRegistryConfig) {
            Object.assign(connection, schemaRegistryConfig);
        }

        return connection;
    }

    private async configureMSK(connection: ClusterConnection): Promise<ClusterConnection | undefined> {
        // Step 1: Authentication method
        const authMethod = await this.selectMSKAuthMethod();
        if (!authMethod) {
            return undefined;
        }

        if (authMethod === 'iam') {
            connection.securityProtocol = 'SASL_SSL';
            connection.saslMechanism = 'AWS_MSK_IAM';

            // Step 2: Select AWS profile
            const profile = await this.selectAWSProfile();
            if (!profile) {
                return undefined;
            }
            connection.awsProfile = profile;

            // Step 3: Ask about role assumption
            const shouldAssumeRole = await vscode.window.showQuickPick(
                ['No', 'Yes'],
                {
                    placeHolder: 'Do you need to assume an IAM role?',
                    ignoreFocusOut: true
                }
            );

            if (!shouldAssumeRole) {
                return undefined;
            }

            if (shouldAssumeRole === 'Yes') {
                const roleArn = await vscode.window.showInputBox({
                    prompt: 'Enter the ARN of the role to assume',
                    placeHolder: 'arn:aws:iam::123456789012:role/MyKafkaRole',
                    validateInput: (value) => {
                        if (!value || !value.startsWith('arn:aws:iam:')) {
                            return 'Invalid IAM role ARN format';
                        }
                        return undefined;
                    }
                });

                if (!roleArn) {
                    return undefined;
                }
                connection.assumeRoleArn = roleArn;
            }

            // Step 4: AWS Region
            const region = await this.selectAWSRegion();
            if (!region) {
                return undefined;
            }
            connection.region = region;

            // Step 5: List and select MSK cluster
            const cluster = await this.selectMSKCluster(profile, region, connection.assumeRoleArn);
            if (!cluster) {
                return undefined;
            }
            connection.clusterArn = cluster.clusterArn;

        } else if (authMethod === 'sasl_scram') {
            connection.securityProtocol = 'SASL_SSL';

            // For SASL/SCRAM, we still need region and cluster
            const region = await this.selectAWSRegion();
            if (!region) {
                return undefined;
            }
            connection.region = region;

            const clusterArn = await vscode.window.showInputBox({
                prompt: 'Enter MSK cluster ARN',
                placeHolder: 'arn:aws:kafka:us-east-1:123456789012:cluster/my-cluster/...',
                validateInput: (value) => {
                    if (!value || !value.startsWith('arn:aws:kafka:')) {
                        return 'Invalid MSK cluster ARN format';
                    }
                    return undefined;
                }
            });

            if (!clusterArn) {
                return undefined;
            }
            connection.clusterArn = clusterArn;

            const saslConfig = await this.configureSASL(['SCRAM-SHA-512']);
            if (!saslConfig) {
                return undefined;
            }
            Object.assign(connection, saslConfig);
        } else {
            connection.securityProtocol = 'SSL';

            const region = await this.selectAWSRegion();
            if (!region) {
                return undefined;
            }
            connection.region = region;

            const clusterArn = await vscode.window.showInputBox({
                prompt: 'Enter MSK cluster ARN',
                placeHolder: 'arn:aws:kafka:us-east-1:123456789012:cluster/my-cluster/...',
                validateInput: (value) => {
                    if (!value || !value.startsWith('arn:aws:kafka:')) {
                        return 'Invalid MSK cluster ARN format';
                    }
                    return undefined;
                }
            });

            if (!clusterArn) {
                return undefined;
            }
            connection.clusterArn = clusterArn;
        }

        // Optional Schema Registry configuration
        const schemaRegistryConfig = await this.configureSchemaRegistry();
        if (schemaRegistryConfig) {
            Object.assign(connection, schemaRegistryConfig);
        }

        return connection;
    }

    private async selectSecurityProtocol(): Promise<string | undefined> {
        const options = [
            {
                label: 'PLAINTEXT',
                description: 'No encryption or authentication',
                detail: 'Not recommended for production'
            },
            {
                label: 'SSL',
                description: 'SSL/TLS encryption without SASL',
                detail: 'Certificate-based authentication'
            },
            {
                label: 'SASL_PLAINTEXT',
                description: 'SASL authentication without encryption',
                detail: 'Not recommended for production'
            },
            {
                label: 'SASL_SSL',
                description: 'SASL authentication with SSL/TLS encryption',
                detail: 'Recommended for production'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select security protocol',
            ignoreFocusOut: true
        });

        return selected?.label;
    }

    private async configureSASL(allowedMechanisms?: string[]): Promise<Partial<ClusterConnection> | undefined> {
        // Select SASL mechanism
        let mechanisms = allowedMechanisms || ['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512'];

        const mechanismOptions = mechanisms.map(m => ({
            label: m,
            description: this.getSASLMechanismDescription(m)
        }));

        const selected = await vscode.window.showQuickPick(mechanismOptions, {
            placeHolder: 'Select SASL mechanism',
            ignoreFocusOut: true
        });

        if (!selected) {
            return undefined;
        }

        const saslMechanism = selected.label as any;

        // Get credentials
        const username = await vscode.window.showInputBox({
            prompt: 'Enter SASL username',
            placeHolder: 'username'
        });

        if (!username) {
            return undefined;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Enter SASL password',
            password: true
        });

        if (!password) {
            return undefined;
        }

        return {
            saslMechanism,
            saslUsername: username,
            saslPassword: password
        };
    }

    private async configureSSL(): Promise<Partial<ClusterConnection> | undefined> {
        const needsCerts = await vscode.window.showQuickPick(
            ['No', 'Yes'],
            {
                placeHolder: 'Do you need to provide SSL certificates?',
                ignoreFocusOut: true
            }
        );

        if (needsCerts !== 'Yes') {
            return {
                rejectUnauthorized: false
            };
        }

        const caFile = await this.selectFile('Select CA certificate file', [
            { name: 'Certificate Files', extensions: ['pem', 'crt', 'cer'] },
            { name: 'All Files', extensions: ['*'] }
        ]);

        const certFile = await this.selectFile('Select client certificate file (optional)', [
            { name: 'Certificate Files', extensions: ['pem', 'crt', 'cer'] },
            { name: 'All Files', extensions: ['*'] }
        ], true);

        const keyFile = await this.selectFile('Select client key file (optional)', [
            { name: 'Key Files', extensions: ['pem', 'key'] },
            { name: 'All Files', extensions: ['*'] }
        ], true);

        let keyPassword: string | undefined;
        if (keyFile) {
            const needsPassword = await vscode.window.showQuickPick(
                ['No', 'Yes'],
                { placeHolder: 'Is the key file password protected?' }
            );

            if (needsPassword === 'Yes') {
                keyPassword = await vscode.window.showInputBox({
                    prompt: 'Enter key file password',
                    password: true
                });
            }
        }

        return {
            sslCaFile: caFile,
            sslCertFile: certFile,
            sslKeyFile: keyFile,
            sslPassword: keyPassword,
            rejectUnauthorized: true
        };
    }

    private async selectFile(prompt: string, filterExtensions: { name: string; extensions: string[] }[], optional: boolean = false): Promise<string | undefined> {
        const filters: { [name: string]: string[] } = {};
        for (const filter of filterExtensions) {
            filters[filter.name] = filter.extensions;
        }

        const result = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select',
            filters,
            title: prompt
        });

        if (!result || result.length === 0) {
            if (optional) {
                return undefined;
            }
            throw new Error('File selection cancelled');
        }

        const filePath = result[0].fsPath;

        // Verify file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        return filePath;
    }

    private async selectAWSRegion(): Promise<string | undefined> {
        const regions = [
            'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
            'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
            'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
            'sa-east-1', 'ca-central-1'
        ];

        const selected = await vscode.window.showQuickPick(regions, {
            placeHolder: 'Select AWS region',
            ignoreFocusOut: true
        });

        return selected;
    }

    private async selectMSKAuthMethod(): Promise<string | undefined> {
        const options = [
            {
                label: 'IAM',
                description: 'AWS IAM authentication',
                detail: 'Uses AWS credentials from your environment',
                value: 'iam'
            },
            {
                label: 'SASL/SCRAM',
                description: 'Username/password authentication',
                detail: 'SCRAM-SHA-512 mechanism',
                value: 'sasl_scram'
            },
            {
                label: 'TLS',
                description: 'Mutual TLS authentication',
                detail: 'Certificate-based authentication',
                value: 'tls'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select authentication method for MSK',
            ignoreFocusOut: true
        });

        return selected?.value;
    }

    private getSASLMechanismDescription(mechanism: string): string {
        switch (mechanism) {
            case 'PLAIN':
                return 'Simple username/password (not encrypted)';
            case 'SCRAM-SHA-256':
                return 'Salted Challenge Response with SHA-256';
            case 'SCRAM-SHA-512':
                return 'Salted Challenge Response with SHA-512 (recommended)';
            case 'AWS_MSK_IAM':
                return 'AWS IAM authentication for MSK';
            default:
                return '';
        }
    }

    private async selectAWSProfile(): Promise<string | undefined> {
        const profiles = await this.getAWSProfiles();

        if (profiles.length === 0) {
            vscode.window.showErrorMessage(
                'No AWS profiles found. Please run "aws configure" to set up AWS credentials.'
            );
            return undefined;
        }

        const options = profiles.map(profile => {
            let description = '';
            let detail = '';

            if (!profile.hasCredentials) {
                description = '⚠️  No credentials found';
            } else if (profile.isExpired) {
                description = '🔴 Expired';
                detail = profile.expiresAt ? `Expired on ${profile.expiresAt.toLocaleString()}` : '';
            } else if (profile.expiresAt) {
                const now = new Date();
                const minutesLeft = Math.floor((profile.expiresAt.getTime() - now.getTime()) / (1000 * 60));

                if (minutesLeft < 0) {
                    description = '🔴 Expired';
                    detail = `Expired on ${profile.expiresAt.toLocaleString()}`;
                } else if (minutesLeft < 15) {
                    // Critical: Less than 15 minutes - about to expire
                    description = `🔴 ${minutesLeft} minutes left`;
                    detail = `Expires at ${profile.expiresAt.toLocaleTimeString()}`;
                } else if (minutesLeft < 60) {
                    // Warning: 15-59 minutes - expiring soon
                    description = `🟡 ${minutesLeft} minutes left`;
                    detail = `Expires at ${profile.expiresAt.toLocaleTimeString()}`;
                } else if (minutesLeft < 1440) { // Less than 24 hours
                    const hoursLeft = Math.floor(minutesLeft / 60);
                    const remainingMinutes = minutesLeft % 60;
                    description = `🟡 ${hoursLeft}h ${remainingMinutes}m left`;
                    detail = `Expires at ${profile.expiresAt.toLocaleString()}`;
                } else {
                    const daysLeft = Math.floor(minutesLeft / 1440);
                    description = `🟢 ${daysLeft} day${daysLeft > 1 ? 's' : ''} left`;
                    detail = `Expires on ${profile.expiresAt.toLocaleDateString()}`;
                }
            } else {
                description = '🟢 Active (permanent credentials)';
            }

            return {
                label: profile.name === 'default' ? `$(star) ${profile.name}` : profile.name,
                description,
                detail,
                value: profile.name
            };
        });

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select AWS profile to use',
            ignoreFocusOut: true
        });

        return selected?.value;
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

                // Check for session token expiration
                if (profileData.x_security_token_expires) {
                    try {
                        // Parse ISO 8601 format or other common formats
                        const expiresAt = new Date(profileData.x_security_token_expires);
                        if (!isNaN(expiresAt.getTime())) {
                            profile.expiresAt = expiresAt;
                            profile.isExpired = expiresAt < new Date();
                        }
                    } catch (_error) {
                        // Ignore parse errors
                    }
                }

                profiles.push(profile);
            }
        } catch (error) {
            console.error('Failed to read AWS credentials:', error);
        }

        // Sort profiles: default first, then by expiration (non-expired first), then alphabetically
        profiles.sort((a, b) => {
            if (a.name === 'default') {return -1;}
            if (b.name === 'default') {return 1;}

            if (a.isExpired && !b.isExpired) {return 1;}
            if (!a.isExpired && b.isExpired) {return -1;}

            return a.name.localeCompare(b.name);
        });

        return profiles;
    }

    private async selectMSKCluster(profile: string, region: string, assumeRoleArn?: string): Promise<MSKCluster | undefined> {
        try {
            // Show progress while fetching clusters
            const clusters = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Discovering MSK clusters...',
                cancellable: false
            }, async () => {
                return await this.listMSKClusters(profile, region, assumeRoleArn);
            });

            if (clusters.length === 0) {
                const enterManually = await vscode.window.showInformationMessage(
                    'No MSK clusters found in this region.',
                    'Enter ARN Manually'
                );

                if (enterManually) {
                    const clusterArn = await vscode.window.showInputBox({
                        prompt: 'Enter MSK cluster ARN',
                        placeHolder: 'arn:aws:kafka:' + region + ':123456789012:cluster/my-cluster/...',
                        validateInput: (value) => {
                            if (!value || !value.startsWith('arn:aws:kafka:')) {
                                return 'Invalid MSK cluster ARN format';
                            }
                            return undefined;
                        }
                    });

                    if (clusterArn) {
                        return {
                            clusterName: clusterArn.split('/')[1] || 'manual-cluster',
                            clusterArn,
                            state: 'UNKNOWN',
                            clusterType: 'UNKNOWN'
                        };
                    }
                }
                return undefined;
            }

            // Create picker options
            const options = clusters.map(cluster => {
                let icon = '$(server)';
                let description = cluster.state;

                if (cluster.state === 'ACTIVE') {
                    icon = '$(pass-filled)';
                } else if (cluster.state === 'CREATING') {
                    icon = '$(sync~spin)';
                } else if (cluster.state === 'FAILED') {
                    icon = '$(error)';
                }

                return {
                    label: `${icon} ${cluster.clusterName}`,
                    description,
                    detail: `${cluster.clusterType} - ${cluster.clusterArn}`,
                    cluster
                };
            });

            // Add manual entry option
            options.push({
                label: '$(edit) Enter ARN manually',
                description: 'Type the cluster ARN',
                detail: 'For clusters in other regions or accounts',
                cluster: undefined as any
            });

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: `Select MSK cluster in ${region} (${clusters.length} found)`,
                ignoreFocusOut: true
            });

            if (!selected) {
                return undefined;
            }

            // Handle manual entry
            if (!selected.cluster) {
                const clusterArn = await vscode.window.showInputBox({
                    prompt: 'Enter MSK cluster ARN',
                    placeHolder: 'arn:aws:kafka:' + region + ':123456789012:cluster/my-cluster/...',
                    validateInput: (value) => {
                        if (!value || !value.startsWith('arn:aws:kafka:')) {
                            return 'Invalid MSK cluster ARN format';
                        }
                        return undefined;
                    }
                });

                if (clusterArn) {
                    return {
                        clusterName: clusterArn.split('/')[1] || 'manual-cluster',
                        clusterArn,
                        state: 'UNKNOWN',
                        clusterType: 'UNKNOWN'
                    };
                }
                return undefined;
            }

            return selected.cluster;
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to list MSK clusters: ${error?.message || error}`
            );
            return undefined;
        }
    }

    private async listMSKClusters(profile: string, region: string, assumeRoleArn?: string): Promise<MSKCluster[]> {
        try {
            const { KafkaClient, ListClustersV2Command } = require('@aws-sdk/client-kafka');
            const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
            const { fromIni } = require('@aws-sdk/credential-providers');

            let credentials;

            // If we need to assume a role
            if (assumeRoleArn) {
                // First get credentials from the profile
                const baseCredentials = fromIni({ profile });

                // Create STS client with profile credentials
                const stsClient = new STSClient({
                    region,
                    credentials: baseCredentials
                });

                // Assume the role
                const assumeRoleResponse = await stsClient.send(new AssumeRoleCommand({
                    RoleArn: assumeRoleArn,
                    RoleSessionName: 'vscode-kafka-extension'
                }));

                if (!assumeRoleResponse.Credentials) {
                    throw new Error('Failed to assume role: No credentials returned');
                }

                // Use the assumed role credentials
                credentials = {
                    accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
                    secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
                    sessionToken: assumeRoleResponse.Credentials.SessionToken
                };
            } else {
                // Use credentials directly from profile
                credentials = fromIni({ profile });
            }

            // Create Kafka client
            const kafkaClient = new KafkaClient({
                region,
                credentials
            });

            const clusters: MSKCluster[] = [];
            let nextToken: string | undefined;

            // Paginate through all clusters
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

            return clusters;
        } catch (error: any) {
            console.error('Failed to list MSK clusters:', error);
            throw new Error(
                `Could not list MSK clusters: ${error?.message || error}. ` +
                `Verify: 1) AWS credentials are valid, 2) You have kafka:ListClusters permission, 3) Region is correct`
            );
        }
    }

    private async configureSchemaRegistry(): Promise<Partial<ClusterConnection> | undefined> {
        // Ask if user wants to configure Schema Registry
        const configureRegistry = await vscode.window.showQuickPick(
            [
                { label: 'Yes', description: 'Configure Schema Registry for this cluster', value: true },
                { label: 'No', description: 'Skip Schema Registry configuration (can be added later)', value: false }
            ],
            {
                placeHolder: 'Do you want to configure Schema Registry?',
                ignoreFocusOut: true
            }
        );

        if (!configureRegistry || !configureRegistry.value) {
            return undefined;
        }

        // Step 1: Schema Registry URL
        const schemaRegistryUrl = await vscode.window.showInputBox({
            prompt: 'Enter Schema Registry URL (must use HTTPS)',
            placeHolder: 'https://schema-registry.example.com:8081',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Schema Registry URL is required';
                }
                if (!value.startsWith('https://')) {
                    return 'Schema Registry URL must use HTTPS (SEC-3.1-3)';
                }
                return undefined;
            }
        });

        if (!schemaRegistryUrl) {
            return undefined;
        }

        // Step 2: Ask if authentication is needed
        const needsAuth = await vscode.window.showQuickPick(
            [
                { label: 'Yes', description: 'Schema Registry requires authentication', value: true },
                { label: 'No', description: 'Schema Registry is open (no authentication)', value: false }
            ],
            {
                placeHolder: 'Does Schema Registry require authentication?',
                ignoreFocusOut: true
            }
        );

        if (!needsAuth) {
            return undefined;
        }

        const config: Partial<ClusterConnection> = {
            schemaRegistryUrl
        };

        if (needsAuth.value) {
            // Step 3: API Key
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter Schema Registry API Key',
                placeHolder: 'API Key',
                password: false
            });

            if (!apiKey) {
                return undefined;
            }

            // Step 4: API Secret
            const apiSecret = await vscode.window.showInputBox({
                prompt: 'Enter Schema Registry API Secret',
                placeHolder: 'API Secret',
                password: true
            });

            if (!apiSecret) {
                return undefined;
            }

            config.schemaRegistryApiKey = apiKey;
            config.schemaRegistryApiSecret = apiSecret;
        }

        return config;
    }
}
