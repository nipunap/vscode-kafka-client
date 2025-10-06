/**
 * Command handlers for cluster dashboard operations
 */

import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { ClusterDashboardWebview } from '../views/clusterDashboardWebview';

let dashboardWebview: ClusterDashboardWebview | undefined;

export async function showClusterDashboard(
    clientManager: KafkaClientManager,
    context: vscode.ExtensionContext,
    node: any
) {
    try {
        if (!dashboardWebview) {
            dashboardWebview = new ClusterDashboardWebview(context, clientManager);
        }

        // Show dashboard immediately with loading state
        await dashboardWebview.show(node.clusterName);
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
            vscode.window.showErrorMessage(`Failed to load cluster dashboard: ${errorMsg}`);
        }
    }
}
