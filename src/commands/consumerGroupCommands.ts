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
        const detailsView = new DetailsWebview(`Consumer Group: ${node.groupId}`, '👥', context);

        // Get state badge
        const getStateBadge = (state: string) => {
            const stateUpper = state.toUpperCase();
            if (stateUpper === 'STABLE') { return { type: 'success' as const, text: 'STABLE' }; }
            if (stateUpper === 'EMPTY') { return { type: 'warning' as const, text: 'EMPTY' }; }
            if (stateUpper === 'DEAD') { return { type: 'danger' as const, text: 'DEAD' }; }
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
                        { label: 'Coordinator', value: `Broker ${details.coordinator?.id || 'N/A'}` },
                        { label: 'Total Lag', value: details.totalLag !== undefined ? details.totalLag.toLocaleString() : 'N/A' },
                        { label: 'Active Members', value: String(details.members?.length || 0) },
                        { label: 'Cluster', value: node.clusterName, code: true }
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
                    title: 'Partition Offsets & Lag',
                    icon: '📍',
                    table: details.offsets && details.offsets.length > 0 ? {
                        headers: ['Topic', 'Partition', 'Current Offset', 'High Watermark', 'Lag'],
                        rows: details.offsets.map((offset: any) => {
                            // Support both field names for compatibility
                            const currentOffset = offset.currentOffset || offset.offset;
                            const highWatermark = offset.highWaterMark || offset.logEndOffset;
                            const lag = offset.lag !== undefined ? offset.lag :
                                       (highWatermark !== undefined && currentOffset !== undefined)
                                       ? (typeof highWatermark === 'string' ? parseInt(highWatermark) : highWatermark) -
                                         (typeof currentOffset === 'string' ? parseInt(currentOffset) : currentOffset)
                                       : 'N/A';
                            return [
                                offset.topic || 'N/A',
                                String(offset.partition ?? 0),
                                currentOffset !== undefined ?
                                    (typeof currentOffset === 'string' ? parseInt(currentOffset).toLocaleString() : currentOffset.toLocaleString())
                                    : 'N/A',
                                highWatermark !== undefined ?
                                    (typeof highWatermark === 'string' ? parseInt(highWatermark).toLocaleString() : highWatermark.toLocaleString())
                                    : 'N/A',
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

        detailsView.showDetails(data);
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
export async function findConsumerGroup(
    clientManager: KafkaClientManager,
    treeView: vscode.TreeView<any>,
    provider: any,
    context?: vscode.ExtensionContext
) {
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

        // Sort consumer groups alphabetically for search menu
        groups.sort((a, b) => a.groupId.localeCompare(b.groupId));

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
            // Reveal and focus the consumer group in the tree view
            try {
                const children = await provider.getChildren();
                const clusterNode = children.find((node: any) => node.label === selectedCluster);

                if (clusterNode) {
                    // First, reveal and expand the cluster to ensure groups are loaded
                    await treeView.reveal(clusterNode, { select: false, focus: false, expand: 1 });

                    // Wait for the tree to expand and load groups
                    await new Promise(resolve => setTimeout(resolve, 300));

                    const groupNodes = await provider.getChildren(clusterNode);
                    const groupNode = groupNodes.find((node: any) => node.label === selectedGroup.label);

                    if (groupNode) {
                        await treeView.reveal(groupNode, { select: true, focus: true, expand: false });
                    } else {
                        console.warn(`Consumer group node not found for: ${selectedGroup.label}`);
                    }
                }
            } catch (error) {
                console.error('Failed to reveal consumer group in tree view:', error);
            }

            // Show consumer group details with HTML webview
            await showConsumerGroupDetails(clientManager, {
                clusterName: selectedCluster,
                groupId: selectedGroup.label
            }, context);
        }
    } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to search consumer groups: ${errorMsg}`);
    }
}

/**
 * Export all consumer groups from a cluster to a file
 */
export async function exportConsumerGroups(clientManager: KafkaClientManager, node: any) {
    await ErrorHandler.wrap(
        async () => {
            // Get format choice
            const format = await vscode.window.showQuickPick(
                [
                    { label: 'JSON', description: 'Export as JSON format with full details', value: 'json' },
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

            // Get consumer groups with progress
            const groups = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading consumer groups from ${node.clusterName}...`,
                    cancellable: false
                },
                async () => {
                    return await clientManager.getConsumerGroups(node.clusterName);
                }
            );

            if (!groups || groups.length === 0) {
                vscode.window.showInformationMessage(`No consumer groups found in cluster "${node.clusterName}"`);
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
                        consumerGroupCount: groups.length,
                        consumerGroups: groups.map(g => ({
                            groupId: g.groupId,
                            state: g.state || 'Unknown',
                            protocolType: g.protocolType || 'N/A',
                            protocol: g.protocol || 'N/A'
                        }))
                    }, null, 2);
                    fileExtension = 'json';
                    break;
                case 'csv':
                    content = `Cluster,Group ID,State,Protocol Type,Protocol\n`;
                    content += groups.map(g =>
                        `"${node.clusterName}","${g.groupId}","${g.state || 'Unknown'}","${g.protocolType || 'N/A'}","${g.protocol || 'N/A'}"`
                    ).join('\n');
                    fileExtension = 'csv';
                    break;
                default: // txt
                    content = `Cluster: ${node.clusterName}\n`;
                    content += `Export Date: ${new Date().toISOString()}\n`;
                    content += `Total Consumer Groups: ${groups.length}\n\n`;
                    content += groups.map(g =>
                        `${g.groupId} (State: ${g.state || 'Unknown'})`
                    ).join('\n');
                    fileExtension = 'txt';
            }

            // Save file
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${node.clusterName}-consumer-groups-${Date.now()}.${fileExtension}`),
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
                    `Exported ${groups.length} consumer groups to ${uri.fsPath}`,
                    'Open File'
                );
                if (action === 'Open File') {
                    await vscode.window.showTextDocument(uri);
                }
            }
        },
        `Exporting consumer groups from cluster "${node.clusterName}"`
    );
}
