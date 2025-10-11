import {
    Kafka,
    Admin,
    Producer,
    Consumer,
    SASLOptions,
    logLevel,
    AclResourceTypes,
    AclOperationTypes,
    AclPermissionTypes,
    ResourcePatternTypes
} from 'kafkajs';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { ClusterConnection } from '../forms/clusterConnectionForm';
import { createMSKIAMAuthMechanism } from './mskIamAuthenticator';
import { Logger } from '../infrastructure/Logger';
import { ConnectionPool } from '../infrastructure/ConnectionPool';
import { CredentialManager } from '../infrastructure/CredentialManager';
import { ConfigurationService } from '../infrastructure/ConfigurationService';
import { MSKAdapter } from './adapters/MSKAdapter';
import { TopicService } from '../services/TopicService';
import { ConsumerGroupService } from '../services/ConsumerGroupService';
import { BrokerService } from '../services/BrokerService';
import { ProducerService } from '../services/ProducerService';
import { ACL, ACLDetails, ACLConfig } from '../types/acl';
import { ACLTypeMapper } from '../utils/aclTypeMapper';
import { KafkaErrorClassifier } from '../utils/kafkaErrorClassifier';

// Type alias for cluster configuration
type ClusterConfig = ClusterConnection;

export class KafkaClientManager {
    private logger = Logger.getLogger('KafkaClientManager');
    private clusters: Map<string, ClusterConfig> = new Map();
    private kafkaInstances: Map<string, Kafka> = new Map();
    private admins: Map<string, Admin> = new Map();
    private producers: Map<string, Producer> = new Map();
    private consumers: Map<string, Consumer> = new Map();
    private connectionPool: ConnectionPool;
    private configurationService: ConfigurationService;
    private mskAdapter: MSKAdapter;

    // Service layer
    private topicService: TopicService;
    private consumerGroupService: ConsumerGroupService;
    private brokerService: BrokerService;
    private producerService: ProducerService;

    constructor(private credentialManager?: CredentialManager) {
        this.logger.info('Initializing Kafka Client Manager');
        this.connectionPool = new ConnectionPool();
        this.configurationService = new ConfigurationService();
        this.mskAdapter = new MSKAdapter();

        // Initialize services
        this.topicService = new TopicService();
        this.consumerGroupService = new ConsumerGroupService();
        this.brokerService = new BrokerService();
        this.producerService = new ProducerService();
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

        // Handle MSK clusters - fetch bootstrap brokers using MSKAdapter
        let brokers = connection.brokers || [];
        // Only fetch from AWS if brokers are not already cached
        // This allows TLS connections to work without AWS credentials after initial setup
        if (connection.type === 'msk' && connection.clusterArn && connection.region && brokers.length === 0) {
            this.logger.debug(`Fetching MSK brokers for ${connection.name} from AWS API`);
            brokers = await this.mskAdapter.getBootstrapBrokers(
                connection.region,
                connection.clusterArn,
                connection.saslMechanism,
                connection.awsProfile
            );
            this.logger.debug(`Fetched ${brokers.length} MSK brokers for ${connection.name}`);
            // Cache the brokers in the connection object to avoid re-fetching from AWS
            // This is important for TLS connections where AWS credentials are only needed once
            connection.brokers = brokers;
            // Save the updated configuration with cached brokers
            this.saveConfiguration();
        } else if (connection.type === 'msk' && brokers.length > 0) {
            this.logger.debug(`Using ${brokers.length} cached MSK brokers for ${connection.name}`);
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

        // Save configuration using ConfigurationService
        this.saveConfiguration();
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

        // Convert mechanism to lowercase (KafkaJS expects lowercase mechanism names)
        const mechanism = connection.saslMechanism.toLowerCase() as any;

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
        return await this.topicService.getTopics(admin);
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
        return await this.topicService.createTopic(admin, topic, numPartitions, replicationFactor);
    }

    async deleteTopic(clusterName: string, topic: string) {
        const admin = await this.getAdmin(clusterName);
        return await this.topicService.deleteTopic(admin, topic);
    }

    async produceMessage(
        clusterName: string,
        topic: string,
        key: string | undefined,
        value: string
    ) {
        const producer = await this.getProducer(clusterName);
        return await this.producerService.sendMessage(producer, topic, key, value);
    }

    /**
     * Produce advanced messages with full KafkaJS options support (headers, partition, etc.)
     */
    async produceAdvancedMessages(
        clusterName: string,
        topic: string,
        messages: Array<{
            key?: string | Buffer;
            value: string | Buffer;
            partition?: number;
            headers?: Record<string, string | Buffer>;
            timestamp?: string;
        }>
    ) {
        const producer = await this.getProducer(clusterName);

        try {
            this.logger.debug(`Sending ${messages.length} advanced message(s) to topic: ${topic}`);

            await producer.send({
                topic,
                messages: messages.map(msg => ({
                    key: msg.key,
                    value: msg.value,
                    partition: msg.partition,
                    headers: msg.headers,
                    timestamp: msg.timestamp
                }))
            });

            this.logger.info(`Successfully sent ${messages.length} message(s) to topic: ${topic}`);
        } catch (error: any) {
            this.logger.error(`Failed to send messages to topic: ${topic}`, error);
            throw error;
        }
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
        return await this.consumerGroupService.getConsumerGroups(admin);
    }

    async deleteConsumerGroup(clusterName: string, groupId: string) {
        const admin = await this.getAdmin(clusterName);
        return await this.consumerGroupService.deleteConsumerGroup(admin, groupId);
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
        return await this.brokerService.getBrokers(admin);
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

    async getACLs(clusterName: string): Promise<ACL[]> {
        this.logger.debug(`Fetching ACLs for cluster ${clusterName}`);
        const admin = await this.getAdmin(clusterName);

        try {
            // Query all ACLs using KafkaJS admin API
            const result = await admin.describeAcls({
                resourceType: AclResourceTypes.ANY,
                resourceName: undefined,
                resourcePatternType: ResourcePatternTypes.ANY,
                principal: undefined,
                host: undefined,
                operation: AclOperationTypes.ANY,
                permissionType: AclPermissionTypes.ANY
            });

            // Transform KafkaJS format to extension format
            const acls: ACL[] = [];
            for (const resource of result.resources) {
                for (const acl of resource.acls) {
                    acls.push({
                        resourceType: ACLTypeMapper.fromKafkaJSResourceType(resource.resourceType) as any,
                        resourceName: resource.resourceName,
                        resourcePatternType: ACLTypeMapper.fromKafkaJSPatternType(resource.resourcePatternType),
                        principal: acl.principal,
                        host: acl.host,
                        operation: ACLTypeMapper.fromKafkaJSOperation(acl.operation),
                        permissionType: ACLTypeMapper.fromKafkaJSPermission(acl.permissionType) as any
                    });
                }
            }

            this.logger.info(`Retrieved ${acls.length} ACLs for cluster ${clusterName}`);
            return acls;
        } catch (error: any) {
            // Use centralized error classification
            const logLevel = KafkaErrorClassifier.getLogLevel(error);
            const message = KafkaErrorClassifier.getUserFriendlyMessage(error, `Cluster ${clusterName}`);

            if (logLevel === 'warn') {
                this.logger.warn(message);
            } else {
                this.logger.error(message, error);
            }
            throw error;
        }
    }

    async createACL(clusterName: string, aclConfig: ACLConfig): Promise<void> {
        this.logger.debug(`Creating ACL for cluster ${clusterName}`, aclConfig);
        const admin = await this.getAdmin(clusterName);

        try {
            await admin.createAcls({
                acl: [{
                    resourceType: ACLTypeMapper.toKafkaJSResourceType(aclConfig.resourceType),
                    resourceName: aclConfig.resourceName,
                    resourcePatternType: ACLTypeMapper.toKafkaJSPatternType(aclConfig.resourcePatternType || 'LITERAL'),
                    principal: aclConfig.principal,
                    host: aclConfig.host || '*',
                    operation: ACLTypeMapper.toKafkaJSOperation(aclConfig.operation),
                    permissionType: ACLTypeMapper.toKafkaJSPermission(aclConfig.permissionType)
                }]
            });

            this.logger.info(`Successfully created ACL for cluster ${clusterName}`);
        } catch (error: any) {
            // Use centralized error classification
            const logLevel = KafkaErrorClassifier.getLogLevel(error);
            const message = KafkaErrorClassifier.getUserFriendlyMessage(error, `Create ACL on ${clusterName}`);

            if (logLevel === 'warn') {
                this.logger.warn(message);
            } else {
                this.logger.error(message, error);
            }
            throw error;
        }
    }

    async deleteACL(clusterName: string, aclConfig: Omit<ACLConfig, 'permissionType'>): Promise<void> {
        this.logger.debug(`Deleting ACL for cluster ${clusterName}`, aclConfig);
        const admin = await this.getAdmin(clusterName);

        try {
            const result = await admin.deleteAcls({
                filters: [{
                    resourceType: ACLTypeMapper.toKafkaJSResourceType(aclConfig.resourceType),
                    resourceName: aclConfig.resourceName,
                    resourcePatternType: ACLTypeMapper.toKafkaJSPatternType(aclConfig.resourcePatternType || 'LITERAL'),
                    principal: aclConfig.principal,
                    host: aclConfig.host || '*',
                    operation: ACLTypeMapper.toKafkaJSOperation(aclConfig.operation),
                    permissionType: AclPermissionTypes.ANY // Delete both ALLOW and DENY
                }]
            });

            const deletedCount = result.filterResponses.reduce((sum, response) =>
                sum + (response.matchingAcls?.length || 0), 0);

            this.logger.info(`Successfully deleted ${deletedCount} ACL(s) for cluster ${clusterName}`);
        } catch (error: any) {
            // Use centralized error classification
            const logLevel = KafkaErrorClassifier.getLogLevel(error);
            const message = KafkaErrorClassifier.getUserFriendlyMessage(error, `Delete ACL on ${clusterName}`);

            if (logLevel === 'warn') {
                this.logger.warn(message);
            } else {
                this.logger.error(message, error);
            }
            throw error;
        }
    }

    async getACLDetails(clusterName: string, acl: ACL): Promise<ACLDetails> {
        // Return detailed ACL information
        return {
            principal: acl.principal || 'Unknown',
            operation: acl.operation || 'Unknown',
            resourceType: acl.resourceType || 'Unknown',
            resourceName: acl.resourceName || 'Unknown',
            permissionType: acl.permissionType || 'Unknown',
            host: acl.host || '*',
            resourcePatternType: acl.resourcePatternType || 'LITERAL',
            description: this.getACLDescription(acl)
        };
    }

    async getTopicACLs(clusterName: string, topicName: string): Promise<ACL[]> {
        try {
            const allACLs = await this.getACLs(clusterName);
            // Filter ACLs for this specific topic
            return allACLs.filter(acl =>
                acl.resourceType === 'topic' &&
                (acl.resourceName === topicName || acl.resourceName === '*')
            );
        } catch (error: any) {
            // If ACLs aren't available (e.g., CLI tool not available), return empty array
            // This allows the UI to gracefully handle missing ACL support
            this.logger.debug(`ACLs not available for topic ${topicName}: ${error?.message}`);
            return [];
        }
    }

    private getACLDescription(acl: ACL): string {
        const principal = acl.principal || 'Unknown';
        const operation = acl.operation || 'Unknown';
        const resource = acl.resourceName || 'Unknown';
        const permission = acl.permissionType || 'Unknown';
        const host = acl.host || '*';

        return `Principal ${principal} is ${permission}ed to ${operation} on ${resource} from host ${host}`;
    }

    private async getAdmin(clusterName: string): Promise<Admin> {
        const connection = this.clusters.get(clusterName);
        if (!connection) {
            throw new Error(`Cluster ${clusterName} not found`);
        }

        try {
            // For MSK clusters, fetch brokers if not already cached
            // Note: For TLS connections (non-IAM), brokers are cached after initial fetch
            // and AWS credentials are not needed for subsequent connections
            let brokers = connection.brokers || [];
            if (connection.type === 'msk' && connection.clusterArn && connection.region && brokers.length === 0) {
                this.logger.debug(`Fetching MSK brokers for ${clusterName} (not cached)`);
                brokers = await this.mskAdapter.getBootstrapBrokers(
                    connection.region,
                    connection.clusterArn,
                    connection.saslMechanism,
                    connection.awsProfile
                );
                // Cache the brokers to avoid re-fetching from AWS
                connection.brokers = brokers;
            }

            // Use connection pool for better resource management
            const kafkaConfig = await this.buildKafkaConfig(connection, brokers);

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
            // For MSK clusters, fetch brokers if not already cached
            // Note: For TLS connections (non-IAM), brokers are cached after initial fetch
            // and AWS credentials are not needed for subsequent connections
            let brokers = connection.brokers || [];
            if (connection.type === 'msk' && connection.clusterArn && connection.region && brokers.length === 0) {
                this.logger.debug(`Fetching MSK brokers for ${clusterName} (not cached)`);
                brokers = await this.mskAdapter.getBootstrapBrokers(
                    connection.region,
                    connection.clusterArn,
                    connection.saslMechanism,
                    connection.awsProfile
                );
                // Cache the brokers to avoid re-fetching from AWS
                connection.brokers = brokers;
            }

            // Use connection pool for better resource management
            const kafkaConfig = await this.buildKafkaConfig(connection, brokers);

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

    /**
     * Get or create a consumer for the specified cluster
     * Each cluster can have its own consumer instance
     */
    async getConsumer(clusterName: string, groupId?: string): Promise<Consumer> {
        const consumerKey = `${clusterName}-${groupId || 'default'}`;

        // Return existing consumer if available
        if (this.consumers.has(consumerKey)) {
            return this.consumers.get(consumerKey)!;
        }

        const connection = this.clusters.get(clusterName);
        if (!connection) {
            throw new Error(`Cluster ${clusterName} not found`);
        }

        try {
            // For MSK clusters, fetch brokers if not already cached
            let brokers = connection.brokers || [];
            if (connection.type === 'msk' && connection.clusterArn && connection.region && brokers.length === 0) {
                this.logger.debug(`Fetching MSK brokers for ${clusterName} (not cached)`);
                brokers = await this.mskAdapter.getBootstrapBrokers(
                    connection.region,
                    connection.clusterArn,
                    connection.saslMechanism,
                    connection.awsProfile
                );
                // Cache the brokers to avoid re-fetching from AWS
                connection.brokers = brokers;
            }

            // Build Kafka configuration
            const kafkaConfig = await this.buildKafkaConfig(connection, brokers);
            const kafka = new Kafka(kafkaConfig);

            // Create consumer with unique group ID
            const consumer = kafka.consumer({
                groupId: groupId || `vscode-kafka-client-${Date.now()}`,
                // Use earliest to allow reading from beginning
                sessionTimeout: 30000,
                heartbeatInterval: 3000
            });

            // Connect the consumer
            await consumer.connect();
            this.logger.info(`Consumer connected for cluster ${clusterName} with group ${groupId || 'default'}`);

            // Cache the consumer
            this.consumers.set(consumerKey, consumer);

            return consumer;
        } catch (error: any) {
            this.logger.error(`Failed to get consumer for cluster ${clusterName}`, error);
            throw new Error(
                `Failed to connect to Kafka consumer: ${error?.message || 'Unknown error'}.`
            );
        }
    }

    /**
     * Disconnect and remove a consumer for the specified cluster
     */
    async disconnectConsumer(clusterName: string, groupId?: string): Promise<void> {
        const consumerKey = `${clusterName}-${groupId || 'default'}`;
        const consumer = this.consumers.get(consumerKey);

        if (consumer) {
            try {
                await consumer.disconnect();
                this.consumers.delete(consumerKey);
                this.logger.info(`Consumer disconnected for cluster ${clusterName}`);
            } catch (error: any) {
                this.logger.error(`Error disconnecting consumer for cluster ${clusterName}`, error);
            }
        }
    }

    private saveConfiguration() {
        const clusters = Array.from(this.clusters.values());
        this.configurationService.save(clusters);
    }

    async loadConfiguration() {
        const clusters = await this.configurationService.load();

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
                // Log the error using the logger instead of console
                this.logger.error(`Failed to load cluster ${cluster.name}`, error);

                // Determine the reason for failure
                const errorMsg = error?.message || error.toString();

                let reason: string;
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
                    // Remove failed clusters from config using ConfigurationService
                    const successfulClusters = clusters.filter(c =>
                        !failedClusters.find(fc => fc.name === c.name)
                    );
                    this.configurationService.save(successfulClusters);
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
