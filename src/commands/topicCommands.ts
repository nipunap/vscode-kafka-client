/**
 * Command handlers for Kafka topic operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { KafkaExplorerProvider } from '../providers/kafkaExplorerProvider';
import { formatMessages, formatTopicDetailsYaml } from '../utils/formatters';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { TopicDashboardWebview } from '../views/topicDashboardWebview';

export async function createTopic(
    clientManager: KafkaClientManager,
    provider: KafkaExplorerProvider,
    node: any
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
    node: any
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

export async function produceMessage(clientManager: KafkaClientManager, node: any) {
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

export async function consumeMessages(clientManager: KafkaClientManager, node: any) {
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

export async function showTopicDetails(clientManager: KafkaClientManager, node: any) {
    await ErrorHandler.wrap(
        async () => {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading details for topic "${node.topicName}"`,
                    cancellable: false
                },
                async (_progress) => {
                    const details = await clientManager.getTopicDetails(
                        node.clusterName,
                        node.topicName
                    );

                    // Format the details nicely
                    const formattedDetails = formatTopicDetailsYaml(details);

                    const document = await vscode.workspace.openTextDocument({
                        content: formattedDetails,
                        language: 'yaml'
                    });
                    await vscode.window.showTextDocument(document);
                }
            );
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
    node: any
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
