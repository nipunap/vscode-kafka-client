import { Admin } from 'kafkajs';
import { Logger } from '../infrastructure/Logger';

/**
 * Service for managing Kafka topic operations
 * Encapsulates all topic-related logic
 */
export class TopicService {
    private logger = Logger.getLogger('TopicService');

    /**
     * Get all topics for a cluster
     */
    async getTopics(admin: Admin): Promise<string[]> {
        try {
            this.logger.debug('Fetching topics');
            const topics = await admin.listTopics();
            this.logger.debug(`Found ${topics.length} topics`);
            return topics;
        } catch (error) {
            this.logger.error('Failed to fetch topics', error);
            throw error;
        }
    }

    /**
     * Create a new topic
     */
    async createTopic(
        admin: Admin,
        topicName: string,
        numPartitions: number,
        replicationFactor: number
    ): Promise<void> {
        try {
            this.logger.info(`Creating topic: ${topicName} (partitions: ${numPartitions}, replication: ${replicationFactor})`);
            
            await admin.createTopics({
                topics: [{
                    topic: topicName,
                    numPartitions,
                    replicationFactor
                }]
            });
            
            this.logger.info(`Successfully created topic: ${topicName}`);
        } catch (error) {
            this.logger.error(`Failed to create topic: ${topicName}`, error);
            throw error;
        }
    }

    /**
     * Delete a topic
     */
    async deleteTopic(admin: Admin, topicName: string): Promise<void> {
        try {
            this.logger.info(`Deleting topic: ${topicName}`);
            
            await admin.deleteTopics({
                topics: [topicName]
            });
            
            this.logger.info(`Successfully deleted topic: ${topicName}`);
        } catch (error) {
            this.logger.error(`Failed to delete topic: ${topicName}`, error);
            throw error;
        }
    }

    /**
     * Get topic metadata (partitions, replicas, ISR, etc.)
     */
    async getTopicMetadata(admin: Admin, topicName: string): Promise<any> {
        try {
            this.logger.debug(`Fetching metadata for topic: ${topicName}`);
            
            const metadata = await admin.fetchTopicMetadata({
                topics: [topicName]
            });
            
            if (metadata.topics.length === 0) {
                throw new Error(`Topic not found: ${topicName}`);
            }
            
            return metadata.topics[0];
        } catch (error) {
            this.logger.error(`Failed to fetch metadata for topic: ${topicName}`, error);
            throw error;
        }
    }

    /**
     * Get topic configuration
     */
    async getTopicConfig(admin: Admin, topicName: string): Promise<any> {
        try {
            this.logger.debug(`Fetching configuration for topic: ${topicName}`);
            
            const configs = await admin.describeConfigs({
                resources: [{
                    type: 2, // TOPIC = 2
                    name: topicName
                }],
                includeSynonyms: false
            });
            
            if (configs.resources.length === 0) {
                throw new Error(`Topic configuration not found: ${topicName}`);
            }
            
            return configs.resources[0];
        } catch (error) {
            this.logger.error(`Failed to fetch configuration for topic: ${topicName}`, error);
            throw error;
        }
    }

    /**
     * Get topic offsets (earliest and latest)
     */
    async getTopicOffsets(admin: Admin, topicName: string): Promise<any> {
        try {
            this.logger.debug(`Fetching offsets for topic: ${topicName}`);
            
            const offsets = await admin.fetchTopicOffsets(topicName);
            
            this.logger.debug(`Fetched offsets for ${offsets.length} partitions`);
            return offsets;
        } catch (error) {
            this.logger.error(`Failed to fetch offsets for topic: ${topicName}`, error);
            throw error;
        }
    }

    /**
     * Get comprehensive topic details (metadata + config + offsets)
     */
    async getTopicDetails(admin: Admin, topicName: string): Promise<any> {
        try {
            this.logger.debug(`Fetching comprehensive details for topic: ${topicName}`);
            
            const [metadata, config, offsets] = await Promise.all([
                this.getTopicMetadata(admin, topicName),
                this.getTopicConfig(admin, topicName),
                this.getTopicOffsets(admin, topicName)
            ]);
            
            return {
                name: topicName,
                metadata,
                config,
                offsets
            };
        } catch (error) {
            this.logger.error(`Failed to fetch details for topic: ${topicName}`, error);
            throw error;
        }
    }
}

