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
    const fromBeginning = await vscode.window.showQuickPick(['Latest', 'Beginning'], {
        placeHolder: 'Consume from?'
    });

    if (!fromBeginning) {
        return;
    }

    const limit = await vscode.window.showInputBox({
        prompt: 'Number of messages to consume',
        value: '10',
        validateInput: (value) => {
            return isNaN(Number(value)) ? 'Must be a number' : undefined;
        }
    });

    if (!limit) {
        return;
    }

    try {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Consuming messages from ${node.topicName}`,
                cancellable: true
            },
            async (progress, token) => {
                const messages = await clientManager.consumeMessages(
                    node.clusterName,
                    node.topicName,
                    fromBeginning === 'Beginning',
                    Number(limit),
                    token
                );

                // Display messages in a new document
                const document = await vscode.workspace.openTextDocument({
                    content: formatMessages(messages),
                    language: 'json'
                });
                await vscode.window.showTextDocument(document);
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to consume messages: ${error}`);
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
            async (progress) => {
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

