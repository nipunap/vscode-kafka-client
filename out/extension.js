"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const kafkaExplorerProvider_1 = require("./providers/kafkaExplorerProvider");
const consumerGroupProvider_1 = require("./providers/consumerGroupProvider");
const kafkaClientManager_1 = require("./kafka/kafkaClientManager");
const clusterCommands = __importStar(require("./commands/clusterCommands"));
const topicCommands = __importStar(require("./commands/topicCommands"));
const consumerGroupCommands = __importStar(require("./commands/consumerGroupCommands"));
// Global client manager instance for cleanup on deactivation
let clientManager;
async function activate(context) {
    console.log('Kafka extension is now active!');
    // Initialize Kafka client manager
    clientManager = new kafkaClientManager_1.KafkaClientManager();
    // Register tree data providers
    const kafkaExplorerProvider = new kafkaExplorerProvider_1.KafkaExplorerProvider(clientManager);
    const consumerGroupProvider = new consumerGroupProvider_1.ConsumerGroupProvider(clientManager);
    vscode.window.registerTreeDataProvider('kafkaExplorer', kafkaExplorerProvider);
    vscode.window.registerTreeDataProvider('kafkaConsumerGroups', consumerGroupProvider);
    // Load saved clusters from configuration
    try {
        await clientManager.loadConfiguration();
        // Refresh the tree views after loading configuration
        kafkaExplorerProvider.refresh();
        consumerGroupProvider.refresh();
    }
    catch (error) {
        console.error('Failed to load cluster configurations:', error);
        vscode.window.showWarningMessage(`Failed to load some Kafka clusters: ${error.message}. You can add them again from the Kafka view.`, 'Open Kafka View').then(selection => {
            if (selection === 'Open Kafka View') {
                vscode.commands.executeCommand('kafkaExplorer.focus');
            }
        });
    }
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('kafka.addCluster', async () => {
        await clusterCommands.addCluster(clientManager, kafkaExplorerProvider, consumerGroupProvider, context);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.removeCluster', async (node) => {
        await clusterCommands.removeCluster(clientManager, kafkaExplorerProvider, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.refreshCluster', () => {
        kafkaExplorerProvider.refresh();
        consumerGroupProvider.refresh();
        vscode.window.showInformationMessage('Refreshed cluster data');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.createTopic', async (node) => {
        await topicCommands.createTopic(clientManager, kafkaExplorerProvider, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.deleteTopic', async (node) => {
        await topicCommands.deleteTopic(clientManager, kafkaExplorerProvider, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.produceMessage', async (node) => {
        await topicCommands.produceMessage(clientManager, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.consumeMessages', async (node) => {
        await topicCommands.consumeMessages(clientManager, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.viewConsumerGroup', async (node) => {
        await consumerGroupCommands.showConsumerGroupDetails(clientManager, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.showTopicDetails', async (node) => {
        await topicCommands.showTopicDetails(clientManager, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.showConsumerGroupDetails', async (node) => {
        await consumerGroupCommands.showConsumerGroupDetails(clientManager, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.deleteConsumerGroup', async (node) => {
        await consumerGroupCommands.deleteConsumerGroup(clientManager, consumerGroupProvider, node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('kafka.resetConsumerGroupOffsets', async (node) => {
        await consumerGroupCommands.resetConsumerGroupOffsets(clientManager, node);
    }));
}
async function deactivate() {
    console.log('Kafka extension is being deactivated...');
    // Clean up all Kafka connections
    if (clientManager) {
        try {
            await clientManager.dispose();
            console.log('Successfully cleaned up Kafka connections');
        }
        catch (error) {
            console.error('Error during Kafka client cleanup:', error);
        }
    }
}
//# sourceMappingURL=extension.js.map