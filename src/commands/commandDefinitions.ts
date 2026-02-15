import * as vscode from 'vscode';
import { CommandDefinition } from './commandRegistry';
import { KafkaEvents } from '../infrastructure/EventBus';
import * as clusterCommands from './clusterCommands';
import * as topicCommands from './topicCommands';
import * as consumerGroupCommands from './consumerGroupCommands';
import * as brokerCommands from './brokerCommands';
import * as aclCommands from './aclCommands';
import * as auditCommands from './auditCommands';
import * as kstreamCommands from './kstreamCommands';
import * as ktableCommands from './ktableCommands';
import * as clusterDashboardCommands from './clusterDashboardCommands';
import * as partitionCommands from './partitionCommands';
import { MessageProducerWebview } from '../views/MessageProducerWebview';
import { MessageConsumerWebview } from '../views/MessageConsumerWebview';

/**
 * Get all command definitions for the extension
 * This centralizes all command registration in one place
 */
export function getCommandDefinitions(): CommandDefinition[] {
    return [
        // ========== Cluster Commands ==========
        {
            id: 'kafka.addCluster',
            handler: async (ctx) => {
                await clusterCommands.addCluster(
                    ctx.clientManager,
                    ctx.providers.kafkaExplorer,
                    ctx.providers.consumerGroup,
                    ctx.extensionContext
                );
            },
            emitEvent: KafkaEvents.CLUSTER_ADDED
        },
        {
            id: 'kafka.removeCluster',
            handler: async (ctx, node) => {
                await clusterCommands.removeCluster(
                    ctx.clientManager,
                    ctx.providers.kafkaExplorer,
                    node
                );
            },
            emitEvent: KafkaEvents.CLUSTER_REMOVED
        },
        {
            id: 'kafka.refreshCluster',
            handler: async (_ctx) => {
                vscode.window.showInformationMessage('Refreshed cluster data');
            },
            emitEvent: KafkaEvents.REFRESH_REQUESTED
        },
        {
            id: 'kafka.showClusterDashboard',
            handler: async (ctx, node) => {
                await clusterDashboardCommands.showClusterDashboard(
                    ctx.clientManager,
                    ctx.extensionContext,
                    node
                );
            }
        },

        // ========== Topic Commands ==========
        {
            id: 'kafka.createTopic',
            handler: async (ctx, node) => {
                await topicCommands.createTopic(
                    ctx.clientManager,
                    ctx.providers.kafkaExplorer,
                    node
                );
            }
        },
        {
            id: 'kafka.deleteTopic',
            handler: async (ctx, node) => {
                await topicCommands.deleteTopic(
                    ctx.clientManager,
                    ctx.providers.kafkaExplorer,
                    node
                );
            }
        },
        {
            id: 'kafka.addPartitions',
            handler: async (ctx, node) => {
                await topicCommands.addPartitions(
                    ctx.clientManager,
                    ctx.providers.kafkaExplorer,
                    node
                );
            }
        },
        {
            id: 'kafka.editTopicConfig',
            handler: async (ctx, node) => {
                await topicCommands.editTopicConfig(
                    ctx.clientManager,
                    ctx.providers.kafkaExplorer,
                    node
                );
            }
        },
        {
            id: 'kafka.showTopicDetails',
            handler: async (ctx, node) => {
                await topicCommands.showTopicDetails(
                    ctx.clientManager,
                    node,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.showTopicDashboard',
            handler: async (ctx, node) => {
                await topicCommands.showTopicDashboard(
                    ctx.clientManager,
                    ctx.extensionContext,
                    node
                );
            }
        },
        {
            id: 'kafka.showTopicACLDetails',
            handler: async (ctx, node) => {
                await topicCommands.showTopicACLDetails(
                    ctx.clientManager,
                    node,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.findTopic',
            handler: async (ctx) => {
                await topicCommands.findTopic(
                    ctx.clientManager,
                    ctx.treeViews.kafkaExplorer,
                    ctx.providers.kafkaExplorer,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.viewAllTopics',
            handler: async (_ctx, clusterName: string, topics: string[]) => {
                const { TopicsWebview } = await import('../views/TopicsWebview');
                await TopicsWebview.getInstance().show(clusterName, topics);
            }
        },
        {
            id: 'kafka.exportTopics',
            handler: async (ctx, node) => {
                await topicCommands.exportTopics(ctx.clientManager, node);
            }
        },

        // ========== Message Commands ==========
        {
            id: 'kafka.produceMessage',
            handler: async (ctx, node) => {
                // Validate input
                if (!node || !node.clusterName || !node.topicName) {
                    vscode.window.showErrorMessage('Invalid topic selection. Please try again.');
                    return;
                }

                // Show the message producer webview
                const webview = MessageProducerWebview.getInstance(
                    ctx.clientManager,
                    ctx.logger,
                    ctx.credentialManager
                );
                await webview.show(node.clusterName, node.topicName);
            }
        },
        {
            id: 'kafka.consumeMessages',
            handler: async (ctx, node) => {
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
                const webview = MessageConsumerWebview.getInstance(
                    ctx.clientManager,
                    ctx.logger,
                    ctx.eventBus
                );
                await webview.show(
                    node.clusterName,
                    node.topicName,
                    fromBeginningChoice.value
                );
            }
        },

        // ========== Consumer Group Commands ==========
        {
            id: 'kafka.viewConsumerGroup',
            handler: async (ctx, node) => {
                await consumerGroupCommands.showConsumerGroupDetails(
                    ctx.clientManager,
                    node,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.showConsumerGroupDetails',
            handler: async (ctx, node) => {
                await consumerGroupCommands.showConsumerGroupDetails(
                    ctx.clientManager,
                    node,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.showAllConsumerGroups',
            handler: async (ctx, clusterName: string) => {
                const groups = await ctx.clientManager.getConsumerGroups(clusterName);
                const ConsumerGroupsWebview = (await import('../views/ConsumerGroupsWebview')).ConsumerGroupsWebview;
                const webview = ConsumerGroupsWebview.getInstance();
                await webview.show(clusterName, groups);
            }
        },
        {
            id: 'kafka.deleteConsumerGroup',
            handler: async (ctx, node) => {
                await consumerGroupCommands.deleteConsumerGroup(
                    ctx.clientManager,
                    ctx.providers.consumerGroup,
                    node
                );
            }
        },
        {
            id: 'kafka.resetConsumerGroupOffsets',
            handler: async (ctx, node) => {
                await consumerGroupCommands.resetConsumerGroupOffsets(
                    ctx.clientManager,
                    node
                );
            }
        },
        {
            id: 'kafka.findConsumerGroup',
            handler: async (ctx) => {
                await consumerGroupCommands.findConsumerGroup(
                    ctx.clientManager,
                    ctx.treeViews.consumerGroup,
                    ctx.providers.consumerGroup,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.exportConsumerGroups',
            handler: async (ctx, node) => {
                await consumerGroupCommands.exportConsumerGroups(
                    ctx.clientManager,
                    node
                );
            }
        },

        // ========== Broker Commands ==========
        {
            id: 'kafka.showBrokerDetails',
            handler: async (ctx, node) => {
                await brokerCommands.showBrokerDetails(
                    ctx.clientManager,
                    node,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.findBroker',
            handler: async (ctx) => {
                await brokerCommands.findBroker(
                    ctx.clientManager,
                    ctx.treeViews.broker,
                    ctx.providers.broker,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.editBrokerConfig',
            handler: async (ctx, node) => {
                await brokerCommands.editBrokerConfig(ctx.clientManager, node);
            }
        },

        // ========== KStream Commands ==========
        {
            id: 'kafka.showKStreamDetails',
            handler: async (ctx, node) => {
                await kstreamCommands.showKStreamDetails(
                    ctx.clientManager,
                    node,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.findKStream',
            handler: async (ctx) => {
                await kstreamCommands.findKStream(
                    ctx.clientManager,
                    ctx.treeViews.kstream,
                    ctx.providers.kstream,
                    ctx.extensionContext
                );
            }
        },

        // ========== KTable Commands ==========
        {
            id: 'kafka.showKTableDetails',
            handler: async (ctx, node) => {
                await ktableCommands.showKTableDetails(
                    ctx.clientManager,
                    node,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.findKTable',
            handler: async (ctx) => {
                await ktableCommands.findKTable(
                    ctx.clientManager,
                    ctx.treeViews.ktable,
                    ctx.providers.ktable,
                    ctx.extensionContext
                );
            }
        },

        // ========== Partition Commands ==========
        {
            id: 'kafka.viewPartitionDetails',
            handler: async (ctx, node) => {
                await partitionCommands.viewPartitionDetails(
                    ctx.clientManager,
                    node.clusterName,
                    node.topicName,
                    node.partitionId
                );
            }
        },
        {
            id: 'kafka.viewPartitionOffsets',
            handler: async (ctx, node) => {
                await partitionCommands.viewPartitionOffsets(
                    ctx.clientManager,
                    node.clusterName,
                    node.topicName,
                    node.partitionId
                );
            }
        },
        {
            id: 'kafka.seekToOffset',
            handler: async (ctx, node) => {
                await partitionCommands.seekToOffset(
                    ctx.clientManager,
                    node.clusterName,
                    node.topicName,
                    node.partitionId
                );
            }
        },

        // ========== ACL Commands ==========
        {
            id: 'kafka.showACLDetails',
            handler: async (ctx, node) => {
                await aclCommands.showACLDetails(
                    ctx.clientManager,
                    node,
                    ctx.extensionContext
                );
            }
        },
        {
            id: 'kafka.createACL',
            handler: async (ctx, node) => {
                await aclCommands.createACL(ctx.clientManager, node);
            }
        },
        {
            id: 'kafka.deleteACL',
            handler: async (ctx, node) => {
                await aclCommands.deleteACL(ctx.clientManager, node);
            }
        },
        {
            id: 'kafka.findACL',
            handler: async (ctx) => {
                await aclCommands.findACL(ctx.clientManager);
            }
        },
        {
            id: 'kafka.showACLHelp',
            handler: async (ctx) => {
                await aclCommands.showACLHelp(ctx.clientManager, ctx.extensionContext);
            }
        },

        // ========== Audit Commands ==========
        {
            id: 'kafka.showAuditLog',
            handler: async (_ctx) => {
                await auditCommands.showAuditLog();
            }
        }
    ];
}
