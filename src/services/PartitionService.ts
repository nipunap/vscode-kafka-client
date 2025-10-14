import { Admin } from 'kafkajs';
import { Logger } from '../infrastructure/Logger';

// Constants for partition operations
export const MAX_RECOMMENDED_PARTITIONS = 10000;  // Maximum recommended partition count per topic
const PARTITION_CREATE_TIMEOUT_MS = 5000;  // Timeout for partition creation operation

/**
 * Service for partition-related operations
 */
export class PartitionService {
    private logger = Logger.getLogger('PartitionService');

    /**
     * Add partitions to an existing topic
     * @param admin KafkaJS Admin instance
     * @param topic Topic name
     * @param newPartitionCount New total partition count (must be > current count)
     */
    async addPartitions(
        admin: Admin,
        topic: string,
        newPartitionCount: number
    ): Promise<void> {
        try {
            this.logger.info(`Adding partitions to topic: ${topic}, new count: ${newPartitionCount}`);

            await admin.createPartitions({
                topicPartitions: [{
                    topic: topic,
                    count: newPartitionCount
                }],
                validateOnly: false,
                timeout: PARTITION_CREATE_TIMEOUT_MS
            });

            this.logger.info(`Successfully added partitions to topic: ${topic}`);
        } catch (error) {
            this.logger.error(`Failed to add partitions to topic: ${topic}`, error);
            throw error;
        }
    }

    /**
     * Get current partition count for a topic
     * @param admin KafkaJS Admin instance
     * @param topic Topic name
     * @returns Current partition count
     */
    async getCurrentPartitionCount(
        admin: Admin,
        topic: string
    ): Promise<number> {
        try {
            const metadata = await admin.fetchTopicMetadata({ topics: [topic] });

            if (metadata.topics.length === 0) {
                throw new Error(`Topic not found: ${topic}`);
            }

            const topicMetadata = metadata.topics[0];
            if (topicMetadata.partitions.length === 0) {
                throw new Error(`No partitions found for topic: ${topic}`);
            }

            return topicMetadata.partitions.length;
        } catch (error) {
            this.logger.error(`Failed to get partition count for topic: ${topic}`, error);
            throw error;
        }
    }

    /**
     * Validate that new partition count is valid
     * @param currentCount Current partition count
     * @param newCount Desired partition count
     * @throws Error if validation fails
     */
    validatePartitionCount(currentCount: number, newCount: number): void {
        if (newCount <= currentCount) {
            throw new Error(
                `New partition count (${newCount}) must be greater than current count (${currentCount}). ` +
                `Kafka does not support reducing partition count.`
            );
        }

        if (newCount > 10000) {
            throw new Error(
                `Partition count (${newCount}) exceeds recommended maximum (10000). ` +
                `Very high partition counts can impact cluster performance.`
            );
        }
    }
}
