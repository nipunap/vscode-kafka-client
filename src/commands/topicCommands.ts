/**
 * Command handlers for Kafka topic operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { KafkaExplorerProvider } from '../providers/kafkaExplorerProvider';
import { formatMessages } from '../utils/formatters';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { TopicDashboardWebview } from '../views/topicDashboardWebview';
import { DetailsWebview, DetailsData } from '../views/DetailsWebview';
import { TopicNode, ClusterNode } from '../types/nodes';
import { ACL } from '../types/acl';
import { AIAdvisor } from '../services/AIAdvisor';

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

export async function produceMessage(clientManager: KafkaClientManager, node: TopicNode) {
    const key = await vscode.window.showInputBox({
        prompt: 'Enter message key (optional)',
        placeHolder: 'key'
    });

    const value = await vscode.window.showInputBox({
        prompt: 'Enter message value',
        placeHolder: 'message content'
    });

    if (!value) {
        return;
    }

    await ErrorHandler.wrap(
        async () => {
            await clientManager.produceMessage(node.clusterName, node.topicName, key, value);
            vscode.window.showInformationMessage(`Message sent to topic "${node.topicName}"`);
        },
        `Producing message to topic "${node.topicName}"`
    );
}

export async function consumeMessages(clientManager: KafkaClientManager, node: TopicNode) {
    // Validate input
    if (!node || !node.clusterName || !node.topicName) {
        vscode.window.showErrorMessage('Invalid topic selection. Please try again.');
        return;
    }

    const fromBeginning = await vscode.window.showQuickPick(['Latest', 'Beginning'], {
        placeHolder: 'Consume from?'
    });

    if (!fromBeginning) {
        return;
    }

    const limitStr = await vscode.window.showInputBox({
        prompt: 'Number of messages to consume (max 1000)',
        value: '10',
        validateInput: (value) => {
            const num = Number(value);
            if (isNaN(num)) {
                return 'Must be a number';
            }
            if (num <= 0) {
                return 'Must be greater than 0';
            }
            if (num > 1000) {
                return 'Maximum is 1000 messages';
            }
            return undefined;
        }
    });

    if (!limitStr) {
        return;
    }

    const limit = Number(limitStr);

    await ErrorHandler.wrap(
        async () => {
            await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Consuming messages from ${node.topicName}`,
                cancellable: true
            },
            async (progress, token) => {
                // Create document first with header
                const document = await vscode.workspace.openTextDocument({
                    content: `# Consuming from topic: ${node.topicName}\n# Waiting for messages...\n\n`,
                    language: 'json'
                });
                const editor = await vscode.window.showTextDocument(document);

                const messages: any[] = [];
                let lastUpdateTime = Date.now();
                const UPDATE_THROTTLE_MS = 100; // Only update UI every 100ms to prevent performance issues

                try {
                    // Consume with real-time streaming
                    await clientManager.consumeMessages(
                        node.clusterName,
                        node.topicName,
                        fromBeginning === 'Beginning',
                        limit,
                        token,
                        (message, count) => {
                            try {
                                // Update progress
                                progress.report({
                                    message: `Received ${count}/${limit} messages`,
                                    increment: (100 / limit)
                                });

                                // Add message to array
                                messages.push(message);

                                // Throttle UI updates to prevent performance issues
                                const now = Date.now();
                                if (now - lastUpdateTime >= UPDATE_THROTTLE_MS || count === limit) {
                                    lastUpdateTime = now;

                                    // Update the document content in real-time (with error handling)
                                    editor.edit(editBuilder => {
                                        try {
                                            editBuilder.replace(
                                                new vscode.Range(0, 0, document.lineCount, 0),
                                                `# Consuming from topic: ${node.topicName}\n# Received ${count}/${limit} messages\n\n${formatMessages(messages)}`
                                            );
                                        } catch (err) {
                                            console.error('Failed to update document:', err);
                                        }
                                    }).then(undefined, err => {
                                        console.error('Editor.edit failed:', err);
                                    });
                                }
                            } catch (err) {
                                console.error('Error in message callback:', err);
                            }
                        }
                    );
                } catch (error) {
                    // Update document with error message
                    editor.edit(editBuilder => {
                        editBuilder.replace(
                            new vscode.Range(0, 0, document.lineCount, 0),
                            `# Consuming from topic: ${node.topicName}\n# Error: ${error}\n\n${messages.length > 0 ? formatMessages(messages) : 'No messages received before error.'}`
                        );
                    });
                    throw error;
                }
            }
        );
        },
        `Consuming messages from topic "${node.topicName}"`
    );
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
            const detailsView = new DetailsWebview(context, `Topic: ${node.topicName}`, '📋');

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
                showAIAdvisor: true,
                notice: {
                    type: 'info',
                    text: '🤖 Try the AI Advisor for intelligent configuration recommendations! ✏️ Edit mode coming soon.'
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
                                    config.configSource || config.source || 'default'
                                ])
                                : []
                        }
                    }
                ]
            };

            // Set up AI request handler
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

            detailsView.show(data);
        },
        `Loading details for topic "${node.topicName}"`
    );
}

/**
 * Find/search for a topic across all clusters
 */
export async function findTopic(clientManager: KafkaClientManager) {
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
                // Show topic details
                await showTopicDetails(clientManager, {
                    clusterName: selectedCluster,
                    topicName: selectedTopic.label
                });
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
        const detailsView = new DetailsWebview(context, `ACL Details`, '🔒');
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
