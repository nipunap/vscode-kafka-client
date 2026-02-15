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

export async function configureExplorerSettings(node?: any) {
    const config = vscode.workspace.getConfiguration('kafka.explorer');

    // Create QuickPick with current values
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = node?.label
        ? `Explorer Settings - ${node.label}`
        : 'Explorer Settings';
    quickPick.placeholder = 'Select a setting to configure';

    quickPick.items = [
        {
            label: '$(list-tree) Topics Threshold',
            description: `Current: ${config.get<number>('topics.threshold', 1000)}`,
            detail: 'Number of topics before switching to paginated view'
        },
        {
            label: '$(organization) Consumer Groups Threshold',
            description: `Current: ${config.get<number>('consumerGroups.threshold', 1000)}`,
            detail: 'Number of consumer groups before switching to paginated view'
        },
        {
            label: '$(server) Brokers Threshold',
            description: `Current: ${config.get<number>('brokers.threshold', 1000)}`,
            detail: 'Number of brokers before switching to paginated view'
        },
        {
            label: '$(lock) ACLs Threshold',
            description: `Current: ${config.get<number>('acls.threshold', 1000)}`,
            detail: 'Number of ACLs before switching to paginated view'
        },
        {
            label: '$(discard) Reset All to Defaults',
            description: 'Set all thresholds to 1000',
            detail: 'Restore default threshold values'
        }
    ];

    quickPick.show();

    const selection = await new Promise<typeof quickPick.items[0] | undefined>(resolve => {
        quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]));
        quickPick.onDidHide(() => resolve(undefined));
    });

    quickPick.dispose();

    if (!selection) {
        return;
    }

    // Handle reset all
    if (selection.label.includes('Reset All')) {
        await Promise.all([
            config.update('topics.threshold', 1000, vscode.ConfigurationTarget.Global),
            config.update('consumerGroups.threshold', 1000, vscode.ConfigurationTarget.Global),
            config.update('brokers.threshold', 1000, vscode.ConfigurationTarget.Global),
            config.update('acls.threshold', 1000, vscode.ConfigurationTarget.Global)
        ]);

        vscode.window.showInformationMessage(
            '✓ All thresholds reset to 1000',
            'Refresh Now'
        ).then(choice => {
            if (choice === 'Refresh Now') {
                vscode.commands.executeCommand('kafka.refreshCluster');
            }
        });
        return;
    }

    // Extract setting key from label
    const settingMap: Record<string, string> = {
        'Topics': 'topics.threshold',
        'Consumer Groups': 'consumerGroups.threshold',
        'Brokers': 'brokers.threshold',
        'ACLs': 'acls.threshold'
    };

    const settingKey = Object.entries(settingMap).find(([key]) =>
        selection.label.includes(key)
    )?.[1];

    if (!settingKey) {
        return;
    }

    const currentValue = config.get<number>(settingKey, 1000);
    const newValue = await vscode.window.showInputBox({
        prompt: `Enter new threshold for ${selection.label}`,
        value: currentValue.toString(),
        placeHolder: '1000',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num)) {
                return 'Must be a number';
            }
            if (num < 10) {
                return 'Minimum value is 10';
            }
            if (num > 10000) {
                return 'Maximum value is 10000';
            }
            return undefined;
        }
    });

    if (!newValue) {
        return;
    }

    await config.update(settingKey, parseInt(newValue), vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
        `✓ ${selection.label} updated to ${newValue}`,
        'Refresh Now'
    ).then(choice => {
        if (choice === 'Refresh Now') {
            vscode.commands.executeCommand('kafka.refreshCluster');
        }
    });
}

