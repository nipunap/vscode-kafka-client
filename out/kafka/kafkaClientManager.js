"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaClientManager = void 0;
const kafkajs_1 = require("kafkajs");
const vscode = __importStar(require("vscode"));
const fs_1 = require("fs");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const ini = __importStar(require("ini"));
const credential_providers_1 = require("@aws-sdk/credential-providers");
const mskIamAuthenticator_1 = require("./mskIamAuthenticator");
class KafkaClientManager {
    constructor() {
        this.clusters = new Map();
        this.kafkaInstances = new Map();
        this.admins = new Map();
        this.producers = new Map();
    }
    async addCluster(name, brokers, sasl) {
        // Legacy method for backward compatibility
        const connection = {
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
    async addClusterFromConnection(connection) {
        this.clusters.set(connection.name, connection);
        // Handle MSK clusters - fetch bootstrap brokers
        let brokers = connection.brokers || [];
        if (connection.type === 'msk' && connection.clusterArn && connection.region) {
            try {
                brokers = await this.getMSKBootstrapBrokers(connection.region, connection.clusterArn, connection.saslMechanism, connection.awsProfile);
            }
            catch (error) {
                const errorMsg = error?.message || error.toString();
                if (errorMsg.includes('expired') || errorMsg.includes('ExpiredToken')) {
                    throw new Error('AWS credentials expired. Please refresh your credentials and try again.');
                }
                else if (errorMsg.includes('AccessDenied')) {
                    throw new Error('Access denied when fetching MSK brokers. Check that your AWS profile has kafka:GetBootstrapBrokers permission.');
                }
                else {
                    throw new Error(`Failed to get MSK brokers. Please verify your AWS credentials and cluster ARN.`);
                }
            }
        }
        if (brokers.length === 0) {
            throw new Error(connection.type === 'msk'
                ? 'No brokers available. Check your MSK cluster ARN and AWS credentials.'
                : 'No brokers available. Please provide broker addresses.');
        }
        // Build Kafka configuration
        const kafkaConfig = {
            clientId: `vscode-kafka-${connection.name}`,
            brokers,
            logLevel: kafkajs_1.logLevel.ERROR,
            retry: {
                initialRetryTime: 300,
                retries: 3
            }
        };
        // Configure SSL
        if (connection.securityProtocol.includes('SSL')) {
            kafkaConfig.ssl = await this.buildSSLConfig(connection);
        }
        // Configure SASL
        if (connection.securityProtocol.includes('SASL')) {
            kafkaConfig.sasl = await this.buildSASLConfig(connection);
        }
        // Create Kafka instance
        const kafka = new kafkajs_1.Kafka(kafkaConfig);
        this.kafkaInstances.set(connection.name, kafka);
        // Test connection
        try {
            const admin = kafka.admin();
            await admin.connect();
            this.admins.set(connection.name, admin);
        }
        catch (error) {
            // Connection failed, but still save the config
            // We'll try to connect later when needed
            console.warn(`Failed to connect to cluster ${connection.name} on startup:`, error);
        }
        // Save configuration (without sensitive data)
        this.saveConfiguration();
    }
    async getMSKBootstrapBrokers(region, clusterArn, authMethod, awsProfile) {
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
                    const credentialsContent = await fs_1.promises.readFile(credentialsPath, 'utf-8');
                    const credentialsData = ini.parse(credentialsContent);
                    if (credentialsData[awsProfile]) {
                        const profileData = credentialsData[awsProfile];
                        credentials = {
                            accessKeyId: profileData.aws_access_key_id,
                            secretAccessKey: profileData.aws_secret_access_key,
                            sessionToken: profileData.aws_session_token || profileData.aws_security_token
                        };
                    }
                    else {
                        throw new Error('Profile not found in credentials file');
                    }
                }
                catch (error) {
                    console.error('Failed to read AWS credentials file:', error);
                    credentials = undefined;
                }
            }
            // Fallback to environment variables or default profile
            if (!credentials) {
                const credentialProviders = [];
                credentialProviders.push((0, credential_providers_1.fromEnv)());
                credentialProviders.push((0, credential_providers_1.fromIni)({
                    filepath: path.join(os.homedir(), '.aws', 'credentials'),
                    configFilepath: path.join(os.homedir(), '.aws', 'config')
                }));
                for (const provider of credentialProviders) {
                    try {
                        credentials = await provider();
                        if (credentials && credentials.accessKeyId) {
                            break;
                        }
                    }
                    catch (error) {
                        continue;
                    }
                }
            }
            if (!credentials || !credentials.accessKeyId) {
                throw new Error('Failed to load AWS credentials. Please ensure credentials are configured in ~/.aws/credentials');
            }
            const client = new KafkaClient({
                region,
                credentials
            });
            const response = await client.send(new GetBootstrapBrokersCommand({
                ClusterArn: clusterArn
            }));
            // Choose brokers based on auth method
            let brokerString;
            if (authMethod === 'AWS_MSK_IAM' && response.BootstrapBrokerStringSaslIam) {
                brokerString = response.BootstrapBrokerStringSaslIam;
            }
            else if (authMethod?.includes('SCRAM') && response.BootstrapBrokerStringSaslScram) {
                brokerString = response.BootstrapBrokerStringSaslScram;
            }
            else if (response.BootstrapBrokerStringTls) {
                brokerString = response.BootstrapBrokerStringTls;
            }
            else if (response.BootstrapBrokerString) {
                brokerString = response.BootstrapBrokerString;
            }
            if (!brokerString) {
                throw new Error('No bootstrap brokers available for this authentication method');
            }
            return brokerString.split(',');
        }
        catch (error) {
            console.error('MSK bootstrap broker fetch error:', error);
            throw new Error('Failed to get MSK bootstrap brokers. Verify: 1) AWS credentials are valid, 2) Cluster ARN is correct, 3) IAM permissions are configured');
        }
    }
    async buildSSLConfig(connection) {
        const sslConfig = {
            rejectUnauthorized: connection.rejectUnauthorized !== false
        };
        if (connection.sslCaFile) {
            sslConfig.ca = [await fs_1.promises.readFile(connection.sslCaFile, 'utf-8')];
        }
        if (connection.sslCertFile) {
            sslConfig.cert = await fs_1.promises.readFile(connection.sslCertFile, 'utf-8');
        }
        if (connection.sslKeyFile) {
            sslConfig.key = await fs_1.promises.readFile(connection.sslKeyFile, 'utf-8');
        }
        if (connection.sslPassword) {
            sslConfig.passphrase = connection.sslPassword;
        }
        return sslConfig;
    }
    async buildSASLConfig(connection) {
        if (!connection.saslMechanism) {
            return undefined;
        }
        if (connection.saslMechanism === 'AWS_MSK_IAM') {
            // AWS MSK IAM authentication using OAUTHBEARER
            if (!connection.region) {
                throw new Error('Region is required for AWS MSK IAM authentication');
            }
            return (0, mskIamAuthenticator_1.createMSKIAMAuthMechanism)(connection.region, connection.awsProfile, connection.assumeRoleArn);
        }
        // Standard SASL mechanisms
        const mechanism = connection.saslMechanism.toLowerCase().replace(/-/g, '-');
        return {
            mechanism,
            username: connection.saslUsername || '',
            password: connection.saslPassword || ''
        };
    }
    async removeCluster(name) {
        // Disconnect admin and producer with proper error handling
        const admin = this.admins.get(name);
        if (admin) {
            try {
                await admin.disconnect();
            }
            catch (error) {
                console.error(`Error disconnecting admin for cluster ${name}:`, error);
            }
            this.admins.delete(name);
        }
        const producer = this.producers.get(name);
        if (producer) {
            try {
                await producer.disconnect();
            }
            catch (error) {
                console.error(`Error disconnecting producer for cluster ${name}:`, error);
            }
            this.producers.delete(name);
        }
        this.clusters.delete(name);
        this.kafkaInstances.delete(name);
        this.saveConfiguration();
    }
    getClusters() {
        return Array.from(this.clusters.keys());
    }
    async getTopics(clusterName) {
        const admin = await this.getAdmin(clusterName);
        return await admin.listTopics();
    }
    async getTopicMetadata(clusterName, topic) {
        const admin = await this.getAdmin(clusterName);
        const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
        return metadata.topics[0];
    }
    async getTopicDetails(clusterName, topicName) {
        const admin = await this.getAdmin(clusterName);
        // Fetch topic metadata
        const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });
        const topicMetadata = metadata.topics[0];
        // Fetch topic configuration
        const configs = await admin.describeConfigs({
            resources: [
                {
                    type: 2, // TOPIC
                    name: topicName
                }
            ],
            includeSynonyms: false
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
            const offsetInfo = {};
            // Fetch offsets for each partition
            for (const partition of topicMetadata.partitions) {
                const partitionId = partition.partitionId;
                // Get beginning and end offsets using fetchOffsets
                const beginOffset = await admin.fetchTopicOffsets(topicName);
                const partitionOffset = beginOffset.find((p) => p.partition === partitionId);
                offsetInfo[partitionId] = {
                    partition: partitionId,
                    leader: partition.leader,
                    replicas: partition.replicas,
                    isr: partition.isr,
                    lowWaterMark: partitionOffset?.low || '0',
                    highWaterMark: partitionOffset?.high || '0',
                    messageCount: partitionOffset ?
                        (BigInt(partitionOffset.high) - BigInt(partitionOffset.low)).toString() : '0'
                };
            }
            return {
                name: topicName,
                partitions: topicMetadata.partitions.length,
                replicationFactor: topicMetadata.partitions[0]?.replicas?.length || 0,
                partitionDetails: offsetInfo,
                configuration: configs.resources[0]?.configEntries || []
            };
        }
        finally {
            // Always disconnect consumer, even if an error occurs
            try {
                await consumer.disconnect();
            }
            catch (error) {
                console.error('Error disconnecting consumer in getTopicDetails:', error);
            }
        }
    }
    async createTopic(clusterName, topic, numPartitions, replicationFactor) {
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
        }
        catch (error) {
            // Extract more detailed error information
            if (error.message) {
                throw new Error(error.message);
            }
            if (error.errors) {
                const errorMessages = error.errors.map((e) => `${e.topic || topic}: ${e.error || e.message || JSON.stringify(e)}`).join(', ');
                throw new Error(errorMessages);
            }
            throw error;
        }
    }
    async deleteTopic(clusterName, topic) {
        const admin = await this.getAdmin(clusterName);
        await admin.deleteTopics({
            topics: [topic]
        });
    }
    async produceMessage(clusterName, topic, key, value) {
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
    async consumeMessages(clusterName, topic, fromBeginning, limit, cancellationToken) {
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
            const messages = [];
            let isDisconnected = false;
            return await new Promise((resolve, reject) => {
                const disconnect = async () => {
                    if (!isDisconnected) {
                        isDisconnected = true;
                        try {
                            await consumer.disconnect();
                        }
                        catch (err) {
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
                        messages.push({ topic, partition, ...message });
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
        }
        catch (error) {
            // Ensure consumer is disconnected even if connection/subscription fails
            try {
                await consumer.disconnect();
            }
            catch (disconnectError) {
                console.error('Error disconnecting consumer after failure:', disconnectError);
            }
            throw error;
        }
    }
    async getConsumerGroups(clusterName) {
        const admin = await this.getAdmin(clusterName);
        const groups = await admin.listGroups();
        return groups.groups;
    }
    async deleteConsumerGroup(clusterName, groupId) {
        const admin = await this.getAdmin(clusterName);
        await admin.deleteGroups([groupId]);
    }
    async resetConsumerGroupOffsets(clusterName, groupId, topic, resetTo = 'beginning', specificOffset) {
        const admin = await this.getAdmin(clusterName);
        // Get topics for the consumer group if not specified
        let topics = [];
        if (topic) {
            topics = [topic];
        }
        else {
            const offsets = await admin.fetchOffsets({ groupId });
            topics = [...new Set(offsets.map((o) => o.topic))];
        }
        // Build reset spec for each topic
        const resetSpec = {
            groupId,
            topics: []
        };
        for (const topicName of topics) {
            const topicOffsets = await admin.fetchTopicOffsets(topicName);
            const partitions = topicOffsets.map((p) => {
                let offset;
                if (resetTo === 'beginning') {
                    offset = p.low;
                }
                else if (resetTo === 'end') {
                    offset = p.high;
                }
                else if (resetTo === 'specific offset' && specificOffset) {
                    offset = specificOffset;
                }
                else {
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
    async getConsumerGroupDetails(clusterName, groupId) {
        const admin = await this.getAdmin(clusterName);
        try {
            const description = await admin.describeGroups([groupId]);
            const offsets = await admin.fetchOffsets({ groupId });
            const group = description.groups[0];
            // Calculate lag for each topic/partition
            const lagInfo = [];
            for (const topicOffsets of offsets) {
                const topic = topicOffsets.topic;
                // Fetch topic offsets to get high water marks
                try {
                    const topicHighWaterMarks = await admin.fetchTopicOffsets(topic);
                    for (const partitionOffset of topicOffsets.partitions) {
                        const partition = partitionOffset.partition;
                        const currentOffset = partitionOffset.offset;
                        // Find the high water mark for this partition
                        const hwm = topicHighWaterMarks.find((p) => p.partition === partition);
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
                }
                catch (error) {
                    console.error(`Failed to get lag for ${topic}`, error);
                }
            }
            return {
                groupId: group.groupId,
                state: group.state,
                protocolType: group.protocolType,
                protocol: group.protocol,
                members: group.members.map((member) => ({
                    memberId: member.memberId,
                    clientId: member.clientId,
                    clientHost: member.clientHost,
                    assignments: member.memberAssignment
                })),
                offsets: lagInfo,
                totalLag: lagInfo.reduce((sum, info) => sum + info.lag, 0)
            };
        }
        catch (error) {
            console.error('Error getting consumer group details:', error);
            throw error;
        }
    }
    async getAdmin(clusterName) {
        let admin = this.admins.get(clusterName);
        if (!admin) {
            const kafka = this.kafkaInstances.get(clusterName);
            if (!kafka) {
                throw new Error(`Cluster ${clusterName} not found`);
            }
            admin = kafka.admin();
            try {
                await admin.connect();
                this.admins.set(clusterName, admin);
            }
            catch (error) {
                // Log full error for debugging but don't expose in user-facing message
                console.error(`Failed to connect to cluster ${clusterName}:`, error);
                throw new Error('Failed to connect to Kafka cluster. Please check that the brokers are accessible and your credentials are valid.');
            }
        }
        return admin;
    }
    async getProducer(clusterName) {
        let producer = this.producers.get(clusterName);
        if (!producer) {
            const kafka = this.kafkaInstances.get(clusterName);
            if (!kafka) {
                throw new Error(`Cluster ${clusterName} not found`);
            }
            producer = kafka.producer();
            await producer.connect();
            this.producers.set(clusterName, producer);
        }
        return producer;
    }
    saveConfiguration() {
        const config = vscode.workspace.getConfiguration('kafka');
        const clusters = Array.from(this.clusters.values()).map(c => {
            const clusterConfig = {
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
        const clusters = config.get('clusters', []);
        const failedClusters = [];
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
                const connection = {
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
            }
            catch (error) {
                console.error(`Failed to load cluster ${cluster.name}:`, error);
                // Determine the reason for failure
                let reason = 'Unknown error';
                const errorMsg = error?.message || error.toString();
                if (errorMsg.includes('expired') || errorMsg.includes('credentials')) {
                    reason = 'AWS credentials expired or invalid';
                }
                else if (errorMsg.includes('brokers')) {
                    reason = 'Failed to fetch brokers';
                }
                else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
                    reason = 'Network connection failed';
                }
                else {
                    reason = errorMsg.substring(0, 100);
                }
                failedClusters.push({ name: cluster.name, reason });
            }
        }
        // Show notification if any clusters failed to load
        if (failedClusters.length > 0) {
            const clusterList = failedClusters.map(c => `• ${c.name}: ${c.reason}`).join('\n');
            vscode.window.showErrorMessage(`Failed to reconnect ${failedClusters.length} cluster(s):\n${clusterList}`, 'Retry', 'Remove Failed Clusters').then(async (selection) => {
                if (selection === 'Retry') {
                    await this.loadConfiguration();
                }
                else if (selection === 'Remove Failed Clusters') {
                    // Remove failed clusters from config
                    const successfulClusters = clusters.filter(c => !failedClusters.find(fc => fc.name === c.name));
                    config.update('clusters', successfulClusters, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Failed clusters removed from configuration');
                }
            });
        }
    }
    /**
     * Validates cluster configuration to prevent extension crashes from manually edited settings
     */
    validateClusterConfig(cluster) {
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
    async dispose() {
        console.log('Disposing Kafka client manager...');
        // Disconnect all admin clients
        for (const [name, admin] of this.admins.entries()) {
            try {
                console.log(`Disconnecting admin for cluster: ${name}`);
                await admin.disconnect();
            }
            catch (error) {
                console.error(`Failed to disconnect admin for ${name}:`, error);
            }
        }
        this.admins.clear();
        // Disconnect all producers
        for (const [name, producer] of this.producers.entries()) {
            try {
                console.log(`Disconnecting producer for cluster: ${name}`);
                await producer.disconnect();
            }
            catch (error) {
                console.error(`Failed to disconnect producer for ${name}:`, error);
            }
        }
        this.producers.clear();
        // Clear other maps
        this.kafkaInstances.clear();
        this.clusters.clear();
        console.log('Kafka client manager disposed successfully');
    }
}
exports.KafkaClientManager = KafkaClientManager;
//# sourceMappingURL=kafkaClientManager.js.map