/**
 * Command handlers for Kafka cluster operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { KafkaExplorerProvider } from '../providers/kafkaExplorerProvider';
import { ConsumerGroupProvider } from '../providers/consumerGroupProvider';
import { ClusterConnectionWebview } from '../forms/clusterConnectionWebview';

export async function addCluster(
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

export async function removeCluster(
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

