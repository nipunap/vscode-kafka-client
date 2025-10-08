import { Producer } from 'kafkajs';
import { Logger } from '../infrastructure/Logger';

/**
 * Service for managing Kafka producer operations
 * Encapsulates all message production logic
 */
export class ProducerService {
    private logger = Logger.getLogger('ProducerService');

    /**
     * Send a message to a topic
     */
    async sendMessage(
        producer: Producer,
        topic: string,
        key: string | undefined,
        value: string
    ): Promise<void> {
        try {
            this.logger.debug(`Sending message to topic: ${topic}`);
            
            await producer.send({
                topic,
                messages: [{
                    key: key ? Buffer.from(key) : undefined,
                    value: Buffer.from(value)
                }]
            });
            
            this.logger.info(`Successfully sent message to topic: ${topic}`);
        } catch (error) {
            this.logger.error(`Failed to send message to topic: ${topic}`, error);
            throw error;
        }
    }

    /**
     * Send multiple messages to a topic
     */
    async sendMessages(
        producer: Producer,
        topic: string,
        messages: Array<{ key?: string; value: string }>
    ): Promise<void> {
        try {
            this.logger.debug(`Sending ${messages.length} messages to topic: ${topic}`);
            
            await producer.send({
                topic,
                messages: messages.map(msg => ({
                    key: msg.key ? Buffer.from(msg.key) : undefined,
                    value: Buffer.from(msg.value)
                }))
            });
            
            this.logger.info(`Successfully sent ${messages.length} messages to topic: ${topic}`);
        } catch (error) {
            this.logger.error(`Failed to send messages to topic: ${topic}`, error);
            throw error;
        }
    }
}

