import * as vscode from 'vscode';
import { KafkaExplorerProvider } from './providers/kafkaExplorerProvider';
import { ConsumerGroupProvider } from './providers/consumerGroupProvider';
import { KafkaClientManager } from './kafka/kafkaClientManager';
import { ClusterConnectionWebview } from './forms/clusterConnectionWebview';

// Global client manager instance for cleanup on deactivation
let clientManager: KafkaClientManager;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Kafka extension is now active!');

    // Initialize Kafka client manager
    clientManager = new KafkaClientManager();

    // Register tree data providers
    const kafkaExplorerProvider = new KafkaExplorerProvider(clientManager);
    const consumerGroupProvider = new ConsumerGroupProvider(clientManager);

    vscode.window.registerTreeDataProvider('kafkaExplorer', kafkaExplorerProvider);
    vscode.window.registerTreeDataProvider('kafkaConsumerGroups', consumerGroupProvider);

    // Load saved clusters from configuration
    try {
        await clientManager.loadConfiguration();

        // Refresh the tree views after loading configuration
        kafkaExplorerProvider.refresh();
        consumerGroupProvider.refresh();
    } catch (error: any) {
        console.error('Failed to load cluster configurations:', error);
        vscode.window.showWarningMessage(
            `Failed to load some Kafka clusters: ${error.message}. You can add them again from the Kafka view.`,
            'Open Kafka View'
        ).then(selection => {
            if (selection === 'Open Kafka View') {
                vscode.commands.executeCommand('kafkaExplorer.focus');
            }
        });
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.addCluster', async () => {
            await addCluster(clientManager, kafkaExplorerProvider, consumerGroupProvider, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.removeCluster', async (node) => {
            await removeCluster(clientManager, kafkaExplorerProvider, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.refreshCluster', () => {
            kafkaExplorerProvider.refresh();
            consumerGroupProvider.refresh();
            vscode.window.showInformationMessage('Refreshed cluster data');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.createTopic', async (node) => {
            await createTopic(clientManager, kafkaExplorerProvider, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.deleteTopic', async (node) => {
            await deleteTopic(clientManager, kafkaExplorerProvider, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.produceMessage', async (node) => {
            await produceMessage(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.consumeMessages', async (node) => {
            await consumeMessages(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.viewConsumerGroup', async (node) => {
            await viewConsumerGroup(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showTopicDetails', async (node) => {
            await showTopicDetails(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showConsumerGroupDetails', async (node) => {
            await showConsumerGroupDetails(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.deleteConsumerGroup', async (node) => {
            await deleteConsumerGroup(clientManager, consumerGroupProvider, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.resetConsumerGroupOffsets', async (node) => {
            await resetConsumerGroupOffsets(clientManager, node);
        })
    );
}

async function addCluster(
    clientManager: KafkaClientManager,
    kafkaExplorerProvider: KafkaExplorerProvider,
    consumerGroupProvider: ConsumerGroupProvider,
    context: vscode.ExtensionContext
) {
    try {
        // Show the comprehensive connection form in a webview
        const webview = new ClusterConnectionWebview(context);
        const connection = await webview.show();

        if (!connection) {
            return; // User cancelled
        }

        // Add the cluster using the connection details
        await clientManager.addClusterFromConnection(connection);
        kafkaExplorerProvider.refresh();
        consumerGroupProvider.refresh();
        vscode.window.showInformationMessage(
            `✓ Cluster "${connection.name}" connected successfully!`,
            'View Topics'
        ).then(selection => {
            if (selection === 'View Topics') {
                vscode.commands.executeCommand('kafkaExplorer.focus');
            }
        });
    } catch (error: any) {
        const errorMsg = error?.message || error.toString();

        // Show actionable error messages
        if (errorMsg.includes('expired') || errorMsg.includes('ExpiredToken')) {
            vscode.window.showErrorMessage(
                `⚠️ AWS credentials expired: ${errorMsg}`,
                'Refresh Credentials', 'Cancel'
            ).then(selection => {
                if (selection === 'Refresh Credentials') {
                    vscode.env.openExternal(vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html'));
                }
            });
        } else if (errorMsg.includes('credentials')) {
            vscode.window.showErrorMessage(
                `⚠️ Credential error: ${errorMsg}`,
                'Check AWS Setup'
            ).then(selection => {
                if (selection === 'Check AWS Setup') {
                    vscode.env.openExternal(vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html'));
                }
            });
        } else {
            vscode.window.showErrorMessage(`Failed to add cluster: ${errorMsg}`);
        }
    }
}

async function removeCluster(
    clientManager: KafkaClientManager,
    provider: KafkaExplorerProvider,
    node: any
) {
    const confirm = await vscode.window.showWarningMessage(
        `Remove cluster "${node.label}"?`,
        'Yes',
        'No'
    );

    if (confirm === 'Yes') {
        await clientManager.removeCluster(node.clusterName);
        provider.refresh();
        vscode.window.showInformationMessage(`Cluster "${node.label}" removed.`);
    }
}

async function createTopic(
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
            vscode.window.showWarningMessage(`Topic "${topicName}" already exists in cluster "${node.clusterName}"`);
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

async function deleteTopic(
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

async function produceMessage(clientManager: KafkaClientManager, node: any) {
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

async function consumeMessages(clientManager: KafkaClientManager, node: any) {
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

async function viewConsumerGroup(clientManager: KafkaClientManager, node: any) {
    try {
        const details = await clientManager.getConsumerGroupDetails(
            node.clusterName,
            node.groupId
        );

        const document = await vscode.workspace.openTextDocument({
            content: JSON.stringify(details, null, 2),
            language: 'json'
        });
        await vscode.window.showTextDocument(document);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to get consumer group details: ${error}`);
    }
}

function formatMessages(messages: any[]): string {
    return JSON.stringify(
        messages.map(msg => ({
            partition: msg.partition,
            offset: msg.offset,
            key: msg.key?.toString(),
            value: msg.value?.toString(),
            timestamp: msg.timestamp,
            headers: msg.headers
        })),
        null,
        2
    );
}

async function showTopicDetails(clientManager: KafkaClientManager, node: any) {
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

async function showConsumerGroupDetails(clientManager: KafkaClientManager, node: any) {
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

function formatTopicDetailsYaml(details: any): string {
    const totalMessages = Object.values(details.partitionDetails).reduce(
        (sum: number, p: any) => {
            const count = typeof p.messageCount === 'string' ?
                parseInt(p.messageCount) : p.messageCount;
            return sum + (isNaN(count) ? 0 : count);
        },
        0
    );

    let yaml = `# Topic Details\n`;
    yaml += `# Generated at ${new Date().toLocaleString()}\n\n`;

    yaml += `topic:\n`;
    yaml += `  name: "${details.name}"\n`;
    yaml += `  partitions: ${details.partitions}\n`;
    yaml += `  replicationFactor: ${details.replicationFactor}\n`;
    yaml += `  totalMessages: ${totalMessages}\n\n`;

    yaml += `partitions:\n`;
    const sortedPartitions = Object.entries(details.partitionDetails).sort(
        ([a], [b]) => Number(a) - Number(b)
    );

    for (const [partId, part] of sortedPartitions) {
        const p = part as any;
        const msgCount = typeof p.messageCount === 'string' ?
            parseInt(p.messageCount) : p.messageCount;
        const count = isNaN(msgCount) ? 0 : msgCount;

        yaml += `  - partition: ${p.partition}\n`;
        yaml += `    leader: ${p.leader}\n`;
        yaml += `    replicas: [${p.replicas.join(', ')}]\n`;
        yaml += `    isr: [${p.isr.join(', ')}]\n`;
        yaml += `    offsets:\n`;
        yaml += `      low: "${p.lowWaterMark}"\n`;
        yaml += `      high: "${p.highWaterMark}"\n`;
        yaml += `    messages: ${count}\n\n`;
    }

    const configs = details.configuration.filter((c: any) => !c.isDefault);
    if (configs.length > 0) {
        yaml += `configuration:\n`;
        for (const config of configs) {
            const value = config.configValue || 'null';
            const safeValue = value.includes(':') || value.includes('\n') ?
                `"${value.replace(/"/g, '\\"')}"` : value;
            yaml += `  ${config.configName}: ${safeValue}\n`;
        }
    } else {
        yaml += `configuration: {}  # All using defaults\n`;
    }

    return yaml;
}

function formatConsumerGroupDetailsYaml(details: any): string {
    let yaml = `# Consumer Group Details\n`;
    yaml += `# Generated at ${new Date().toLocaleString()}\n\n`;

    yaml += `consumerGroup:\n`;
    yaml += `  groupId: "${details.groupId}"\n`;
    yaml += `  state: "${details.state}"\n`;
    yaml += `  protocolType: "${details.protocolType}"\n`;
    yaml += `  protocol: "${details.protocol || 'N/A'}"\n`;
    yaml += `  memberCount: ${details.members.length}\n`;
    yaml += `  totalLag: ${details.totalLag}\n\n`;

    if (details.members.length > 0) {
        yaml += `members:\n`;
        for (const member of details.members) {
            yaml += `  - memberId: "${member.memberId}"\n`;
            yaml += `    clientId: "${member.clientId}"\n`;
            yaml += `    clientHost: "${member.clientHost}"\n\n`;
        }
    } else {
        yaml += `members: []  # No active members\n\n`;
    }

    if (details.offsets.length > 0) {
        yaml += `offsets:\n`;

        // Group by topic for better readability
        const byTopic: { [key: string]: any[] } = {};
        for (const offset of details.offsets) {
            if (!byTopic[offset.topic]) {
                byTopic[offset.topic] = [];
            }
            byTopic[offset.topic].push(offset);
        }

        for (const [topic, offsets] of Object.entries(byTopic)) {
            yaml += `  - topic: "${topic}"\n`;
            yaml += `    partitions:\n`;

            // Sort by partition number
            offsets.sort((a, b) => a.partition - b.partition);

            for (const offset of offsets) {
                let lagStatus = 'ok';
                if (offset.lag > 10000) {
                    lagStatus = 'critical';
                } else if (offset.lag > 1000) {
                    lagStatus = 'warning';
                } else if (offset.lag > 0) {
                    lagStatus = 'minor';
                }

                yaml += `      - partition: ${offset.partition}\n`;
                yaml += `        currentOffset: "${offset.currentOffset}"\n`;
                yaml += `        highWaterMark: "${offset.highWaterMark}"\n`;
                yaml += `        lag: ${offset.lag}\n`;
                yaml += `        status: ${lagStatus}\n`;
            }
            yaml += `\n`;
        }
    } else {
        yaml += `offsets: []  # No offset information\n`;
    }

    return yaml;
}

async function deleteConsumerGroup(
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

async function resetConsumerGroupOffsets(clientManager: KafkaClientManager, node: any) {
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

export async function deactivate() {
    console.log('Kafka extension is being deactivated...');
    
    // Clean up all Kafka connections
    if (clientManager) {
        try {
            await clientManager.dispose();
            console.log('Successfully cleaned up Kafka connections');
        } catch (error) {
            console.error('Error during Kafka client cleanup:', error);
        }
    }
}
