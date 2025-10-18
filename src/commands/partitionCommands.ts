import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { Logger } from '../infrastructure/Logger';

const logger = Logger.getLogger('PartitionCommands');

/**
 * View partition offsets
 */
export async function viewPartitionOffsets(
    clientManager: KafkaClientManager,
    clusterName: string,
    topicName: string,
    partitionId: number
): Promise<void> {
    try {
        logger.info(`Viewing offsets for partition ${partitionId} of topic ${topicName}`);

        const admin = await clientManager.getAdminClient(clusterName);
        const offsets = await admin.fetchTopicOffsets(topicName);

        const partitionOffset = offsets.find(o => o.partition === partitionId);

        if (!partitionOffset) {
            vscode.window.showErrorMessage(`Partition ${partitionId} not found`);
            return;
        }

        const message = `Partition ${partitionId} Offsets:\n\n` +
            `Low (earliest): ${partitionOffset.low}\n` +
            `High (latest): ${partitionOffset.high}\n` +
            `Total messages: ${BigInt(partitionOffset.high) - BigInt(partitionOffset.low)}`;

        vscode.window.showInformationMessage(message, { modal: true });
        logger.info('Partition offsets displayed successfully');
    } catch (error: any) {
        logger.error('Failed to view partition offsets', error);
        vscode.window.showErrorMessage(`Failed to view partition offsets: ${error.message}`);
    }
}

/**
 * Seek consumer to specific offset in partition
 */
export async function seekToOffset(
    clientManager: KafkaClientManager,
    clusterName: string,
    topicName: string,
    partitionId: number
): Promise<void> {
    try {
        const offsetInput = await vscode.window.showInputBox({
            prompt: `Enter offset to seek to in partition ${partitionId}`,
            placeHolder: 'e.g., 0, 100, 1000',
            validateInput: (value) => {
                if (!value) {
                    return 'Offset is required';
                }
                const offset = parseInt(value);
                if (isNaN(offset) || offset < 0) {
                    return 'Offset must be a non-negative number';
                }
                return null;
            }
        });

        if (!offsetInput) {
            return;
        }

        const offset = offsetInput;
        logger.info(`Seeking to offset ${offset} in partition ${partitionId}`);

        const consumer = await clientManager.getConsumer(clusterName);
        await consumer.seek({
            topic: topicName,
            partition: partitionId,
            offset: offset
        });

        vscode.window.showInformationMessage(
            `Seeked to offset ${offset} in partition ${partitionId} of topic ${topicName}`
        );
        logger.info('Seek operation completed successfully');
    } catch (error: any) {
        logger.error('Failed to seek to offset', error);
        vscode.window.showErrorMessage(`Failed to seek: ${error.message}`);
    }
}

/**
 * View partition details (leader, replicas, ISR)
 */
export async function viewPartitionDetails(
    clientManager: KafkaClientManager,
    clusterName: string,
    topicName: string,
    partitionId: number
): Promise<void> {
    try {
        logger.info(`Viewing details for partition ${partitionId} of topic ${topicName}`);

        const admin = await clientManager.getAdminClient(clusterName);
        const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });

        const topicMetadata = metadata.topics.find(t => t.name === topicName);
        if (!topicMetadata) {
            vscode.window.showErrorMessage(`Topic ${topicName} not found`);
            return;
        }

        const partition = topicMetadata.partitions.find(p => p.partitionId === partitionId);
        if (!partition) {
            vscode.window.showErrorMessage(`Partition ${partitionId} not found`);
            return;
        }

        const message = `Partition ${partitionId} Details:\n\n` +
            `Leader: Broker ${partition.leader}\n` +
            `Replicas: ${partition.replicas.map(r => `Broker ${r}`).join(', ')}\n` +
            `In-Sync Replicas (ISR): ${partition.isr.map(r => `Broker ${r}`).join(', ')}\n` +
            `Replication Factor: ${partition.replicas.length}\n` +
            `ISR Count: ${partition.isr.length}`;

        vscode.window.showInformationMessage(message, { modal: true });
        logger.info('Partition details displayed successfully');
    } catch (error: any) {
        logger.error('Failed to view partition details', error);
        vscode.window.showErrorMessage(`Failed to view partition details: ${error.message}`);
    }
}
