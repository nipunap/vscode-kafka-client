import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { KafkaExplorerProvider } from '../providers/kafkaExplorerProvider';
import { ConsumerGroupProvider } from '../providers/consumerGroupProvider';
import { BrokerProvider } from '../providers/brokerProvider';
import { KStreamProvider } from '../providers/kstreamProvider';
import { KTableProvider } from '../providers/ktableProvider';
import { CredentialManager } from '../infrastructure/CredentialManager';
import { Logger } from '../infrastructure/Logger';
import { EventBus } from '../infrastructure/EventBus';

/**
 * Context object containing all dependencies needed by commands
 */
export interface CommandContext {
    clientManager: KafkaClientManager;
    eventBus: EventBus;
    credentialManager: CredentialManager;
    extensionContext: vscode.ExtensionContext;
    providers: CommandProviders;
    treeViews: CommandTreeViews;
    logger: Logger;
}

/**
 * Provider instances available to commands
 */
export interface CommandProviders {
    kafkaExplorer: KafkaExplorerProvider;
    consumerGroup: ConsumerGroupProvider;
    broker: BrokerProvider;
    kstream: KStreamProvider;
    ktable: KTableProvider;
}

/**
 * TreeView instances available to commands
 */
export interface CommandTreeViews {
    kafkaExplorer: vscode.TreeView<any>;
    consumerGroup: vscode.TreeView<any>;
    broker: vscode.TreeView<any>;
    kstream: vscode.TreeView<any>;
    ktable: vscode.TreeView<any>;
}

/**
 * Command handler function signature
 * Receives the command context and any additional arguments
 */
export type CommandHandler = (context: CommandContext, ...args: any[]) => Promise<void>;

/**
 * Command definition with metadata
 */
export interface CommandDefinition {
    /** Command identifier (e.g., 'kafka.addCluster') */
    id: string;
    /** Handler function to execute */
    handler: CommandHandler;
    /** Optional event to emit after successful execution */
    emitEvent?: string;
}

/**
 * Command Registry - Registers commands with automatic error handling and event emission
 *
 * This class provides a metadata-driven approach to command registration,
 * reducing boilerplate and centralizing error handling.
 */
export class CommandRegistry {
    private logger = Logger.getLogger('CommandRegistry');

    constructor(
        private context: vscode.ExtensionContext,
        private commandContext: CommandContext
    ) {}

    /**
     * Register a single command with error handling and event emission
     */
    register(definition: CommandDefinition): void {
        const disposable = vscode.commands.registerCommand(
            definition.id,
            async (...args: any[]) => {
                try {
                    // Execute the command handler
                    await definition.handler(this.commandContext, ...args);

                    // Emit success event if specified
                    if (definition.emitEvent) {
                        this.commandContext.eventBus.emitSync(definition.emitEvent);
                    }
                } catch (error) {
                    // Log error with command context
                    this.logger.error(`Error executing command ${definition.id}`, error);
                    // Don't show error message - commands already handle their own user-facing errors
                }
            }
        );

        // Add to extension subscriptions for proper disposal
        this.context.subscriptions.push(disposable);
    }

    /**
     * Register multiple commands at once
     */
    registerAll(definitions: CommandDefinition[]): void {
        definitions.forEach(def => this.register(def));
        this.logger.info(`Registered ${definitions.length} commands successfully`);
    }
}
