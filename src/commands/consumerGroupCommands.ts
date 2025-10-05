/**
 * Command handlers for Kafka consumer group operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { formatConsumerGroupDetailsYaml } from '../utils/formatters';

export async function showConsumerGroupDetails(clientManager: KafkaClientManager, node: any) {
    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Loading details for consumer group "${node.groupId}"`,
                cancellable: false
            },
            async (progress) => {
                const details = await clientManager.getConsumerGroupDetails(
                    node.clusterName,
                    node.groupId
                );

                // Format the details nicely
                const formattedDetails = formatConsumerGroupDetailsYaml(details);

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
        } else if (errorMsg.includes('COORDINATOR_NOT_AVAILABLE') || errorMsg.includes('not found')) {
            vscode.window.showWarningMessage(
                `Consumer group "${node.groupId}" not found or coordinator unavailable.`,
                'Refresh'
            ).then(selection => {
                if (selection === 'Refresh') {
                    vscode.commands.executeCommand('kafka.refreshCluster', node);
                }
            });
        } else {
            vscode.window.showErrorMessage(`Failed to get consumer group details: ${errorMsg}`);
        }
    }
}

export async function deleteConsumerGroup(
    clientManager: KafkaClientManager,
    provider: any,
    node: any
) {
    const confirm = await vscode.window.showWarningMessage(
        `Delete consumer group "${node.groupId}"? This action cannot be undone.`,
        { modal: true },
        'Yes',
        'No'
    );

    if (confirm === 'Yes') {
        try {
            await clientManager.deleteConsumerGroup(node.clusterName, node.groupId);
            provider.refresh();
            vscode.window.showInformationMessage(`✓ Consumer group "${node.groupId}" deleted successfully.`);
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
            } else if (errorMsg.includes('GROUP_SUBSCRIBED_TO_TOPIC') || errorMsg.includes('active members')) {
                vscode.window.showErrorMessage(
                    `Cannot delete consumer group "${node.groupId}": Group has active members. Stop all consumers first.`
                );
            } else if (errorMsg.includes('COORDINATOR_NOT_AVAILABLE') || errorMsg.includes('not found')) {
                vscode.window.showWarningMessage(
                    `Consumer group "${node.groupId}" not found or coordinator unavailable.`,
                    'Refresh'
                ).then(selection => {
                    if (selection === 'Refresh') {
                        provider.refresh();
                    }
                });
            } else {
                vscode.window.showErrorMessage(`Failed to delete consumer group: ${errorMsg}`);
            }
        }
    }
}

export async function resetConsumerGroupOffsets(clientManager: KafkaClientManager, node: any) {
    // Ask for topic
    const topicInput = await vscode.window.showInputBox({
        prompt: 'Enter topic name (leave empty to reset all topics)',
        placeHolder: 'my-topic'
    });

    if (topicInput === undefined) {
        return; // User cancelled
    }

    // Ask for reset strategy
    const resetOption = await vscode.window.showQuickPick(
        [
            { label: 'Beginning', description: 'Reset to earliest offset' },
            { label: 'End', description: 'Reset to latest offset' },
            { label: 'Specific Offset', description: 'Reset to a specific offset' }
        ],
        { placeHolder: 'Select reset strategy' }
    );

    if (!resetOption) {
        return;
    }

    let offset: string | undefined;
    if (resetOption.label === 'Specific Offset') {
        offset = await vscode.window.showInputBox({
            prompt: 'Enter offset value',
            placeHolder: '0',
            validateInput: (value) => {
                return isNaN(Number(value)) ? 'Must be a number' : undefined;
            }
        });
        if (!offset) {
            return;
        }
    }

    const confirm = await vscode.window.showWarningMessage(
        `Reset offsets for consumer group "${node.groupId}"${topicInput ? ` on topic "${topicInput}"` : ' on all topics'} to ${resetOption.label}?`,
        { modal: true },
        'Yes',
        'No'
    );

    if (confirm === 'Yes') {
        try {
            await clientManager.resetConsumerGroupOffsets(
                node.clusterName,
                node.groupId,
                topicInput || undefined,
                resetOption.label.toLowerCase(),
                offset
            );
            vscode.window.showInformationMessage(
                `✓ Offsets reset successfully for consumer group "${node.groupId}"`
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
            } else if (errorMsg.includes('GROUP_SUBSCRIBED_TO_TOPIC') || errorMsg.includes('active members')) {
                vscode.window.showErrorMessage(
                    `Cannot reset offsets for consumer group "${node.groupId}": Group has active members. Stop all consumers first.`
                );
            } else if (errorMsg.includes('COORDINATOR_NOT_AVAILABLE') || errorMsg.includes('not found')) {
                vscode.window.showWarningMessage(
                    `Consumer group "${node.groupId}" not found or coordinator unavailable.`,
                    'Refresh'
                ).then(selection => {
                    if (selection === 'Refresh') {
                        vscode.commands.executeCommand('kafka.refreshCluster', node);
                    }
                });
            } else {
                vscode.window.showErrorMessage(`Failed to reset offsets: ${errorMsg}`);
            }
        }
    }
}

/**
 * Find/search for a consumer group across all clusters
 */
export async function findConsumerGroup(clientManager: KafkaClientManager) {
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
                placeHolder: 'Select cluster to search consumer groups',
                ignoreFocusOut: true
            });
            if (!clusterChoice) {
                return;
            }
            selectedCluster = clusterChoice;
        }

        // Get all consumer groups with cancellation support
        const groups = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Loading consumer groups from ${selectedCluster}...`,
                cancellable: true
            },
            async (progress, token) => {
                // Add cancellation support
                if (token.isCancellationRequested) {
                    return [];
                }

                try {
                    const result = await clientManager.getConsumerGroups(selectedCluster);
                    return result || [];
                } catch (error: any) {
                    // Provide more specific error messages
                    const errorMsg = error?.message || error?.toString() || 'Unknown error';
                    if (errorMsg.includes('expired') || errorMsg.includes('credentials')) {
                        throw new Error('AWS credentials expired. Please reconnect the cluster.');
                    } else if (errorMsg.includes('timeout')) {
                        throw new Error('Connection timeout. Check that the cluster is accessible.');
                    } else if (errorMsg.includes('COORDINATOR_NOT_AVAILABLE')) {
                        throw new Error('Consumer group coordinator not available. The cluster may be initializing.');
                    } else {
                        throw error;
                    }
                }
            }
        );

        if (!groups || groups.length === 0) {
            vscode.window.showInformationMessage(`No consumer groups found in cluster "${selectedCluster}"`);
            return;
        }

        // Show searchable list with fuzzy matching
        const selectedGroup = await vscode.window.showQuickPick(
            groups.map(group => ({
                label: group.groupId,
                description: `Cluster: ${selectedCluster}`,
                detail: `State: ${group.state || 'Unknown'}`,
                group: group
            })),
            {
                placeHolder: `Search consumer groups in ${selectedCluster} (${groups.length} total)`,
                matchOnDescription: true,
                matchOnDetail: true,
                ignoreFocusOut: true
            }
        );

        if (selectedGroup) {
            // Show consumer group details
            await showConsumerGroupDetails(clientManager, {
                clusterName: selectedCluster,
                groupId: selectedGroup.label
            });
        }
    } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to search consumer groups: ${errorMsg}`);
    }
}
