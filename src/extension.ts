import * as vscode from 'vscode';
import { KafkaExplorerProvider } from './providers/kafkaExplorerProvider';
import { ConsumerGroupProvider } from './providers/consumerGroupProvider';
import { BrokerProvider } from './providers/brokerProvider';
import { KStreamProvider } from './providers/kstreamProvider';
import { KTableProvider } from './providers/ktableProvider';
import { KafkaClientManager } from './kafka/kafkaClientManager';
import * as clusterCommands from './commands/clusterCommands';
import * as topicCommands from './commands/topicCommands';
import * as consumerGroupCommands from './commands/consumerGroupCommands';
import * as brokerCommands from './commands/brokerCommands';
import * as aclCommands from './commands/aclCommands';
import * as kstreamCommands from './commands/kstreamCommands';
import * as ktableCommands from './commands/ktableCommands';
import * as clusterDashboardCommands from './commands/clusterDashboardCommands';
import { Logger, LogLevel } from './infrastructure/Logger';
import { EventBus, KafkaEvents } from './infrastructure/EventBus';
import { CredentialManager } from './infrastructure/CredentialManager';
import { FieldDescriptions } from './utils/fieldDescriptions';
import { MessageConsumerWebview } from './views/MessageConsumerWebview';
import { MessageProducerWebview } from './views/MessageProducerWebview';

// Global instances for cleanup on deactivation
let clientManager: KafkaClientManager;
let eventBus: EventBus;
let credentialManager: CredentialManager;
const logger = Logger.getLogger('Extension');

export async function activate(context: vscode.ExtensionContext) {
    logger.info('Kafka extension is now active!');

    // Initialize log level from configuration
    const config = vscode.workspace.getConfiguration('kafka');
    const logLevel = config.get<string>('logLevel', 'info');
    Logger.setLevel(logLevel === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);

    // Initialize infrastructure
    eventBus = new EventBus();
    credentialManager = new CredentialManager(context.secrets);
    clientManager = new KafkaClientManager(credentialManager);

    // Load field descriptions database for webview info icons
    const fieldDescriptions = FieldDescriptions.getInstance();
    fieldDescriptions.load(context.extensionPath);

    // Register tree data providers
    const kafkaExplorerProvider = new KafkaExplorerProvider(clientManager);
    const consumerGroupProvider = new ConsumerGroupProvider(clientManager);
    const brokerProvider = new BrokerProvider(clientManager);
    const kstreamProvider = new KStreamProvider(clientManager);
    const ktableProvider = new KTableProvider(clientManager);

    vscode.window.registerTreeDataProvider('kafkaExplorer', kafkaExplorerProvider);
    vscode.window.registerTreeDataProvider('kafkaConsumerGroups', consumerGroupProvider);
    vscode.window.registerTreeDataProvider('kafkaBrokers', brokerProvider);
    vscode.window.registerTreeDataProvider('kafkaStreams', kstreamProvider);
    vscode.window.registerTreeDataProvider('kafkaTables', ktableProvider);

    // Set up event listeners for auto-refresh
    eventBus.on(KafkaEvents.CLUSTER_ADDED, () => {
        logger.debug('Cluster added, refreshing providers');
        kafkaExplorerProvider.refresh();
        consumerGroupProvider.refresh();
        brokerProvider.refresh();
        kstreamProvider.refresh();
        ktableProvider.refresh();
    });

    eventBus.on(KafkaEvents.CLUSTER_REMOVED, () => {
        logger.debug('Cluster removed, refreshing providers');
        kafkaExplorerProvider.refresh();
        consumerGroupProvider.refresh();
        brokerProvider.refresh();
        kstreamProvider.refresh();
        ktableProvider.refresh();
    });

    eventBus.on(KafkaEvents.REFRESH_REQUESTED, () => {
        logger.debug('Refresh requested, refreshing all providers');
        kafkaExplorerProvider.refresh();
        consumerGroupProvider.refresh();
        brokerProvider.refresh();
        kstreamProvider.refresh();
        ktableProvider.refresh();
    });

    // Load saved clusters from configuration
    try {
        await clientManager.loadConfiguration();
        logger.info('Loaded cluster configurations');

        // Refresh the tree views after loading configuration
        eventBus.emitSync(KafkaEvents.REFRESH_REQUESTED);
    } catch (error: any) {
        logger.error('Failed to load cluster configurations', error);
        vscode.window.showWarningMessage(
            `Failed to load some Kafka clusters: ${error.message}. You can add them again from the Kafka view.`,
            'Open Kafka View',
            'Show Logs'
        ).then(selection => {
            if (selection === 'Open Kafka View') {
                vscode.commands.executeCommand('kafkaExplorer.focus');
            } else if (selection === 'Show Logs') {
                logger.show();
            }
        });
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.addCluster', async () => {
            await clusterCommands.addCluster(clientManager, kafkaExplorerProvider, consumerGroupProvider, context);
            eventBus.emitSync(KafkaEvents.CLUSTER_ADDED);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.removeCluster', async (node) => {
            await clusterCommands.removeCluster(clientManager, kafkaExplorerProvider, node);
            eventBus.emitSync(KafkaEvents.CLUSTER_REMOVED);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.refreshCluster', () => {
            eventBus.emitSync(KafkaEvents.REFRESH_REQUESTED);
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
            // Validate input
            if (!node || !node.clusterName || !node.topicName) {
                vscode.window.showErrorMessage('Invalid topic selection. Please try again.');
                return;
            }

            // Show the message producer webview
            const messageProducerWebview = MessageProducerWebview.getInstance(
                context.extensionPath,
                clientManager,
                logger
            );

            await messageProducerWebview.show(node.clusterName, node.topicName);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.consumeMessages', async (node) => {
            // Validate input
            if (!node || !node.clusterName || !node.topicName) {
                vscode.window.showErrorMessage('Invalid topic selection. Please try again.');
                return;
            }

            // Ask user if they want to start from beginning or latest
            const fromBeginningChoice = await vscode.window.showQuickPick(
                [
                    { label: 'Latest', description: 'Start consuming from the latest offset', value: false },
                    { label: 'Beginning', description: 'Start consuming from the beginning of the topic', value: true }
                ],
                {
                    placeHolder: 'Where do you want to start consuming from?'
                }
            );

            if (!fromBeginningChoice) {
                return;
            }

            // Show the message consumer webview
            const messageConsumerWebview = MessageConsumerWebview.getInstance(
                context.extensionPath,
                clientManager,
                logger
            );

            await messageConsumerWebview.show(
                node.clusterName,
                node.topicName,
                fromBeginningChoice.value
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.viewConsumerGroup', async (node) => {
            await consumerGroupCommands.showConsumerGroupDetails(clientManager, node, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showTopicDetails', async (node) => {
            await topicCommands.showTopicDetails(clientManager, node, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showConsumerGroupDetails', async (node) => {
            await consumerGroupCommands.showConsumerGroupDetails(clientManager, node, context);
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

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showBrokerDetails', async (node) => {
            await brokerCommands.showBrokerDetails(clientManager, node, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.findBroker', async () => {
            await brokerCommands.findBroker(clientManager);
        })
    );

    // KStream commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showKStreamDetails', async (node) => {
            await kstreamCommands.showKStreamDetails(clientManager, node, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.findKStream', async () => {
            await kstreamCommands.findKStream(clientManager, kstreamProvider);
        })
    );

    // KTable commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showKTableDetails', async (node) => {
            await ktableCommands.showKTableDetails(clientManager, node, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.findKTable', async () => {
            await ktableCommands.findKTable(clientManager, ktableProvider);
        })
    );

    // ACL commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showACLDetails', async (node) => {
            await aclCommands.showACLDetails(clientManager, node, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.createACL', async (node) => {
            await aclCommands.createACL(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.deleteACL', async (node) => {
            await aclCommands.deleteACL(clientManager, node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.findACL', async () => {
            await aclCommands.findACL(clientManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showACLHelp', async () => {
            await aclCommands.showACLHelp(clientManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kafka.showClusterDashboard', async (node) => {
            await clusterDashboardCommands.showClusterDashboard(clientManager, context, node);
        }),

        vscode.commands.registerCommand('kafka.showTopicDashboard', async (node) => {
            await topicCommands.showTopicDashboard(clientManager, context, node);
        }),

        vscode.commands.registerCommand('kafka.showTopicACLDetails', async (node) => {
            await topicCommands.showTopicACLDetails(clientManager, node, context);
        })
    );
}

export async function deactivate() {
    logger.info('Kafka extension is being deactivated...');

    // Clean up all Kafka connections
    if (clientManager) {
        try {
            await clientManager.dispose();
            logger.info('Successfully cleaned up Kafka connections');
        } catch (error) {
            logger.error('Error during Kafka client cleanup', error);
        }
    }

    // Clean up event bus
    if (eventBus) {
        eventBus.removeAllListeners();
    }
}

/**
 * Export event bus for use in commands
 */
export function getEventBus(): EventBus {
    return eventBus;
}

/**
 * Export credential manager for use in commands
 */
export function getCredentialManager(): CredentialManager {
    return credentialManager;
}
