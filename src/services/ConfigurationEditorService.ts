import { Admin, ConfigResourceTypes } from 'kafkajs';
import { Logger } from '../infrastructure/Logger';

/**
 * Configuration entry interface matching KafkaJS structure
 */
export interface ConfigEntry {
    configName: string;
    configValue: string;
    isDefault?: boolean;
    isReadOnly?: boolean;
    isSensitive?: boolean;
    configSource?: number;
}

/**
 * Type guard to validate ConfigEntry structure
 */
function isValidConfigEntry(obj: any): obj is ConfigEntry {
    return (
        obj !== null &&
        typeof obj === 'object' &&
        typeof obj.configName === 'string' &&
        typeof obj.configValue === 'string' &&
        (obj.isDefault === undefined || typeof obj.isDefault === 'boolean') &&
        (obj.isReadOnly === undefined || typeof obj.isReadOnly === 'boolean') &&
        (obj.isSensitive === undefined || typeof obj.isSensitive === 'boolean') &&
        (obj.configSource === undefined || typeof obj.configSource === 'number')
    );
}

/**
 * Service for configuration editing operations
 */
export class ConfigurationEditorService {
    private logger = Logger.getLogger('ConfigurationEditorService');

    /**
     * Alter topic configurations
     * @param admin KafkaJS Admin instance
     * @param topicName Topic name
     * @param configEntries Configuration entries to modify
     */
    async alterTopicConfig(
        admin: Admin,
        topicName: string,
        configEntries: Array<{ name: string; value: string }>
    ): Promise<void> {
        try {
            this.logger.info(`Altering config for topic: ${topicName}`, { configEntries });

            await admin.alterConfigs({
                validateOnly: false,
                resources: [{
                    type: ConfigResourceTypes.TOPIC,
                    name: topicName,
                    configEntries: configEntries
                }]
            });

            this.logger.info(`Successfully altered config for topic: ${topicName}`);
        } catch (error) {
            this.logger.error(`Failed to alter config for topic: ${topicName}`, error);
            throw error;
        }
    }

    /**
     * Alter broker configurations
     * @param admin KafkaJS Admin instance
     * @param brokerId Broker ID
     * @param configEntries Configuration entries to modify
     */
    async alterBrokerConfig(
        admin: Admin,
        brokerId: string,
        configEntries: Array<{ name: string; value: string }>
    ): Promise<void> {
        try {
            this.logger.info(`Altering config for broker: ${brokerId}`, { configEntries });

            await admin.alterConfigs({
                validateOnly: false,
                resources: [{
                    type: ConfigResourceTypes.BROKER,
                    name: brokerId,
                    configEntries: configEntries
                }]
            });

            this.logger.info(`Successfully altered config for broker: ${brokerId}`);
        } catch (error) {
            this.logger.error(`Failed to alter config for broker: ${brokerId}`, error);
            throw error;
        }
    }

    /**
     * Get current configurations for a topic
     * @param admin KafkaJS Admin instance
     * @param topicName Topic name
     * @returns Configuration entries
     */
    async getTopicConfig(
        admin: Admin,
        topicName: string
    ): Promise<ConfigEntry[]> {
        try {
            const result = await admin.describeConfigs({
                includeSynonyms: false,
                resources: [{
                    type: ConfigResourceTypes.TOPIC,
                    name: topicName
                }]
            });

            if (!result || !result.resources || result.resources.length === 0) {
                throw new Error(`Topic not found: ${topicName}`);
            }

            const configEntries = result.resources[0].configEntries;
            if (!Array.isArray(configEntries)) {
                throw new Error(`Invalid config structure returned for topic: ${topicName}`);
            }

            // Validate each config entry
            const validatedEntries: ConfigEntry[] = [];
            for (const entry of configEntries) {
                if (isValidConfigEntry(entry)) {
                    validatedEntries.push(entry);
                } else {
                    this.logger.warn(`Skipping invalid config entry for topic ${topicName}:`, entry);
                }
            }

            return validatedEntries;
        } catch (error) {
            this.logger.error(`Failed to get config for topic: ${topicName}`, error);
            throw error;
        }
    }

    /**
     * Get current configurations for a broker
     * @param admin KafkaJS Admin instance
     * @param brokerId Broker ID
     * @returns Configuration entries
     */
    async getBrokerConfig(
        admin: Admin,
        brokerId: string
    ): Promise<ConfigEntry[]> {
        try {
            const result = await admin.describeConfigs({
                includeSynonyms: false,
                resources: [{
                    type: ConfigResourceTypes.BROKER,
                    name: brokerId
                }]
            });

            if (!result || !result.resources || result.resources.length === 0) {
                throw new Error(`Broker not found: ${brokerId}`);
            }

            const configEntries = result.resources[0].configEntries;
            if (!Array.isArray(configEntries)) {
                throw new Error(`Invalid config structure returned for broker: ${brokerId}`);
            }

            // Validate each config entry
            const validatedEntries: ConfigEntry[] = [];
            for (const entry of configEntries) {
                if (isValidConfigEntry(entry)) {
                    validatedEntries.push(entry);
                } else {
                    this.logger.warn(`Skipping invalid config entry for broker ${brokerId}:`, entry);
                }
            }

            return validatedEntries;
        } catch (error) {
            this.logger.error(`Failed to get config for broker: ${brokerId}`, error);
            throw error;
        }
    }

    /**
     * Sanitize input to prevent injection attacks
     * @param value Input value to sanitize
     * @returns Sanitized value
     */
    private sanitizeInput(value: string): string {
        // Remove potentially dangerous characters that could be used in injection attacks
        // Keep alphanumeric, dots, dashes, underscores, commas, and equals (for valid config values)
        return value.replace(/[;&|`$()<>{}[\]\\'"]/g, '').trim();
    }

    /**
     * Validate configuration value based on type
     * @param configName Configuration name
     * @param value Configuration value
     * @throws Error if validation fails
     */
    validateConfigValue(configName: string, value: string): void {
        // Sanitize input first
        const sanitized = this.sanitizeInput(value);
        if (sanitized !== value) {
            throw new Error(`Invalid characters detected in value. Sanitized value would be: ${sanitized}`);
        }
        // Validate common Kafka configurations
        switch (configName) {
            case 'retention.ms':
            case 'retention.bytes':
            case 'segment.ms':
            case 'segment.bytes':
            case 'max.message.bytes':
            case 'min.insync.replicas':
                if (!/^-?\d+$/.test(value)) {
                    throw new Error(`${configName} must be a valid integer`);
                }
                break;

            case 'compression.type':
                const validCompressionTypes = ['uncompressed', 'gzip', 'snappy', 'lz4', 'zstd', 'producer'];
                if (!validCompressionTypes.includes(value.toLowerCase())) {
                    throw new Error(`compression.type must be one of: ${validCompressionTypes.join(', ')}`);
                }
                break;

            case 'cleanup.policy':
                const validCleanupPolicies = ['delete', 'compact', 'delete,compact', 'compact,delete'];
                if (!validCleanupPolicies.includes(value.toLowerCase())) {
                    throw new Error(`cleanup.policy must be one of: ${validCleanupPolicies.join(', ')}`);
                }
                break;

            case 'message.timestamp.type':
                const validTimestampTypes = ['CreateTime', 'LogAppendTime'];
                if (!validTimestampTypes.includes(value)) {
                    throw new Error(`message.timestamp.type must be one of: ${validTimestampTypes.join(', ')}`);
                }
                break;

            case 'preallocate':
            case 'unclean.leader.election.enable':
            case 'message.downconversion.enable':
                const validBooleans = ['true', 'false'];
                if (!validBooleans.includes(value.toLowerCase())) {
                    throw new Error(`${configName} must be either true or false`);
                }
                break;
        }
    }

    /**
     * Check if a configuration is read-only
     * @param configEntry Configuration entry
     * @returns true if read-only
     */
    isReadOnlyConfig(configEntry: ConfigEntry): boolean {
        return configEntry.isReadOnly || false;
    }

    /**
     * Check if a configuration requires broker restart
     * @param configName Configuration name
     * @returns true if restart required
     */
    requiresBrokerRestart(configName: string): boolean {
        // List of broker configs that require restart
        const restartRequiredConfigs = [
            'log.dirs',
            'zookeeper.connect',
            'broker.id',
            'listeners',
            'advertised.listeners',
            'num.network.threads',
            'num.io.threads',
            'socket.send.buffer.bytes',
            'socket.receive.buffer.bytes',
            'socket.request.max.bytes',
            'num.recovery.threads.per.data.dir'
        ];

        return restartRequiredConfigs.includes(configName);
    }
}
