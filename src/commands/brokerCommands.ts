/**
 * Command handlers for Kafka broker operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { DetailsWebview, DetailsData } from '../views/DetailsWebview';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { AIAdvisor } from '../services/AIAdvisor';
import { ConfigSourceMapper } from '../utils/configSourceMapper';
import { ConfigurationEditorService } from '../services/ConfigurationEditorService';
import { AuditLog, AuditOperation } from '../infrastructure/AuditLog';

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
        const detailsView = new DetailsWebview(`Broker: ${node.brokerId}`, '🖥️', context);

        // Check if AI features are available
        const aiAvailable = await AIAdvisor.checkAvailability();

        const data: DetailsData = {
            title: `Broker ${node.brokerId}`,
            showCopyButton: true,
            showRefreshButton: false,
            showAIAdvisor: aiAvailable,
            notice: aiAvailable ? {
                type: 'info',
                text: '🤖 Try the AI Advisor for broker optimization recommendations!'
            } : undefined,
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

        detailsView.showDetails(data);
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

export async function editBrokerConfig(
    clientManager: KafkaClientManager,
    node: any
) {
    const configService = new ConfigurationEditorService();

    await ErrorHandler.wrap(
        async () => {
            const admin = await clientManager.getAdminClient(node.clusterName);
            const brokerId = String(node.brokerId);

            // Get current configuration
            const currentConfigs = await configService.getBrokerConfig(admin, brokerId);

            // Filter to only editable configs
            const editableConfigs = currentConfigs.filter(c => !configService.isReadOnlyConfig(c));

            if (editableConfigs.length === 0) {
                vscode.window.showWarningMessage('No editable configurations found for this broker');
                return;
            }

            // Show quick pick with config names
            const selectedConfig = await vscode.window.showQuickPick(
                editableConfigs.map(c => ({
                    label: c.configName,
                    description: c.configValue || '(not set)',
                    detail: configService.requiresBrokerRestart(c.configName)
                        ? '⚠️ Requires broker restart'
                        : c.isDefault
                            ? 'Default value'
                            : 'Custom value',
                    config: c
                })),
                {
                    placeHolder: 'Select configuration to edit',
                    matchOnDescription: true,
                    matchOnDetail: true
                }
            );

            if (!selectedConfig) {
                return;
            }

            // Prompt for new value
            const newValue = await vscode.window.showInputBox({
                prompt: `Edit configuration: ${selectedConfig.label}`,
                value: selectedConfig.config.configValue || '',
                placeHolder: 'Enter new value',
                validateInput: (value) => {
                    try {
                        if (!value.trim()) {
                            return 'Value cannot be empty';
                        }
                        configService.validateConfigValue(selectedConfig.label, value);
                        return undefined;
                    } catch (error: unknown) {
                        return (error as Error).message;
                    }
                }
            });

            if (!newValue) {
                return;
            }

            // Build confirmation message
            let confirmMessage = `Update configuration for broker ${brokerId}?\n\n` +
                `Config: ${selectedConfig.label}\n` +
                `Current: ${selectedConfig.config.configValue || '(not set)'}\n` +
                `New: ${newValue}`;

            if (configService.requiresBrokerRestart(selectedConfig.label)) {
                confirmMessage += '\n\n⚠️ WARNING: This configuration requires a broker restart to take effect!';
            }

            // Confirm change
            const confirm = await vscode.window.showWarningMessage(
                confirmMessage,
                'Update Config',
                'Cancel'
            );

            if (confirm !== 'Update Config') {
                return;
            }

            // Apply configuration
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Updating configuration for broker ${brokerId}`,
                    cancellable: false
                },
                async () => {
                    await configService.alterBrokerConfig(admin, brokerId, [
                        { name: selectedConfig.label, value: newValue }
                    ]);
                }
            );

            // Audit log
            AuditLog.success(
                AuditOperation.BROKER_CONFIG_UPDATED,
                node.clusterName,
                `broker-${brokerId}`,
                { 
                    configName: selectedConfig.label, 
                    oldValue: selectedConfig.config.configValue, 
                    newValue,
                    requiresRestart: configService.requiresBrokerRestart(selectedConfig.label)
                }
            );

            let successMessage = `✓ Configuration "${selectedConfig.label}" updated successfully for broker ${brokerId}`;
            if (configService.requiresBrokerRestart(selectedConfig.label)) {
                successMessage += '\n⚠️ Broker restart required for changes to take effect';
            }

            vscode.window.showInformationMessage(successMessage);
        },
        `Editing configuration for broker ${node.brokerId}`
    );
}
