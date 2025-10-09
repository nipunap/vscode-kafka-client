import { Admin } from 'kafkajs';
import { Logger } from '../infrastructure/Logger';

/**
 * Service for managing Kafka consumer group operations
 * Encapsulates all consumer group-related logic
 */
export class ConsumerGroupService {
    private logger = Logger.getLogger('ConsumerGroupService');

    /**
     * Get all consumer groups
     */
    async getConsumerGroups(admin: Admin): Promise<any[]> {
        try {
            this.logger.debug('Fetching consumer groups');

            const groups = await admin.listGroups();

            this.logger.debug(`Found ${groups.groups.length} consumer groups`);

            // If we have groups, describe them to get their states
            if (groups.groups.length > 0) {
                try {
                    const groupIds = groups.groups.map((g: any) => g.groupId);
                    const descriptions = await admin.describeGroups(groupIds);

                    // Map descriptions back to groups with state information
                    return descriptions.groups.map((desc: any) => ({
                        groupId: desc.groupId,
                        protocolType: desc.protocolType,
                        state: desc.state
                    }));
                } catch (describeError) {
                    this.logger.warn('Failed to describe consumer groups for state info, returning basic info', describeError);
                    // Fall back to basic list if describe fails
                    return groups.groups;
                }
            }

            return groups.groups;
        } catch (error) {
            this.logger.error('Failed to fetch consumer groups', error);
            throw error;
        }
    }

    /**
     * Get consumer group details
     */
    async getConsumerGroupDetails(admin: Admin, groupId: string): Promise<any> {
        try {
            this.logger.debug(`Fetching details for consumer group: ${groupId}`);

            const descriptions = await admin.describeGroups([groupId]);

            if (descriptions.groups.length === 0) {
                throw new Error(`Consumer group not found: ${groupId}`);
            }

            return descriptions.groups[0];
        } catch (error) {
            this.logger.error(`Failed to fetch details for consumer group: ${groupId}`, error);
            throw error;
        }
    }

    /**
     * Get consumer group offsets
     */
    async getConsumerGroupOffsets(admin: Admin, groupId: string): Promise<any> {
        try {
            this.logger.debug(`Fetching offsets for consumer group: ${groupId}`);

            const offsets = await admin.fetchOffsets({
                groupId
            });

            this.logger.debug(`Fetched offsets for ${offsets.length} topics`);
            return offsets;
        } catch (error) {
            this.logger.error(`Failed to fetch offsets for consumer group: ${groupId}`, error);
            throw error;
        }
    }

    /**
     * Delete a consumer group
     */
    async deleteConsumerGroup(admin: Admin, groupId: string): Promise<void> {
        try {
            this.logger.info(`Deleting consumer group: ${groupId}`);

            await admin.deleteGroups([groupId]);

            this.logger.info(`Successfully deleted consumer group: ${groupId}`);
        } catch (error) {
            this.logger.error(`Failed to delete consumer group: ${groupId}`, error);
            throw error;
        }
    }

    /**
     * Reset consumer group offsets
     */
    async resetConsumerGroupOffsets(
        admin: Admin,
        groupId: string,
        topic: string,
        offset: 'earliest' | 'latest' | number
    ): Promise<void> {
        try {
            this.logger.info(`Resetting offsets for consumer group: ${groupId}, topic: ${topic}, offset: ${offset}`);

            // First, get topic metadata to know partition count
            const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
            const topicMetadata = metadata.topics.find(t => t.name === topic);

            if (!topicMetadata) {
                throw new Error(`Topic not found: ${topic}`);
            }

            // Build offset reset structure
            const partitions = topicMetadata.partitions.map(p => ({
                partition: p.partitionId,
                offset: offset === 'earliest' ? '0' : offset === 'latest' ? '-1' : String(offset)
            }));

            await admin.setOffsets({
                groupId,
                topic,
                partitions
            });

            this.logger.info(`Successfully reset offsets for consumer group: ${groupId}`);
        } catch (error) {
            this.logger.error(`Failed to reset offsets for consumer group: ${groupId}`, error);
            throw error;
        }
    }

    /**
     * Get comprehensive consumer group info (details + offsets)
     */
    async getConsumerGroupInfo(admin: Admin, groupId: string): Promise<any> {
        try {
            this.logger.debug(`Fetching comprehensive info for consumer group: ${groupId}`);

            const [details, offsets] = await Promise.all([
                this.getConsumerGroupDetails(admin, groupId),
                this.getConsumerGroupOffsets(admin, groupId)
            ]);

            return {
                groupId,
                details,
                offsets
            };
        } catch (error) {
            this.logger.error(`Failed to fetch info for consumer group: ${groupId}`, error);
            throw error;
        }
    }
}
