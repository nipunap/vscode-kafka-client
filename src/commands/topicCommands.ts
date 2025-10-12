/**
 * Command handlers for Kafka topic operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { KafkaExplorerProvider } from '../providers/kafkaExplorerProvider';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { TopicDashboardWebview } from '../views/topicDashboardWebview';
import { DetailsWebview, DetailsData } from '../views/DetailsWebview';
import { TopicNode, ClusterNode } from '../types/nodes';
import { ACL } from '../types/acl';
import { AIAdvisor } from '../services/AIAdvisor';
import { ConfigSourceMapper } from '../utils/configSourceMapper';

export async function createTopic(
    clientManager: KafkaClientManager,
    provider: KafkaExplorerProvider,
    node: ClusterNode
) {
    const topicName = await vscode.window.showInputBox({
        prompt: 'Enter topic name',
        placeHolder: 'my-topic'
    });

    if (!topicName) {
        return;
    }

    const partitions = await vscode.window.showInputBox({
        prompt: 'Number of partitions',
        value: '1',
        validateInput: (value) => {
            return isNaN(Number(value)) ? 'Must be a number' : undefined;
        }
    });

    const replicationFactor = await vscode.window.showInputBox({
        prompt: 'Replication factor',
        value: '1',
        validateInput: (value) => {
            return isNaN(Number(value)) ? 'Must be a number' : undefined;
        }
    });

    if (!partitions || !replicationFactor) {
        return;
    }

    await ErrorHandler.wrap(
        async () => {
            await clientManager.createTopic(
                node.clusterName,
                topicName,
                Number(partitions),
                Number(replicationFactor)
            );
            provider.refresh();
            vscode.window.showInformationMessage(`✓ Topic "${topicName}" created successfully!`);
        },
        `Creating topic "${topicName}"`
    );
}

export async function deleteTopic(
    clientManager: KafkaClientManager,
    provider: KafkaExplorerProvider,
    node: TopicNode
) {
    const confirm = await vscode.window.showWarningMessage(
        `Delete topic "${node.label}"? This action cannot be undone.`,
        'Yes',
        'No'
    );

    if (confirm === 'Yes') {
        await ErrorHandler.wrap(
            async () => {
                await clientManager.deleteTopic(node.clusterName, node.topicName);
                provider.refresh();
                vscode.window.showInformationMessage(`✓ Topic "${node.label}" deleted successfully.`);
            },
            `Deleting topic "${node.label}"`
        );
    }
}

export async function showTopicDetails(clientManager: KafkaClientManager, node: TopicNode, context?: vscode.ExtensionContext) {
    await ErrorHandler.wrap(
        async () => {
            const details = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading details for topic "${node.topicName}"`,
                    cancellable: false
                },
                async (_progress) => {
                    return await clientManager.getTopicDetails(
                        node.clusterName,
                        node.topicName
                    );
                }
            );

            // If no context provided, fall back to text document (for backward compatibility)
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
            const detailsView = new DetailsWebview(`Topic: ${node.topicName}`, '📋');

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
                        ? '🤖 Try the AI Advisor for intelligent configuration recommendations! ✏️ Edit mode coming soon.'
                        : '✏️ Edit mode coming soon! You\'ll be able to modify topic configurations directly from this view.'
                },
                sections: [
                    {
                        title: 'Overview',
                        icon: '📊',
                        properties: [
                            { label: 'Topic Name', value: details.name || node.topicName, code: true },
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
                                    ConfigSourceMapper.toHumanReadable(config.configSource || config.source || 5)
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
                        name: node.topicName,
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
        `Loading details for topic "${node.topicName}"`
    );
}

/**
 * Find/search for a topic across all clusters
 */
export async function findTopic(clientManager: KafkaClientManager, context?: vscode.ExtensionContext) {
    await ErrorHandler.wrap(
        async () => {
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
                    placeHolder: 'Select cluster to search topics',
                    ignoreFocusOut: true
                });
                if (!clusterChoice) {
                    return;
                }
                selectedCluster = clusterChoice;
            }

            // Get all topics with timeout
            const topics = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading topics from ${selectedCluster}...`,
                    cancellable: true
                },
                async (_progress, token) => {
                    // Add cancellation support
                    if (token.isCancellationRequested) {
                        return [];
                    }

                    const result = await clientManager.getTopics(selectedCluster);
                    return result || [];
                }
            );

            if (!topics || topics.length === 0) {
                vscode.window.showInformationMessage(`No topics found in cluster "${selectedCluster}"`);
                return;
            }

            // Show searchable list with fuzzy matching
            const selectedTopic = await vscode.window.showQuickPick(
                topics.map(topic => ({
                    label: topic,
                    description: `Cluster: ${selectedCluster}`,
                    detail: undefined
                })),
                {
                    placeHolder: `Search topics in ${selectedCluster} (${topics.length} total)`,
                    matchOnDescription: true,
                    ignoreFocusOut: true
                }
            );

            if (selectedTopic) {
                // Show topic details with HTML webview
                await showTopicDetails(clientManager, {
                    clusterName: selectedCluster,
                    topicName: selectedTopic.label
                }, context);
            }
        },
        'Searching for topics'
    );
}

export async function showTopicDashboard(
    clientManager: KafkaClientManager,
    context: vscode.ExtensionContext,
    node: TopicNode
) {
    return ErrorHandler.wrap(async () => {
        const clusterName = node.clusterName;
        const topicName = node.topicName || node.label;

        if (!clusterName || !topicName) {
            throw new Error('Cluster name and topic name are required');
        }

        const dashboard = new TopicDashboardWebview(context, clientManager);
        await dashboard.show(clusterName, topicName);
    }, 'Show Topic Dashboard');
}

/**
 * Export all topics from a cluster to a file
 */
export async function exportTopics(clientManager: KafkaClientManager, node: ClusterNode) {
    await ErrorHandler.wrap(
        async () => {
            // Get format choice
            const format = await vscode.window.showQuickPick(
                [
                    { label: 'JSON', description: 'Export as JSON format', value: 'json' },
                    { label: 'CSV', description: 'Export as comma-separated values', value: 'csv' },
                    { label: 'Plain Text', description: 'Export as line-separated text', value: 'txt' }
                ],
                {
                    placeHolder: 'Select export format',
                    ignoreFocusOut: true
                }
            );

            if (!format) {
                return;
            }

            // Get topics with progress
            const topics = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading topics from ${node.clusterName}...`,
                    cancellable: false
                },
                async () => {
                    return await clientManager.getTopics(node.clusterName);
                }
            );

            if (!topics || topics.length === 0) {
                vscode.window.showInformationMessage(`No topics found in cluster "${node.clusterName}"`);
                return;
            }

            // Generate content based on format
            let content: string;
            let fileExtension: string;

            switch (format.value) {
                case 'json':
                    content = JSON.stringify({
                        cluster: node.clusterName,
                        exportDate: new Date().toISOString(),
                        topicCount: topics.length,
                        topics: topics
                    }, null, 2);
                    fileExtension = 'json';
                    break;
                case 'csv':
                    content = `Cluster,Topic Name\n`;
                    content += topics.map(topic => `"${node.clusterName}","${topic}"`).join('\n');
                    fileExtension = 'csv';
                    break;
                default: // txt
                    content = `Cluster: ${node.clusterName}\n`;
                    content += `Export Date: ${new Date().toISOString()}\n`;
                    content += `Total Topics: ${topics.length}\n\n`;
                    content += topics.join('\n');
                    fileExtension = 'txt';
            }

            // Save file
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${node.clusterName}-topics-${Date.now()}.${fileExtension}`),
                filters: {
                    'All Files': ['*'],
                    ...(format.value === 'json' && { 'JSON': ['json'] }),
                    ...(format.value === 'csv' && { 'CSV': ['csv'] }),
                    ...(format.value === 'txt' && { 'Text': ['txt'] })
                }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
                const action = await vscode.window.showInformationMessage(
                    `Exported ${topics.length} topics to ${uri.fsPath}`,
                    'Open File'
                );
                if (action === 'Open File') {
                    await vscode.window.showTextDocument(uri);
                }
            }
        },
        `Exporting topics from cluster "${node.clusterName}"`
    );
}

/**
 * Show ACL details for a specific topic ACL
 */
export async function showTopicACLDetails(clientManager: KafkaClientManager, node: { clusterName: string; topicName?: string; acl: ACL }, context?: vscode.ExtensionContext): Promise<void> {
    return ErrorHandler.wrap(async () => {
        if (!node.acl) {
            vscode.window.showErrorMessage('No ACL data available');
            return;
        }

        const aclDetails = await clientManager.getACLDetails(node.clusterName, node.acl);

        // If no context provided, fall back to text document
        if (!context) {
            const { formatTopicDetailsYaml } = await import('../utils/formatters');
            const yaml = formatTopicDetailsYaml(aclDetails);
            const doc = await vscode.workspace.openTextDocument({
                content: yaml,
                language: 'yaml'
            });
            await vscode.window.showTextDocument(doc);
            return;
        }

        // Create HTML view
        const detailsView = new DetailsWebview(`ACL Details`, '🔒');
        const data: DetailsData = {
            title: `${aclDetails.principal} → ${aclDetails.operation}`,
            showCopyButton: true,
            showRefreshButton: false,
            notice: {
                type: 'info',
                text: '✏️ Edit mode coming soon! You\'ll be able to modify ACL configurations directly from this view.'
            },
            sections: [
                {
                    title: 'ACL Information',
                    icon: '🔒',
                    properties: [
                        {
                            label: 'Principal',
                            value: aclDetails.principal,
                            code: true
                        },
                        {
                            label: 'Operation',
                            value: aclDetails.operation
                        },
                        {
                            label: 'Permission Type',
                            value: aclDetails.permissionType,
                            badge: {
                                type: aclDetails.permissionType.toLowerCase() === 'allow' ? 'success' : 'danger',
                                text: aclDetails.permissionType.toUpperCase()
                            }
                        },
                        {
                            label: 'Resource Type',
                            value: aclDetails.resourceType
                        },
                        {
                            label: 'Resource Name',
                            value: aclDetails.resourceName,
                            code: true
                        },
                        {
                            label: 'Host',
                            value: aclDetails.host
                        },
                        {
                            label: 'Pattern Type',
                            value: aclDetails.resourcePatternType
                        }
                    ]
                },
                {
                    title: 'Description',
                    icon: '📝',
                    html: `<p style="padding: 10px; line-height: 1.8;">${aclDetails.description}</p>`
                }
            ]
        };

        detailsView.show(data);
    }, 'Show Topic ACL Details');
}
