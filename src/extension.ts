import * as vscode from 'vscode';
import { KafkaExplorerProvider } from './providers/kafkaExplorerProvider';
import { ConsumerGroupProvider } from './providers/consumerGroupProvider';
import { KafkaClientManager } from './kafka/kafkaClientManager';
import * as clusterCommands from './commands/clusterCommands';
import * as topicCommands from './commands/topicCommands';
import * as consumerGroupCommands from './commands/consumerGroupCommands';

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
            await clusterCommands.addCluster(clientManager, kafkaExplorerProvider, consumerGroupProvider, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.removeCluster', async (node) => {
            await clusterCommands.removeCluster(clientManager, kafkaExplorerProvider, node);
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
            await topicCommands.createTopic(clientManager, kafkaExplorerProvider, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.deleteTopic', async (node) => {
            await topicCommands.deleteTopic(clientManager, kafkaExplorerProvider, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.produceMessage', async (node) => {
            await topicCommands.produceMessage(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.consumeMessages', async (node) => {
            await topicCommands.consumeMessages(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.viewConsumerGroup', async (node) => {
            await consumerGroupCommands.showConsumerGroupDetails(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showTopicDetails', async (node) => {
            await topicCommands.showTopicDetails(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showConsumerGroupDetails', async (node) => {
            await consumerGroupCommands.showConsumerGroupDetails(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.deleteConsumerGroup', async (node) => {
            await consumerGroupCommands.deleteConsumerGroup(clientManager, consumerGroupProvider, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.resetConsumerGroupOffsets', async (node) => {
            await consumerGroupCommands.resetConsumerGroupOffsets(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.findTopic', async () => {
            await topicCommands.findTopic(clientManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.findConsumerGroup', async () => {
            await consumerGroupCommands.findConsumerGroup(clientManager);
        })
    );
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
