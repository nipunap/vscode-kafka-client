/**
 * Command handlers for Kafka consumer group operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { DetailsWebview, DetailsData } from '../views/DetailsWebview';
import { ErrorHandler } from '../infrastructure/ErrorHandler';

export async function showConsumerGroupDetails(clientManager: KafkaClientManager, node: any, context?: vscode.ExtensionContext) {
    await ErrorHandler.wrap(async () => {
        const details = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Loading details for consumer group "${node.groupId}"`,
                cancellable: false
            },
            async (_progress) => {
                return await clientManager.getConsumerGroupDetails(
                    node.clusterName,
                    node.groupId
                );
            }
        );

        // If no context provided, fall back to text document
        if (!context) {
            const { formatConsumerGroupDetailsYaml } = await import('../utils/formatters');
            const formattedDetails = formatConsumerGroupDetailsYaml(details);
            const document = await vscode.workspace.openTextDocument({
                content: formattedDetails,
                language: 'yaml'
            });
            await vscode.window.showTextDocument(document);
            return;
        }

        // Create HTML view
        const detailsView = new DetailsWebview(context, `Consumer Group: ${node.groupId}`, '👥');

        // Get state badge
        const getStateBadge = (state: string) => {
            const stateUpper = state.toUpperCase();
            if (stateUpper === 'STABLE') return { type: 'success' as const, text: 'STABLE' };
            if (stateUpper === 'EMPTY') return { type: 'warning' as const, text: 'EMPTY' };
            if (stateUpper === 'DEAD') return { type: 'danger' as const, text: 'DEAD' };
            return { type: 'info' as const, text: stateUpper };
        };

        const data: DetailsData = {
            title: node.groupId,
            showCopyButton: true,
            showRefreshButton: false,
            notice: {
                type: 'info',
                text: '✏️ Edit mode coming soon! You\'ll be able to reset offsets and modify group settings directly from this view.'
            },
            sections: [
                {
                    title: 'Overview',
                    icon: '📊',
                    properties: [
                        { label: 'Group ID', value: details.groupId || node.groupId, code: true },
                        {
                            label: 'State',
                            value: details.state || 'Unknown',
                            badge: getStateBadge(details.state || 'Unknown')
                        },
                        { label: 'Protocol Type', value: details.protocolType || 'N/A' },
                        { label: 'Protocol', value: details.protocol || 'N/A' },
                        { label: 'Coordinator', value: `Broker ${details.coordinator?.id || 'N/A'}` }
                    ]
                },
                {
                    title: 'Members',
                    icon: '👤',
                    table: details.members && details.members.length > 0 ? {
                        headers: ['Member ID', 'Client ID', 'Host'],
                        rows: details.members.map((member: any) => [
                            member.memberId || 'N/A',
                            member.clientId || 'N/A',
                            member.clientHost || 'N/A'
                        ])
                    } : undefined,
                    html: (!details.members || details.members.length === 0)
                        ? '<div class="empty-state">No active members</div>'
                        : undefined
                },
                {
                    title: 'Partition Offsets',
                    icon: '📍',
                    table: details.offsets && details.offsets.length > 0 ? {
                        headers: ['Topic', 'Partition', 'Current Offset', 'Log End Offset', 'Lag'],
                        rows: details.offsets.map((offset: any) => {
                            const lag = offset.lag !== undefined ? offset.lag :
                                       (offset.logEndOffset && offset.offset) ? offset.logEndOffset - offset.offset : 'N/A';
                            return [
                                offset.topic || 'N/A',
                                String(offset.partition || 0),
                                offset.offset !== undefined ? offset.offset.toLocaleString() : 'N/A',
                                offset.logEndOffset !== undefined ? offset.logEndOffset.toLocaleString() : 'N/A',
                                typeof lag === 'number' ? lag.toLocaleString() : lag
                            ];
                        })
                    } : undefined,
                    html: (!details.offsets || details.offsets.length === 0)
                        ? '<div class="empty-state">No offset information available</div>'
                        : undefined
                }
            ]
        };

        detailsView.show(data);
    }, `Loading consumer group details for "${node.groupId}"`);
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
            async (_progress, token) => {
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
