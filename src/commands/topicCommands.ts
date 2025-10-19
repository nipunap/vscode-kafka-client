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
import { PartitionService } from '../services/PartitionService';
import { ConfigurationEditorService } from '../services/ConfigurationEditorService';
import { AuditLog, AuditOperation } from '../infrastructure/AuditLog';

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

export async function addPartitions(
    clientManager: KafkaClientManager,
    provider: KafkaExplorerProvider,
    node: TopicNode
) {
    const partitionService = new PartitionService();

    await ErrorHandler.wrap(
        async () => {
            // Get current partition count
            const admin = await clientManager.getAdminClient(node.clusterName);
            const currentCount = await partitionService.getCurrentPartitionCount(admin, node.topicName);

            // Prompt for new partition count
            const newCountStr = await vscode.window.showInputBox({
                prompt: `Current partition count: ${currentCount}. Enter new partition count`,
                placeHolder: `Greater than ${currentCount}`,
                validateInput: (value) => {
                    const num = Number(value);
                    if (isNaN(num)) {
                        return 'Must be a number';
                    }
                    if (num <= currentCount) {
                        return `Must be greater than current count (${currentCount})`;
                    }
                    if (num > 10000) {
                        return 'Partition count should not exceed 10000';
                    }
                    return undefined;
                }
            });

            if (!newCountStr) {
                return;
            }

            const newCount = Number(newCountStr);

            // Validate
            partitionService.validatePartitionCount(currentCount, newCount);

            // Confirm action
            const confirm = await vscode.window.showWarningMessage(
                `Add ${newCount - currentCount} new partition(s) to topic "${node.topicName}"?\n\n` +
                `Current: ${currentCount} → New: ${newCount}\n\n` +
                `⚠️ Warning: This will trigger consumer group rebalancing and cannot be undone.`,
                'Add Partitions',
                'Cancel'
            );

            if (confirm !== 'Add Partitions') {
                return;
            }

            // Add partitions
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Adding partitions to topic "${node.topicName}"`,
                    cancellable: false
                },
                async () => {
                    await partitionService.addPartitions(admin, node.topicName, newCount);
                }
            );

            // Audit log
            AuditLog.success(
                AuditOperation.TOPIC_PARTITIONS_ADDED,
                node.clusterName,
                node.topicName,
                { previousCount: currentCount, newCount, addedCount: newCount - currentCount }
            );

            provider.refresh();
            vscode.window.showInformationMessage(
                `✓ Successfully added ${newCount - currentCount} partition(s) to topic "${node.topicName}"`
            );
        },
        `Adding partitions to topic "${node.topicName}"`
    );
}

export async function editTopicConfig(
    clientManager: KafkaClientManager,
    provider: KafkaExplorerProvider,
    node: TopicNode
) {
    const configService = new ConfigurationEditorService();

    await ErrorHandler.wrap(
        async () => {
            const admin = await clientManager.getAdminClient(node.clusterName);

            // Get current configuration
            const currentConfigs = await configService.getTopicConfig(admin, node.topicName);

            // Filter to only editable configs
            const editableConfigs = currentConfigs.filter(c => !configService.isReadOnlyConfig(c));

            if (editableConfigs.length === 0) {
                vscode.window.showWarningMessage('No editable configurations found for this topic');
                return;
            }

            // Show quick pick with config names
            const selectedConfig = await vscode.window.showQuickPick(
                editableConfigs.map(c => ({
                    label: c.configName,
                    description: c.configValue || '(not set)',
                    detail: c.isDefault ? 'Default value' : 'Custom value',
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

            // Confirm change
            const confirm = await vscode.window.showWarningMessage(
                `Update configuration for topic "${node.topicName}"?\n\n` +
                `Config: ${selectedConfig.label}\n` +
                `Current: ${selectedConfig.config.configValue || '(not set)'}\n` +
                `New: ${newValue}`,
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
                    title: `Updating configuration for topic "${node.topicName}"`,
                    cancellable: false
                },
                async () => {
                    await configService.alterTopicConfig(admin, node.topicName, [
                        { name: selectedConfig.label, value: newValue }
                    ]);
                }
            );

            // Audit log
            AuditLog.success(
                AuditOperation.TOPIC_CONFIG_UPDATED,
                node.clusterName,
                node.topicName,
                { configName: selectedConfig.label, oldValue: selectedConfig.config.configValue, newValue }
            );

            provider.refresh();
            vscode.window.showInformationMessage(
                `✓ Configuration "${selectedConfig.label}" updated successfully for topic "${node.topicName}"`
            );
        },
        `Editing configuration for topic "${node.topicName}"`
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
            const detailsView = new DetailsWebview(`Topic: ${node.topicName}`, '📋', context);

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

            // Try to fetch schema information
            let schemaSection = null;
            try {
                const { SchemaRegistryService } = await import('../services/SchemaRegistryService');
                const config = vscode.workspace.getConfiguration('kafka');
                const schemaRegistryUrl = config.get<string>('schemaRegistry.url');
                
                if (schemaRegistryUrl && context) {
                    const { CredentialManager } = await import('../infrastructure/CredentialManager');
                    const credentialManager = new CredentialManager(context.secrets);
                    const schemaService = new SchemaRegistryService(
                        { url: schemaRegistryUrl },
                        credentialManager,
                        node.clusterName
                    );

                    // Check if schema registry is available
                    const isAvailable = await schemaService.isAvailable();
                    
                    if (isAvailable) {
                        // Try to get schema for value subject (most common)
                        const valueSubject = `${node.topicName}-value`;
                        try {
                            const schema = await schemaService.getLatestSchema(valueSubject);
                            const schemaObj = JSON.parse(schema.schema);
                            
                            const schemaJson = JSON.stringify(schemaObj, null, 2);
                            schemaSection = {
                                title: 'Schema (Value)',
                                icon: '📝',
                                properties: [
                                    { label: 'Subject', value: schema.subject, code: true },
                                    { label: 'Schema ID', value: String(schema.id) },
                                    { label: 'Version', value: String(schema.version) },
                                    { label: 'Type', value: schemaObj.type || 'N/A' },
                                    { label: 'Name', value: schemaObj.name || 'N/A', code: true }
                                ],
                                html: `<div style="margin-top: 15px;">
                                    <div style="font-weight: 600; margin-bottom: 8px;">Schema Definition:</div>
                                    <pre style="background-color: var(--vscode-editor-background); padding: 12px; border-radius: 4px; overflow-x: auto; border: 1px solid var(--vscode-panel-border); font-family: var(--vscode-editor-font-family); font-size: 13px;"><code>${schemaJson.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                                </div>`
                            } as any;
                        } catch (schemaError: any) {
                            // Schema not found for value, try key subject
                            const keySubject = `${node.topicName}-key`;
                            try {
                                const schema = await schemaService.getLatestSchema(keySubject);
                                const schemaObj = JSON.parse(schema.schema);
                                
                                const schemaJson = JSON.stringify(schemaObj, null, 2);
                                schemaSection = {
                                    title: 'Schema (Key)',
                                    icon: '🔑',
                                    properties: [
                                        { label: 'Subject', value: schema.subject, code: true },
                                        { label: 'Schema ID', value: String(schema.id) },
                                        { label: 'Version', value: String(schema.version) },
                                        { label: 'Type', value: schemaObj.type || 'N/A' },
                                        { label: 'Name', value: schemaObj.name || 'N/A', code: true }
                                    ],
                                    html: `<div style="margin-top: 15px;">
                                        <div style="font-weight: 600; margin-bottom: 8px;">Schema Definition:</div>
                                        <pre style="background-color: var(--vscode-editor-background); padding: 12px; border-radius: 4px; overflow-x: auto; border: 1px solid var(--vscode-panel-border); font-family: var(--vscode-editor-font-family); font-size: 13px;"><code>${schemaJson.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                                    </div>`
                                } as any;
                            } catch (keySchemaError: any) {
                                // No schema found for this topic
                            }
                        }
                    }
                }
            } catch (error: any) {
                // Schema registry not configured or error fetching schema
            }

            const sections = [
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
                ];

            // Add schema section if available
            if (schemaSection) {
                sections.splice(1, 0, schemaSection); // Insert after Overview
            }

            const data: DetailsData = {
                title: node.topicName,
                showCopyButton: true,
                showRefreshButton: false,
                showAIAdvisor: aiAvailable,
                notice: aiAvailable ? {
                    type: 'info',
                    text: '🤖 Try the AI Advisor for intelligent configuration recommendations!'
                } : undefined,
                sections
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

            detailsView.showDetails(data);
        },
        `Loading details for topic "${node.topicName}"`
    );
}

/**
 * Find/search for a topic across all clusters
 */
export async function findTopic(
    clientManager: KafkaClientManager,
    treeView: vscode.TreeView<any>,
    provider: any,
    context?: vscode.ExtensionContext
) {
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

            // Sort topics alphabetically for search menu
            topics.sort((a, b) => a.localeCompare(b));

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
                // Phase 0: 2.3 - Reveal and focus the topic in the tree view
                try {
                    // Get the cluster node
                    const children = await provider.getChildren();
                    const clusterNode = children.find((node: any) => node.label === selectedCluster);

                    if (clusterNode) {
                        // First, add this topic to the dynamic list so it will be shown in the tree
                        provider.addDynamicTopic(selectedCluster, selectedTopic.label);

                        // Reveal and expand the cluster
                        await treeView.reveal(clusterNode, { select: false, focus: false, expand: 1 });

                        // Wait for the tree to refresh and expand
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Get topics from provider (now includes our dynamic topic)
                        const topicNodes = await provider.getChildren(clusterNode);

                        // Find the topic node - it should be there now
                        const topicNode = topicNodes.find((node: any) =>
                            node.contextValue === 'topic' && node.label === selectedTopic.label
                        );

                        if (topicNode) {
                            // Reveal the topic in the tree view with focus
                            await treeView.reveal(topicNode, { select: true, focus: true, expand: false });
                        } else {
                            console.warn(`Topic still not found after adding dynamically: ${selectedTopic.label}`);
                        }
                    }
                } catch (error) {
                    // If reveal fails, just log it and continue to show details
                    console.log('Could not reveal topic in tree:', error);
                }

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
        const detailsView = new DetailsWebview(`ACL Details`, '🔒', context);
        const data: DetailsData = {
            title: `${aclDetails.principal} → ${aclDetails.operation}`,
            showCopyButton: true,
            showRefreshButton: false,
            notice: undefined,
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

        detailsView.showDetails(data);
    }, 'Show Topic ACL Details');
}
