import * as vscode from 'vscode';
import { KafkaExplorerProvider } from './providers/kafkaExplorerProvider';
import { ConsumerGroupProvider } from './providers/consumerGroupProvider';
import { BrokerProvider } from './providers/brokerProvider';
import { KStreamProvider } from './providers/kstreamProvider';
import { KTableProvider } from './providers/ktableProvider';
import { KafkaClientManager } from './kafka/kafkaClientManager';
import { Logger, LogLevel } from './infrastructure/Logger';
import { EventBus, KafkaEvents } from './infrastructure/EventBus';
import { CredentialManager } from './infrastructure/CredentialManager';
import { FieldDescriptions } from './utils/fieldDescriptions';
import { WebviewManager } from './views/WebviewManager';
import { LagMonitor } from './services/LagMonitor';

// Global instances for cleanup on deactivation
let clientManager: KafkaClientManager;
let eventBus: EventBus;
let credentialManager: CredentialManager;
let lagMonitor: LagMonitor;
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

    // Initialize lag monitoring
    lagMonitor = new LagMonitor(clientManager, eventBus);
    lagMonitor.start();

    // Load field descriptions database for webview info icons
    const fieldDescriptions = FieldDescriptions.getInstance();
    fieldDescriptions.load(context.extensionPath);

    // Register tree data providers
    const kafkaExplorerProvider = new KafkaExplorerProvider(clientManager);
    const consumerGroupProvider = new ConsumerGroupProvider(clientManager);
    const brokerProvider = new BrokerProvider(clientManager);
    const kstreamProvider = new KStreamProvider(clientManager);
    const ktableProvider = new KTableProvider(clientManager);

    // Create TreeView instances to enable reveal() functionality (Phase 0: 2.3)
    const kafkaExplorerTreeView = vscode.window.createTreeView('kafkaExplorer', {
        treeDataProvider: kafkaExplorerProvider
    });

    const consumerGroupTreeView = vscode.window.createTreeView('kafkaConsumerGroups', {
        treeDataProvider: consumerGroupProvider
    });

    const brokerTreeView = vscode.window.createTreeView('kafkaBrokers', {
        treeDataProvider: brokerProvider
    });

    const kstreamTreeView = vscode.window.createTreeView('kafkaStreams', {
        treeDataProvider: kstreamProvider
    });

    const ktableTreeView = vscode.window.createTreeView('kafkaTables', {
        treeDataProvider: ktableProvider
    });

    // Register TreeViews for proper disposal
    context.subscriptions.push(
        kafkaExplorerTreeView,
        consumerGroupTreeView,
        brokerTreeView,
        kstreamTreeView,
        ktableTreeView
    );

    // Define providers for easy iteration and error isolation
    const providers = [
        { provider: kafkaExplorerProvider, name: 'KafkaExplorerProvider' },
        { provider: consumerGroupProvider, name: 'ConsumerGroupProvider' },
        { provider: brokerProvider, name: 'BrokerProvider' },
        { provider: kstreamProvider, name: 'KStreamProvider' },
        { provider: ktableProvider, name: 'KTableProvider' }
    ];

    /**
     * Safely refresh all providers with error isolation
     * Prevents one provider failure from affecting others
     */
    function refreshAllProviders(reason: string): void {
        logger.debug(`${reason}, refreshing providers`);
        providers.forEach(({ provider, name }) => {
            try {
                provider.refresh();
            } catch (error) {
                logger.error(`Failed to refresh ${name}`, error);
                // Don't throw - isolate errors per provider
            }
        });
    }

    // Set up event listeners for auto-refresh
    eventBus.on(KafkaEvents.CLUSTER_ADDED, () => {
        logger.debug('Cluster added event received');
        refreshAllProviders('Cluster added');
    });

    eventBus.on(KafkaEvents.CLUSTER_REMOVED, () => {
        logger.debug('Cluster removed event received');
        refreshAllProviders('Cluster removed');
    });

    eventBus.on(KafkaEvents.REFRESH_REQUESTED, () => {
        logger.debug('Refresh requested event received');
        refreshAllProviders('Refresh requested');
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

    // Register all commands using the command registry
    const { CommandRegistry } = await import('./commands/commandRegistry');
    const { getCommandDefinitions } = await import('./commands/commandDefinitions');

    const commandContext = {
        clientManager,
        eventBus,
        credentialManager,
        extensionContext: context,
        providers: {
            kafkaExplorer: kafkaExplorerProvider,
            consumerGroup: consumerGroupProvider,
            broker: brokerProvider,
            kstream: kstreamProvider,
            ktable: ktableProvider
        },
        treeViews: {
            kafkaExplorer: kafkaExplorerTreeView,
            consumerGroup: consumerGroupTreeView,
            broker: brokerTreeView,
            kstream: kstreamTreeView,
            ktable: ktableTreeView
        },
        logger
    };

    const registry = new CommandRegistry(context, commandContext);
    registry.registerAll(getCommandDefinitions());

    logger.info('All commands registered successfully');
}

export async function deactivate() {
    logger.info('Kafka extension is being deactivated...');

    // Clean up all webviews (prevents memory leaks)
    try {
        const webviewManager = WebviewManager.getInstance();
        webviewManager.logStatistics();
        webviewManager.disposeAll();
        logger.info('Successfully cleaned up all webviews');
    } catch (error) {
        logger.error('Error during webview cleanup', error);
    }

    // Stop lag monitoring
    if (lagMonitor) {
        try {
            lagMonitor.stop();
            logger.info('Successfully stopped lag monitoring');
        } catch (error) {
            logger.error('Error during lag monitor cleanup', error);
        }
    }

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
