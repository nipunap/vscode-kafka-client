/**
 * Command handlers for Kafka topic operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { KafkaExplorerProvider } from '../providers/kafkaExplorerProvider';
import { formatMessages, formatTopicDetailsYaml } from '../utils/formatters';

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

    try {
        await clientManager.createTopic(
            node.clusterName,
            topicName,
            Number(partitions),
            Number(replicationFactor)
        );
        provider.refresh();
        vscode.window.showInformationMessage(`✓ Topic "${topicName}" created successfully!`);
    } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';

        if (errorMsg.includes('expired') || errorMsg.includes('credentials')) {
            vscode.window.showErrorMessage(
                `⚠️ AWS credentials expired. Please reconnect the cluster with fresh credentials.`,
                'Reconnect'
            ).then(selection => {
                if (selection === 'Reconnect') {
                    vscode.commands.executeCommand('kafka.addCluster');
                }
            });
        } else if (errorMsg.includes('replication') || errorMsg.includes('INVALID_REPLICATION_FACTOR')) {
            vscode.window.showErrorMessage(
                `Failed to create topic: ${errorMsg}. Try using replication factor = 1 for single-broker setups.`
            );
        } else if (errorMsg.includes('already exists') || errorMsg.includes('TOPIC_ALREADY_EXISTS')) {
            vscode.window.showWarningMessage(`Topic "${topicName}" already exists in the cluster`);
        } else if (errorMsg.includes('authorization') || errorMsg.includes('AUTHORIZATION_FAILED')) {
            vscode.window.showErrorMessage(
                `Access denied: ${errorMsg}. Check if you have permission to create topics.`
            );
        } else {
            vscode.window.showErrorMessage(`Failed to create topic: ${errorMsg}`);
        }
        console.error('Topic creation error:', error);
    }
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
        try {
            await clientManager.deleteTopic(node.clusterName, node.topicName);
            provider.refresh();
            vscode.window.showInformationMessage(`✓ Topic "${node.label}" deleted successfully.`);
        } catch (error: any) {
            const errorMsg = error?.message || error?.toString() || 'Unknown error';

            if (errorMsg.includes('expired') || errorMsg.includes('credentials')) {
                vscode.window.showErrorMessage(
                    `⚠️ AWS credentials expired. Please reconnect the cluster.`,
                    'Reconnect'
                ).then(selection => {
                    if (selection === 'Reconnect') {
                        vscode.commands.executeCommand('kafka.addCluster');
                    }
                });
            } else if (errorMsg.includes('not found') || errorMsg.includes('UnknownTopicOrPartition')) {
                vscode.window.showWarningMessage(
                    `Topic "${node.label}" not found. It may have been already deleted.`,
                    'Refresh'
                ).then(selection => {
                    if (selection === 'Refresh') {
                        provider.refresh();
                    }
                });
            } else {
                vscode.window.showErrorMessage(`Failed to delete topic: ${errorMsg}`);
            }
        }
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

    try {
        await clientManager.produceMessage(node.clusterName, node.topicName, key, value);
        vscode.window.showInformationMessage(`Message sent to topic "${node.topicName}"`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to produce message: ${error}`);
    }
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

    try {
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
    } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to consume messages: ${errorMsg}`);
    }
}

export async function showTopicDetails(clientManager: KafkaClientManager, node: any) {
    try {
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
    } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';

        if (errorMsg.includes('expired') || errorMsg.includes('credentials')) {
            vscode.window.showErrorMessage(
                `⚠️ AWS credentials expired. Please reconnect the cluster.`,
                'Reconnect'
            ).then(selection => {
                if (selection === 'Reconnect') {
                    vscode.commands.executeCommand('kafka.addCluster');
                }
            });
        } else {
            vscode.window.showErrorMessage(`Failed to get topic details: ${errorMsg}`);
        }
    }
}

/**
 * Find/search for a topic across all clusters
 */
export async function findTopic(clientManager: KafkaClientManager) {
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

                try {
                    const result = await clientManager.getTopics(selectedCluster);
                    return result || [];
                } catch (error: any) {
                    // Provide more specific error messages
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
    } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to search topics: ${errorMsg}`);
    }
}
