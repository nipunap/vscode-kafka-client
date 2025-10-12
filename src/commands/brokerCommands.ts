/**
 * Command handlers for Kafka broker operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { DetailsWebview, DetailsData } from '../views/DetailsWebview';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { AIAdvisor } from '../services/AIAdvisor';
import { ConfigSourceMapper } from '../utils/configSourceMapper';

export async function showBrokerDetails(clientManager: KafkaClientManager, node: any, context?: vscode.ExtensionContext) {
    await ErrorHandler.wrap(async () => {
        const details = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Loading details for broker ${node.brokerId}`,
                cancellable: false
            },
            async (_progress) => {
                return await clientManager.getBrokerDetails(
                    node.clusterName,
                    node.brokerId
                );
            }
        );

        // If no context provided, fall back to text document
        if (!context) {
            const { formatBrokerDetailsYaml } = await import('../utils/formatters');
            const formattedDetails = formatBrokerDetailsYaml(details);
            const document = await vscode.workspace.openTextDocument({
                content: formattedDetails,
                language: 'yaml'
            });
            await vscode.window.showTextDocument(document);
            return;
        }

        // Create HTML view
        const detailsView = new DetailsWebview(`Broker: ${node.brokerId}`, '🖥️');

        // Check if AI features are available
        const aiAvailable = await AIAdvisor.checkAvailability();

        const data: DetailsData = {
            title: `Broker ${node.brokerId}`,
            showCopyButton: true,
            showRefreshButton: false,
            showAIAdvisor: aiAvailable,
            notice: {
                type: 'info',
                text: aiAvailable
                    ? '🤖 Try the AI Advisor for broker optimization recommendations! ✏️ Edit mode coming soon.'
                    : '✏️ Edit mode coming soon! You\'ll be able to modify broker configurations directly from this view.'
            },
            sections: [
                {
                    title: 'Overview',
                    icon: '📊',
                    properties: [
                        { label: 'Broker ID', value: String(details.nodeId ?? node.brokerId) },
                        { label: 'Host', value: details.host || 'N/A', code: true },
                        { label: 'Port', value: String(details.port || 'N/A') },
                        { label: 'Rack', value: details.rack || 'Not configured' },
                        { label: 'Cluster', value: node.clusterName, code: true }
                    ]
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
                const recommendations = await AIAdvisor.analyzeBrokerConfiguration({
                    nodeId: details.nodeId ?? node.brokerId,
                    host: details.host || 'N/A',
                    port: details.port || 0,
                    configurations: details.configuration || []
                });
                detailsView.updateWithAIRecommendations(recommendations);
            });
        }

        detailsView.show(data);
    }, `Loading broker details for broker ${node.brokerId}`);
}

/**
 * Find/search for a broker across all clusters
 */
export async function findBroker(clientManager: KafkaClientManager) {
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
                placeHolder: 'Select cluster to search brokers',
                ignoreFocusOut: true
            });
            if (!clusterChoice) {
                return;
            }
            selectedCluster = clusterChoice;
        }

        // Get all brokers with timeout
        const brokers = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Loading brokers from ${selectedCluster}...`,
                cancellable: true
            },
            async (_progress, token) => {
                // Add cancellation support
                if (token.isCancellationRequested) {
                    return [];
                }

                try {
                    const result = await clientManager.getBrokers(selectedCluster);
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

        if (!brokers || brokers.length === 0) {
            vscode.window.showInformationMessage(`No brokers found in cluster "${selectedCluster}"`);
            return;
        }

        // Show searchable list
        const selectedBroker = await vscode.window.showQuickPick(
            brokers.map(broker => ({
                label: `Broker ${broker.nodeId}`,
                description: `${broker.host}:${broker.port}`,
                detail: `Rack: ${broker.rack || 'N/A'}`,
                broker: broker
            })),
            {
                placeHolder: `Search brokers in ${selectedCluster} (${brokers.length} total)`,
                matchOnDescription: true,
                ignoreFocusOut: true
            }
        );

        if (selectedBroker) {
            // Show broker details
            await showBrokerDetails(clientManager, {
                clusterName: selectedCluster,
                brokerId: selectedBroker.broker.nodeId
            });
        }
    } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to search brokers: ${errorMsg}`);
    }
}
