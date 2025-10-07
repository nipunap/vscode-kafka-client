import { Kafka, Admin, Producer, SASLOptions, logLevel } from 'kafkajs';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ini from 'ini';
import { ClusterConnection } from '../forms/clusterConnectionForm';
import { fromIni, fromEnv } from '@aws-sdk/credential-providers';
import { createMSKIAMAuthMechanism } from './mskIamAuthenticator';
import { Logger } from '../infrastructure/Logger';
import { ConnectionPool } from '../infrastructure/ConnectionPool';
import { CredentialManager } from '../infrastructure/CredentialManager';

// Type alias for cluster configuration
type ClusterConfig = ClusterConnection;

export class KafkaClientManager {
    private logger = Logger.getLogger('KafkaClientManager');
    private clusters: Map<string, ClusterConfig> = new Map();
    private kafkaInstances: Map<string, Kafka> = new Map();
    private admins: Map<string, Admin> = new Map();
    private producers: Map<string, Producer> = new Map();
    private connectionPool: ConnectionPool;

    constructor(private credentialManager?: CredentialManager) {
        this.logger.info('Initializing Kafka Client Manager');
        this.connectionPool = new ConnectionPool();
    }

    async addCluster(name: string, brokers: string[], sasl?: any) {
        // Legacy method for backward compatibility
        const connection: ClusterConnection = {
            name,
            type: 'kafka',
            brokers,
            securityProtocol: sasl ? 'SASL_SSL' : 'PLAINTEXT',
            saslUsername: sasl?.username,
            saslPassword: sasl?.password,
            saslMechanism: sasl?.mechanism?.toUpperCase()
        };

        return this.addClusterFromConnection(connection);
    }

    async addClusterFromConnection(connection: ClusterConnection) {
        this.logger.info(`Adding cluster: ${connection.name} (type: ${connection.type})`);
        
        // Store sensitive credentials in SecretStorage
        if (this.credentialManager) {
            if (connection.saslPassword) {
                await this.credentialManager.storePassword(connection.name, 'sasl', connection.saslPassword);
                this.logger.debug(`Stored SASL password for ${connection.name}`);
            }
            if (connection.sslPassword) {
                await this.credentialManager.storePassword(connection.name, 'ssl', connection.sslPassword);
                this.logger.debug(`Stored SSL password for ${connection.name}`);
            }
        }

        this.clusters.set(connection.name, connection);

        // Handle MSK clusters - fetch bootstrap brokers
        let brokers = connection.brokers || [];
        if (connection.type === 'msk' && connection.clusterArn && connection.region) {
            try {
                brokers = await this.getMSKBootstrapBrokers(connection.region, connection.clusterArn, connection.saslMechanism, connection.awsProfile);
                this.logger.debug(`Fetched ${brokers.length} MSK brokers for ${connection.name}`);
            } catch (error: any) {
                const errorMsg = error?.message || error.toString();

                if (errorMsg.includes('expired') || errorMsg.includes('ExpiredToken')) {
                    throw new Error(
                        'AWS credentials expired. Please refresh your credentials and try again.'
                    );
                } else if (errorMsg.includes('AccessDenied')) {
                    throw new Error(
                        'Access denied when fetching MSK brokers. Check that your AWS profile has kafka:GetBootstrapBrokers permission.'
                    );
                } else {
                    throw new Error(`Failed to get MSK brokers. Please verify your AWS credentials and cluster ARN.`);
                }
            }
        }

        if (brokers.length === 0) {
            throw new Error(
                connection.type === 'msk'
                    ? 'No brokers available. Check your MSK cluster ARN and AWS credentials.'
                    : 'No brokers available. Please provide broker addresses.'
            );
        }

        // Build Kafka configuration
        const kafkaConfig: any = {
            clientId: `vscode-kafka-${connection.name}`,
            brokers,
            logLevel: logLevel.ERROR,
            // Connection timeouts (matching AWS MSK recommended settings)
            connectionTimeout: 30000, // 30 seconds (socket.connection.setup.timeout.ms)
            requestTimeout: 60000, // 60 seconds (request.timeout.ms)
            // Authentication timeout for SASL
            authenticationTimeout: 30000, // 30 seconds
            retry: {
                initialRetryTime: 1000, // retry.backoff.ms
                retries: 3,
                maxRetryTime: 30000,
                multiplier: 2,
                factor: 0.2
            },
            // Metadata settings
            enforceRequestTimeout: true
        };

        // Configure SSL
        if (connection.securityProtocol.includes('SSL')) {
            // For AWS MSK IAM, use simple SSL: true unless custom certs are provided
            if (connection.saslMechanism === 'AWS_MSK_IAM' &&
                !connection.sslCaFile && !connection.sslCertFile && !connection.sslKeyFile) {
                kafkaConfig.ssl = true;
            } else {
                kafkaConfig.ssl = await this.buildSSLConfig(connection);
            }
        }

        // Configure SASL
        if (connection.securityProtocol.includes('SASL')) {
            kafkaConfig.sasl = await this.buildSASLConfig(connection);
        }

        // Create Kafka instance
        const kafka = new Kafka(kafkaConfig);
        this.kafkaInstances.set(connection.name, kafka);

        // Test connection
        try {
            const admin = kafka.admin();
            await admin.connect();
            this.admins.set(connection.name, admin);
        } catch (error) {
            // Connection failed, but still save the config
            // We'll try to connect later when needed
            console.warn(`Failed to connect to cluster ${connection.name} on startup:`, error);
        }

        // Save configuration (without sensitive data)
        this.saveConfiguration();
    }

    private async getMSKBootstrapBrokers(region: string, clusterArn: string, authMethod?: string, awsProfile?: string): Promise<string[]> {
        try {
            const { KafkaClient, GetBootstrapBrokersCommand } = require('@aws-sdk/client-kafka');

            // NOTE: This uses BASE PROFILE credentials (no role assumption)
            // Most users can list MSK clusters with their base profile
            // Role assumption is only needed for Kafka admin operations (topics/consumer groups)

            let credentials;

            // If a specific profile is provided, read directly from credentials file
            // This completely bypasses AWS SDK environment variable handling
            if (awsProfile) {
                const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');

                try {
                    const credentialsContent = await fs.readFile(credentialsPath, 'utf-8');
                    const credentialsData = ini.parse(credentialsContent);

                    if (credentialsData[awsProfile]) {
                        const profileData = credentialsData[awsProfile];
                        credentials = {
                            accessKeyId: profileData.aws_access_key_id,
                            secretAccessKey: profileData.aws_secret_access_key,
                            sessionToken: profileData.aws_session_token || profileData.aws_security_token
                        };
                    } else {
                        throw new Error('Profile not found in credentials file');
                    }
                } catch (error: any) {
                    console.error('Failed to read AWS credentials file:', error);
                    credentials = undefined;
                }
            }

            // Fallback to environment variables or default profile
            if (!credentials) {
                const credentialProviders = [];
                credentialProviders.push(fromEnv());
                credentialProviders.push(
                    fromIni({
                        filepath: path.join(os.homedir(), '.aws', 'credentials'),
                        configFilepath: path.join(os.homedir(), '.aws', 'config')
                    })
                );

                for (const provider of credentialProviders) {
                    try {
                        credentials = await provider();
                        if (credentials && credentials.accessKeyId) {
                            break;
                        }
                    } catch (_error) {
                        continue;
                    }
                }
            }

            if (!credentials || !credentials.accessKeyId) {
                throw new Error(
                    'Failed to load AWS credentials. Please ensure credentials are configured in ~/.aws/credentials'
                );
            }

            const client = new KafkaClient({
                region,
                credentials
            });

            const response: any = await client.send(new GetBootstrapBrokersCommand({
                ClusterArn: clusterArn
            }));

            // Choose brokers based on auth method
            let brokerString: string | undefined;

            if (authMethod === 'AWS_MSK_IAM' && response.BootstrapBrokerStringSaslIam) {
                brokerString = response.BootstrapBrokerStringSaslIam;
            } else if (authMethod?.includes('SCRAM') && response.BootstrapBrokerStringSaslScram) {
                brokerString = response.BootstrapBrokerStringSaslScram;
            } else if (response.BootstrapBrokerStringTls) {
                brokerString = response.BootstrapBrokerStringTls;
            } else if (response.BootstrapBrokerString) {
                brokerString = response.BootstrapBrokerString;
            }

            if (!brokerString) {
                throw new Error('No bootstrap brokers available for this authentication method');
            }

            return brokerString.split(',');
        } catch (error: any) {
            console.error('MSK bootstrap broker fetch error:', error);
            throw new Error(
                'Failed to get MSK bootstrap brokers. Verify: 1) AWS credentials are valid, 2) Cluster ARN is correct, 3) IAM permissions are configured'
            );
        }
    }

    private async buildSSLConfig(connection: ClusterConnection): Promise<any> {
        const sslConfig: any = {
            rejectUnauthorized: connection.rejectUnauthorized !== false
        };

        if (connection.sslCaFile) {
            sslConfig.ca = [await fs.readFile(connection.sslCaFile, 'utf-8')];
        }

        if (connection.sslCertFile) {
            sslConfig.cert = await fs.readFile(connection.sslCertFile, 'utf-8');
        }

        if (connection.sslKeyFile) {
            sslConfig.key = await fs.readFile(connection.sslKeyFile, 'utf-8');
        }

        // Retrieve SSL password from SecretStorage or use in-memory value
        let sslPassword = connection.sslPassword;
        if (!sslPassword && this.credentialManager) {
            sslPassword = await this.credentialManager.getPassword(connection.name, 'ssl');
        }

        if (sslPassword) {
            sslConfig.passphrase = sslPassword;
        }

        return sslConfig;
    }

    private async buildSASLConfig(connection: ClusterConnection): Promise<SASLOptions | undefined> {
        if (!connection.saslMechanism) {
            return undefined;
        }

        if (connection.saslMechanism === 'AWS_MSK_IAM') {
            // AWS MSK IAM authentication using OAUTHBEARER
            if (!connection.region) {
                throw new Error('Region is required for AWS MSK IAM authentication');
            }

            return createMSKIAMAuthMechanism(connection.region, connection.awsProfile, connection.assumeRoleArn) as any;
        }

        // Standard SASL mechanisms - retrieve password from SecretStorage or use in-memory value
        let saslPassword = connection.saslPassword;
        if (!saslPassword && this.credentialManager) {
            saslPassword = await this.credentialManager.getPassword(connection.name, 'sasl');
        }

        const mechanism = connection.saslMechanism.toLowerCase().replace(/-/g, '-') as any;

        return {
            mechanism,
            username: connection.saslUsername || '',
            password: saslPassword || ''
        };
    }

    /**
     * Builds Kafka configuration from a cluster connection
     * @param connection The cluster connection
     * @param brokers Optional brokers array (if already fetched)
     * @returns Kafka configuration object
     */
    private async buildKafkaConfig(connection: ClusterConnection, brokers?: string[]): Promise<any> {
        // Use provided brokers or fetch from connection
        const brokerList = brokers || connection.brokers || [];

        if (brokerList.length === 0) {
            throw new Error('No brokers available');
        }

        const kafkaConfig: any = {
            clientId: `vscode-kafka-${connection.name}`,
            brokers: brokerList,
            logLevel: logLevel.ERROR,
            connectionTimeout: 30000,
            requestTimeout: 60000,
            authenticationTimeout: 30000,
            retry: {
                initialRetryTime: 1000,
                retries: 3,
                maxRetryTime: 30000,
                multiplier: 2,
                factor: 0.2
            },
            enforceRequestTimeout: true
        };

        // Configure SSL
        if (connection.securityProtocol.includes('SSL')) {
            if (connection.saslMechanism === 'AWS_MSK_IAM' &&
                !connection.sslCaFile && !connection.sslCertFile && !connection.sslKeyFile) {
                kafkaConfig.ssl = true;
            } else {
                kafkaConfig.ssl = await this.buildSSLConfig(connection);
            }
        }

        // Configure SASL
        if (connection.securityProtocol.includes('SASL')) {
            kafkaConfig.sasl = await this.buildSASLConfig(connection);
        }

        return kafkaConfig;
    }

    async removeCluster(name: string) {
        this.logger.info(`Removing cluster: ${name}`);
        
        // Disconnect from connection pool
        await this.connectionPool.disconnect(name);

        // Disconnect admin and producer with proper error handling (fallback for non-pooled connections)
        const admin = this.admins.get(name);
        if (admin) {
            try {
                await admin.disconnect();
            } catch (error) {
                this.logger.error(`Error disconnecting admin for cluster ${name}`, error);
            }
            this.admins.delete(name);
        }

        const producer = this.producers.get(name);
        if (producer) {
            try {
                await producer.disconnect();
            } catch (error) {
                this.logger.error(`Error disconnecting producer for cluster ${name}`, error);
            }
            this.producers.delete(name);
        }

        // Delete stored credentials
        if (this.credentialManager) {
            await this.credentialManager.deleteCredentials(name);
            this.logger.debug(`Deleted credentials for ${name}`);
        }

        this.clusters.delete(name);
        this.kafkaInstances.delete(name);

        this.saveConfiguration();
    }

    getClusters(): string[] {
        return Array.from(this.clusters.keys());
    }

    async getTopics(clusterName: string): Promise<string[]> {
        const admin = await this.getAdmin(clusterName);
        return await admin.listTopics();
    }

    async getTopicMetadata(clusterName: string, topic: string): Promise<any> {
        const admin = await this.getAdmin(clusterName);
        const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
        const topicData = metadata.topics[0];

        // Validate topic metadata
        if (!topicData || !topicData.partitions) {
            throw new Error(`Topic "${topic}" not found or has invalid metadata`);
        }

        return topicData;
    }

    async getTopicDetails(clusterName: string, topicName: string): Promise<any> {
        const admin = await this.getAdmin(clusterName);

        // Fetch topic metadata
        const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });
        const topicMetadata = metadata.topics[0];

        // Validate topic metadata
        if (!topicMetadata || !topicMetadata.partitions || topicMetadata.partitions.length === 0) {
            throw new Error(`Topic "${topicName}" not found or has no partitions`);
        }

        // Fetch topic configuration with all details including synonyms
        const configs = await admin.describeConfigs({
            resources: [
                {
                    type: 2, // TOPIC (ConfigResourceType.TOPIC = 2)
                    name: topicName
                }
            ],
            includeSynonyms: true // Include configuration synonyms to get full details
        });

        // Fetch topic offsets (beginning and end)
        const kafka = this.kafkaInstances.get(clusterName);
        if (!kafka) {
            throw new Error(`Cluster ${clusterName} not found`);
        }

        const consumer = kafka.consumer({ groupId: `vscode-kafka-offsets-${Date.now()}` });

        try {
            await consumer.connect();
            await consumer.subscribe({ topic: topicName, fromBeginning: false });

            const offsetInfo: any = {};

            // Fetch offsets for each partition
            for (const partition of topicMetadata.partitions) {
                const partitionId = partition.partitionId;

                // Get beginning and end offsets using fetchOffsets
                const beginOffset = await admin.fetchTopicOffsets(topicName);
                const partitionOffset = beginOffset.find((p: any) => p.partition === partitionId);

                // Convert Long objects to strings (kafkajs uses 'long' library for 64-bit integers)
                const lowOffset = partitionOffset?.low ? String(partitionOffset.low) : '0';
                const highOffset = partitionOffset?.high ? String(partitionOffset.high) : '0';

                offsetInfo[partitionId] = {
                    partition: partitionId,
                    leader: partition.leader,
                    replicas: partition.replicas,
                    isr: partition.isr,
                    lowWaterMark: lowOffset,
                    highWaterMark: highOffset,
                    messageCount: partitionOffset ?
                        (BigInt(highOffset) - BigInt(lowOffset)).toString() : '0'
                };
            }

            return {
                name: topicName,
                partitions: topicMetadata.partitions.length,
                replicationFactor: topicMetadata.partitions[0]?.replicas?.length || 0,
                partitionDetails: offsetInfo,
                configuration: configs.resources[0]?.configEntries || []
            };
        } finally {
            // Always disconnect consumer, even if an error occurs
            try {
                await consumer.disconnect();
            } catch (error) {
                console.error('Error disconnecting consumer in getTopicDetails:', error);
            }
        }
    }

    async createTopic(
        clusterName: string,
        topic: string,
        numPartitions: number,
        replicationFactor: number
    ) {
        const admin = await this.getAdmin(clusterName);
        try {
            const result = await admin.createTopics({
                topics: [
                    {
                        topic,
                        numPartitions,
                        replicationFactor
                    }
                ],
                waitForLeaders: true,
                timeout: 5000
            });

            if (!result) {
                throw new Error('Topic creation returned false - topic may already exist or broker rejected the request');
            }
        } catch (error: any) {
            // Extract more detailed error information
            if (error.message) {
                throw new Error(error.message);
            }
            if (error.errors) {
                const errorMessages = error.errors.map((e: any) =>
                    `${e.topic || topic}: ${e.error || e.message || JSON.stringify(e)}`
                ).join(', ');
                throw new Error(errorMessages);
            }
            throw error;
        }
    }

    async deleteTopic(clusterName: string, topic: string) {
        const admin = await this.getAdmin(clusterName);
        await admin.deleteTopics({
            topics: [topic]
        });
    }

    async produceMessage(
        clusterName: string,
        topic: string,
        key: string | undefined,
        value: string
    ) {
        const producer = await this.getProducer(clusterName);

        await producer.send({
            topic,
            messages: [
                {
                    key: key ? Buffer.from(key) : undefined,
                    value: Buffer.from(value)
                }
            ]
        });
    }

    async consumeMessages(
        clusterName: string,
        topic: string,
        fromBeginning: boolean,
        limit: number,
        cancellationToken?: vscode.CancellationToken,
        onMessage?: (message: any, count: number) => void
    ): Promise<any[]> {
        const kafka = this.kafkaInstances.get(clusterName);
        if (!kafka) {
            throw new Error(`Cluster ${clusterName} not found`);
        }

        const consumer = kafka.consumer({
            groupId: `vscode-kafka-consumer-${Date.now()}`
        });

        try {
            await consumer.connect();
            await consumer.subscribe({ topic, fromBeginning });

            const messages: any[] = [];
            let isDisconnected = false;

            return await new Promise((resolve, reject) => {
                const disconnect = async () => {
                    if (!isDisconnected) {
                        isDisconnected = true;
                        try {
                            await consumer.disconnect();
                        } catch (err) {
                            console.error('Error disconnecting consumer:', err);
                        }
                    }
                };

                if (cancellationToken) {
                    cancellationToken.onCancellationRequested(async () => {
                        await disconnect();
                        resolve(messages);
                    });
                }

                consumer.run({
                    eachMessage: async ({ topic, partition, message }) => {
                        const msg = { topic, partition, ...message };
                        messages.push(msg);

                        // Call the callback for real-time streaming
                        if (onMessage) {
                            onMessage(msg, messages.length);
                        }

                        if (messages.length >= limit) {
                            await disconnect();
                            resolve(messages);
                        }
                    }
                }).catch(async (error) => {
                    await disconnect();
                    reject(error);
                });

                // Timeout after 30 seconds
                setTimeout(async () => {
                    await disconnect();
                    resolve(messages);
                }, 30000);
            });
        } catch (error) {
            // Ensure consumer is disconnected even if connection/subscription fails
            try {
                await consumer.disconnect();
            } catch (disconnectError) {
                console.error('Error disconnecting consumer after failure:', disconnectError);
            }
            throw error;
        }
    }

    async getConsumerGroups(clusterName: string): Promise<any[]> {
        const admin = await this.getAdmin(clusterName);
        const groupsList = await admin.listGroups();

        // Fetch detailed information including state for each group
        if (groupsList.groups.length === 0) {
            return [];
        }

        try {
            const groupIds = groupsList.groups.map((g: any) => g.groupId);
            const descriptions = await admin.describeGroups(groupIds);

            // Return groups with state information
            return descriptions.groups.map((group: any) => ({
                groupId: group.groupId,
                state: group.state,
                protocolType: group.protocolType,
                protocol: group.protocol,
                members: group.members
            }));
        } catch (error) {
            console.error('Error fetching consumer group states:', error);
            // Fallback to basic group list if describe fails
            return groupsList.groups.map((g: any) => ({
                groupId: g.groupId,
                state: 'Unknown',
                protocolType: g.protocolType
            }));
        }
    }

    async deleteConsumerGroup(clusterName: string, groupId: string) {
        const admin = await this.getAdmin(clusterName);
        await admin.deleteGroups([groupId]);
    }

    async resetConsumerGroupOffsets(
        clusterName: string,
        groupId: string,
        topic?: string,
        resetTo: string = 'beginning',
        specificOffset?: string
    ) {
        const admin = await this.getAdmin(clusterName);

        // Get topics for the consumer group if not specified
        let topics: string[] = [];
        if (topic) {
            topics = [topic];
        } else {
            const offsets = await admin.fetchOffsets({ groupId });
            topics = [...new Set(offsets.map((o: any) => o.topic))];
        }

        // Build reset spec for each topic
        const resetSpec: any = {
            groupId,
            topics: []
        };

        for (const topicName of topics) {
            const topicOffsets = await admin.fetchTopicOffsets(topicName);
            const partitions = topicOffsets.map((p: any) => {
                let offset: string;

                if (resetTo === 'beginning') {
                    offset = p.low;
                } else if (resetTo === 'end') {
                    offset = p.high;
                } else if (resetTo === 'specific offset' && specificOffset) {
                    offset = specificOffset;
                } else {
                    offset = p.low; // default to beginning
                }

                return {
                    partition: p.partition,
                    offset
                };
            });

            resetSpec.topics.push({
                topic: topicName,
                partitions
            });
        }

        await admin.resetOffsets(resetSpec);
    }

    async getConsumerGroupDetails(clusterName: string, groupId: string): Promise<any> {
        const admin = await this.getAdmin(clusterName);

        try {
            const description = await admin.describeGroups([groupId]);
            const offsets = await admin.fetchOffsets({ groupId });
            const group = description.groups[0];

            // Calculate lag for each topic/partition
            const lagInfo: any[] = [];

            for (const topicOffsets of offsets) {
                const topic = topicOffsets.topic;

                // Fetch topic offsets to get high water marks
                try {
                    const topicHighWaterMarks = await admin.fetchTopicOffsets(topic);

                    for (const partitionOffset of topicOffsets.partitions) {
                        const partition = partitionOffset.partition;
                        const currentOffset = partitionOffset.offset;

                        // Find the high water mark for this partition
                        const hwm = topicHighWaterMarks.find((p: any) => p.partition === partition);
                        const highWaterMark = hwm ? BigInt(hwm.high) : BigInt(0);
                        const current = BigInt(currentOffset);
                        const lag = Number(highWaterMark - current);

                        lagInfo.push({
                            topic,
                            partition,
                            currentOffset: currentOffset.toString(),
                            highWaterMark: highWaterMark.toString(),
                            lag: Math.max(0, lag),
                            metadata: partitionOffset.metadata
                        });
                    }
                } catch (error) {
                    console.error(`Failed to get lag for ${topic}`, error);
                }
            }

            return {
                groupId: group.groupId,
                state: group.state,
                protocolType: group.protocolType,
                protocol: group.protocol,
                members: group.members.map((member: any) => ({
                    memberId: member.memberId,
                    clientId: member.clientId,
                    clientHost: member.clientHost,
                    assignments: member.memberAssignment
                })),
                offsets: lagInfo,
                totalLag: lagInfo.reduce((sum, info) => sum + info.lag, 0)
            };
        } catch (error) {
            console.error('Error getting consumer group details:', error);
            throw error;
        }
    }

    async getBrokers(clusterName: string): Promise<any[]> {
        const admin = await this.getAdmin(clusterName);
        const cluster = await admin.describeCluster();

        return cluster.brokers.map((broker: any) => ({
            nodeId: broker.nodeId,
            host: broker.host,
            port: broker.port,
            rack: (broker as any).rack || null
        }));
    }

    async getBrokerDetails(clusterName: string, brokerId: number): Promise<any> {
        const admin = await this.getAdmin(clusterName);

        // Get cluster info
        const cluster = await admin.describeCluster();
        const broker = cluster.brokers.find((b: any) => b.nodeId === brokerId);

        if (!broker) {
            throw new Error(`Broker ${brokerId} not found`);
        }

        // Fetch broker configuration with all details including synonyms
        const configs = await admin.describeConfigs({
            resources: [
                {
                    type: 4, // BROKER (ConfigResourceType.BROKER = 4)
                    name: brokerId.toString()
                }
            ],
            includeSynonyms: true // Include configuration synonyms to get full details
        });

        return {
            nodeId: broker.nodeId,
            host: broker.host,
            port: broker.port,
            rack: (broker as any).rack || 'N/A',
            configuration: configs.resources[0]?.configEntries || []
        };
    }

    async getClusterStatistics(clusterName: string): Promise<any> {
        const admin = await this.getAdmin(clusterName);

        // Get cluster metadata
        const cluster = await admin.describeCluster();
        const topics = await admin.listTopics();

        // Calculate total partitions
        let totalPartitions = 0;
        for (const topic of topics) {
            try {
                const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
                totalPartitions += metadata.topics[0]?.partitions?.length || 0;
            } catch (_error) {
                // Skip topics we can't access
                continue;
            }
        }

        return {
            clusterId: cluster.clusterId,
            controller: cluster.controller,
            brokerCount: cluster.brokers.length,
            topicCount: topics.length,
            totalPartitions
        };
    }

    private async getAdmin(clusterName: string): Promise<Admin> {
        const connection = this.clusters.get(clusterName);
        if (!connection) {
            throw new Error(`Cluster ${clusterName} not found`);
        }

        try {
            // Use connection pool for better resource management
            const kafkaConfig = await this.buildKafkaConfig(connection);
            
            const { admin } = await this.connectionPool.get(
                clusterName,
                () => new Kafka(kafkaConfig) // Factory function that creates Kafka instance
            );
            
            return admin;
        } catch (error: any) {
            this.logger.error(`Failed to connect to cluster ${clusterName}`, error);
            throw new Error(
                `Failed to connect to Kafka cluster: ${error?.message || 'Unknown error'}. Please check that the brokers are accessible and your credentials are valid.`
            );
        }
    }

    private async getProducer(clusterName: string): Promise<Producer> {
        const connection = this.clusters.get(clusterName);
        if (!connection) {
            throw new Error(`Cluster ${clusterName} not found`);
        }

        try {
            // Use connection pool for better resource management
            const kafkaConfig = await this.buildKafkaConfig(connection);
            
            const { producer } = await this.connectionPool.get(
                clusterName,
                () => new Kafka(kafkaConfig) // Factory function that creates Kafka instance
            );
            
            return producer;
        } catch (error: any) {
            this.logger.error(`Failed to get producer for cluster ${clusterName}`, error);
            throw new Error(
                `Failed to connect to Kafka producer: ${error?.message || 'Unknown error'}.`
            );
        }
    }

    private saveConfiguration() {
        const config = vscode.workspace.getConfiguration('kafka');
        const clusters = Array.from(this.clusters.values()).map(c => {
            const clusterConfig: any = {
                name: c.name,
                type: c.type,
                brokers: c.brokers,
                securityProtocol: c.securityProtocol
            };

            // Save MSK-specific configuration (needed for reconnection)
            if (c.type === 'msk') {
                clusterConfig.region = c.region;
                clusterConfig.clusterArn = c.clusterArn;
                clusterConfig.awsProfile = c.awsProfile;
                clusterConfig.assumeRoleArn = c.assumeRoleArn;
                clusterConfig.saslMechanism = c.saslMechanism;
            }

            // Save SASL mechanism for non-MSK clusters (but not credentials)
            if (c.saslMechanism && c.type !== 'msk') {
                clusterConfig.saslMechanism = c.saslMechanism;
                // Note: We don't save username/password for security
            }

            // Save SSL file paths (not the actual certificates)
            if (c.sslCaFile || c.sslCertFile || c.sslKeyFile) {
                clusterConfig.sslCaFile = c.sslCaFile;
                clusterConfig.sslCertFile = c.sslCertFile;
                clusterConfig.sslKeyFile = c.sslKeyFile;
                clusterConfig.rejectUnauthorized = c.rejectUnauthorized;
            }

            return clusterConfig;
        });
        config.update('clusters', clusters, vscode.ConfigurationTarget.Global);
    }

    async loadConfiguration() {
        const config = vscode.workspace.getConfiguration('kafka');
        const clusters = config.get<any[]>('clusters', []);

        const failedClusters: { name: string; reason: string }[] = [];

        for (const cluster of clusters) {
            // Validate cluster configuration
            if (!this.validateClusterConfig(cluster)) {
                console.error(`Invalid cluster configuration for "${cluster.name}"`);
                failedClusters.push({
                    name: cluster.name || 'Unknown',
                    reason: 'Invalid configuration (missing required fields)'
                });
                continue;
            }

            try {
                // Reconstruct the full cluster connection from saved config
                const connection: ClusterConnection = {
                    name: cluster.name,
                    type: cluster.type || 'kafka',
                    brokers: cluster.brokers || [],
                    securityProtocol: cluster.securityProtocol || 'PLAINTEXT',

                    // MSK-specific fields
                    region: cluster.region,
                    clusterArn: cluster.clusterArn,
                    awsProfile: cluster.awsProfile,
                    assumeRoleArn: cluster.assumeRoleArn,

                    // SASL fields
                    saslMechanism: cluster.saslMechanism,
                    // Note: We don't save passwords, so SASL clusters will need re-authentication

                    // SSL fields
                    sslCaFile: cluster.sslCaFile,
                    sslCertFile: cluster.sslCertFile,
                    sslKeyFile: cluster.sslKeyFile,
                    rejectUnauthorized: cluster.rejectUnauthorized
                };

                // Use the same method as adding a new cluster to ensure consistency
                await this.addClusterFromConnection(connection);

            } catch (error: any) {
                console.error(`Failed to load cluster ${cluster.name}:`, error);

                // Determine the reason for failure
                let reason = 'Unknown error';
                const errorMsg = error?.message || error.toString();

                if (errorMsg.includes('expired') || errorMsg.includes('credentials')) {
                    reason = 'AWS credentials expired or invalid';
                } else if (errorMsg.includes('brokers')) {
                    reason = 'Failed to fetch brokers';
                } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
                    reason = 'Network connection failed';
                } else {
                    reason = errorMsg.substring(0, 100);
                }

                failedClusters.push({ name: cluster.name, reason });
            }
        }

        // Show notification if any clusters failed to load
        if (failedClusters.length > 0) {
            const clusterList = failedClusters.map(c => `• ${c.name}: ${c.reason}`).join('\n');

            vscode.window.showErrorMessage(
                `Failed to reconnect ${failedClusters.length} cluster(s):\n${clusterList}`,
                'Retry', 'Remove Failed Clusters'
            ).then(async selection => {
                if (selection === 'Retry') {
                    await this.loadConfiguration();
                } else if (selection === 'Remove Failed Clusters') {
                    // Remove failed clusters from config
                    const successfulClusters = clusters.filter(c =>
                        !failedClusters.find(fc => fc.name === c.name)
                    );
                    config.update('clusters', successfulClusters, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Failed clusters removed from configuration');
                }
            });
        }
    }

    /**
     * Validates cluster configuration to prevent extension crashes from manually edited settings
     */
    private validateClusterConfig(cluster: any): boolean {
        // Must have a name
        if (!cluster.name || typeof cluster.name !== 'string') {
            return false;
        }

        // Must have a valid type
        if (!cluster.type || (cluster.type !== 'kafka' && cluster.type !== 'msk')) {
            return false;
        }

        // For MSK clusters, must have region and clusterArn
        if (cluster.type === 'msk') {
            if (!cluster.region || !cluster.clusterArn) {
                return false;
            }
        }

        // For regular Kafka clusters, must have brokers
        if (cluster.type === 'kafka') {
            if (!cluster.brokers || !Array.isArray(cluster.brokers) || cluster.brokers.length === 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Dispose of all Kafka connections and clean up resources
     * This should be called when the extension is deactivated
     */
    async dispose(): Promise<void> {
        this.logger.info('Disposing Kafka client manager...');

        // Dispose connection pool (handles all connections)
        try {
            await this.connectionPool.dispose();
        } catch (error) {
            this.logger.error('Failed to dispose connection pool', error);
        }

        // Disconnect all admin clients (legacy)
        for (const [name, admin] of this.admins.entries()) {
            try {
                this.logger.debug(`Disconnecting admin for cluster: ${name}`);
                await admin.disconnect();
            } catch (error) {
                this.logger.error(`Failed to disconnect admin for ${name}`, error);
            }
        }
        this.admins.clear();

        // Disconnect all producers (legacy)
        for (const [name, producer] of this.producers.entries()) {
            try {
                this.logger.debug(`Disconnecting producer for cluster: ${name}`);
                await producer.disconnect();
            } catch (error) {
                this.logger.error(`Failed to disconnect producer for ${name}`, error);
            }
        }
        this.producers.clear();

        // Clear other maps
        this.kafkaInstances.clear();
        this.clusters.clear();

        this.logger.info('Kafka client manager disposed successfully');
    }
}
