import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { KStreamTreeItem } from '../providers/kstreamProvider';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { DetailsWebview, DetailsData } from '../views/DetailsWebview';
import { AIAdvisor } from '../services/AIAdvisor';

/**
 * Show KStream details in an HTML view
 */
export async function showKStreamDetails(
    clientManager: KafkaClientManager,
    node: KStreamTreeItem,
    context?: vscode.ExtensionContext
) {
    await ErrorHandler.wrap(
        async () => {
            if (!node.topicName) {
                vscode.window.showErrorMessage('No topic name available');
                return;
            }

            const details = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading details for KStream "${node.topicName}"`,
                    cancellable: false
                },
                async (_progress) => {
                    return await clientManager.getTopicDetails(
                        node.clusterName,
                        node.topicName!
                    );
                }
            );

            // If no context provided, fall back to text document
            if (!context) {
                const { formatTopicDetailsYaml } = await import('../utils/formatters');
                const formattedDetails = formatTopicDetailsYaml(details);
                const document = await vscode.workspace.openTextDocument({
                    content: formattedDetails,
                    language: 'yaml'
                });
                await vscode.window.showTextDocument(document);
                return;
            }

            // Create HTML view
            const detailsView = new DetailsWebview(`KStream: ${node.topicName}`, '🌊');

            // Check if AI features are available
            const aiAvailable = await AIAdvisor.checkAvailability();

            // Calculate total messages across all partitions
            let totalMessages = 0;
            if (details.partitionDetails) {
                for (const partition of Object.values(details.partitionDetails) as any[]) {
                    if (partition.highWaterMark && partition.lowWaterMark) {
                        totalMessages += parseInt(partition.highWaterMark) - parseInt(partition.lowWaterMark);
                    }
                }
            }

            const data: DetailsData = {
                title: node.topicName,
                showCopyButton: true,
                showRefreshButton: false,
                showAIAdvisor: aiAvailable,
                notice: {
                    type: 'info',
                    text: aiAvailable
                        ? '🌊 This is a Kafka Streams topic. 🤖 Try AI Advisor for stream processing recommendations!'
                        : '🌊 This is a Kafka Streams topic. KStreams represent an unbounded, continuously updating data stream.'
                },
                sections: [
                    {
                        title: 'Overview',
                        icon: '📊',
                        properties: [
                            { label: 'Topic Name', value: details.name || node.topicName, code: true },
                            { label: 'Type', value: 'KStream (Event Stream)', badge: { type: 'info', text: 'STREAM' } },
                            { label: 'Partitions', value: String(details.partitions || 0) },
                            { label: 'Replication Factor', value: String(details.replicationFactor || 0) },
                            {
                                label: 'Total Messages',
                                value: totalMessages.toLocaleString()
                            },
                            {
                                label: 'Cluster',
                                value: node.clusterName,
                                code: true
                            }
                        ]
                    },
                    {
                        title: 'Partition Details',
                        icon: '🔀',
                        table: {
                            headers: ['Partition', 'Leader', 'Replicas', 'ISR', 'Low Offset', 'High Offset', 'Messages'],
                            rows: details.partitionDetails
                                ? Object.entries(details.partitionDetails).map(([id, partition]: [string, any]) => [
                                    id,
                                    String(partition.leader ?? 'N/A'),
                                    partition.replicas?.join(', ') || 'N/A',
                                    partition.isr?.join(', ') || 'N/A',
                                    partition.lowWaterMark ? parseInt(partition.lowWaterMark).toLocaleString() : '0',
                                    partition.highWaterMark ? parseInt(partition.highWaterMark).toLocaleString() : '0',
                                    partition.highWaterMark && partition.lowWaterMark
                                        ? (parseInt(partition.highWaterMark) - parseInt(partition.lowWaterMark)).toLocaleString()
                                        : '0'
                                ])
                                : []
                        }
                    },
                    {
                        title: 'Configuration',
                        icon: '⚙️',
                        table: {
                            headers: ['Property', 'Value', 'Source'],
                            rows: details.configuration && details.configuration.length > 0
                                ? details.configuration.map((config: any) => [
                                    config.configName || config.name || 'N/A',
                                    config.configValue || config.value || 'N/A',
                                    config.configSource || config.source || 'default'
                                ])
                                : []
                        }
                    }
                ]
            };

            // Set up AI request handler only if AI is available
            if (aiAvailable) {
                detailsView.setAIRequestHandler(async () => {
                    const recommendations = await AIAdvisor.analyzeTopicConfiguration({
                        name: node.topicName!,
                        partitions: details.partitions || 0,
                        replicationFactor: details.replicationFactor || 0,
                        configurations: details.configuration || [],
                        totalMessages
                    });
                    detailsView.updateWithAIRecommendations(recommendations);
                });
            }

            detailsView.show(data);
        },
        `Loading details for KStream "${node.topicName}"`
    );
}

/**
 * Find/search for a KStream across all clusters
 */
export async function findKStream(clientManager: KafkaClientManager, provider: any) {
    try {
        const clusters = clientManager.getClusters();

        if (clusters.length === 0) {
            vscode.window.showInformationMessage('No clusters configured. Please add a cluster first.');
            return;
        }

        // If multiple clusters, let user select one first
        let selectedCluster: string;
        if (clusters.length === 1) {
            selectedCluster = clusters[0];
        } else {
            const clusterChoice = await vscode.window.showQuickPick(clusters, {
                placeHolder: 'Select cluster to search KStreams',
                ignoreFocusOut: true
            });
            if (!clusterChoice) {
                return;
            }
            selectedCluster = clusterChoice;
        }

        // Get all topics
        const topics = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Loading KStream topics from ${selectedCluster}...`,
                cancellable: true
            },
            async (_progress, token) => {
                if (token.isCancellationRequested) {
                    return [];
                }

                try {
                    const allTopics = await clientManager.getTopics(selectedCluster);
                    // Filter for KStream topics - only explicit stream patterns
                    return allTopics.filter(topic => {
                        if (topic.startsWith('__')) {
                            return false;
                        }
                        if (topic.endsWith('-changelog') || topic.includes('-ktable-') ||
                            topic.includes('-store-') || topic.includes('-state-')) {
                            return false;
                        }
                        return (
                            topic.includes('-stream-') ||
                            topic.includes('KSTREAM') ||
                            topic.toLowerCase().includes('kstream') ||
                            topic.endsWith('-repartition') ||
                            topic.includes('-repartition-')
                        );
                    });
                } catch (error: any) {
                    const errorMsg = error?.message || error?.toString() || 'Unknown error';
                    if (errorMsg.includes('expired') || errorMsg.includes('credentials')) {
                        throw new Error('AWS credentials expired. Please reconnect the cluster.');
                    } else if (errorMsg.includes('timeout')) {
                        throw new Error('Connection timeout. Check that the cluster is accessible.');
                    } else {
                        throw error;
                    }
                }
            }
        );

        if (!topics || topics.length === 0) {
            vscode.window.showInformationMessage(`No KStream topics found in cluster "${selectedCluster}"`);
            return;
        }

        // Show searchable list
        const selectedTopic = await vscode.window.showQuickPick(
            topics.map(topic => ({
                label: topic,
                description: 'KStream Topic'
            })),
            {
                placeHolder: 'Search and select a KStream topic',
                matchOnDescription: true,
                ignoreFocusOut: true
            }
        );

        if (selectedTopic) {
            // Navigate to the topic in the tree
            provider.refresh();
            vscode.window.showInformationMessage(`Found KStream: ${selectedTopic.label}`);
        }
    } catch (error: any) {
        ErrorHandler.handle(error, 'Find KStream');
    }
}
