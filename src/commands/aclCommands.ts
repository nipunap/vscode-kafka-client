import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { DetailsWebview, DetailsData } from '../views/DetailsWebview';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { DocumentationService } from '../services/documentationService';
import { ACL } from '../types/acl';

export async function showACLDetails(clientManager: KafkaClientManager, node: { clusterName: string; acl: ACL }, context?: vscode.ExtensionContext): Promise<void> {
    await ErrorHandler.wrap(async () => {
        const aclDetails = await clientManager.getACLDetails(node.clusterName, node.acl);

        // If no context provided, fall back to text document
        if (!context) {
            const { formatTopicDetailsYaml } = await import('../utils/formatters');
            const yaml = formatTopicDetailsYaml(aclDetails);
            const doc = await vscode.workspace.openTextDocument({
                content: yaml,
                language: 'yaml'
            });
            await vscode.window.showTextDocument(doc);
            return;
        }

        // Create HTML view
        const detailsView = new DetailsWebview(`ACL Details`, '🔒', context);
        const data: DetailsData = {
            title: `${aclDetails.principal} → ${aclDetails.operation}`,
            showCopyButton: true,
            showRefreshButton: false,
            notice: {
                type: 'info',
                text: '✏️ Edit mode coming soon! You\'ll be able to modify ACL configurations directly from this view.'
            },
            sections: [
                {
                    title: 'ACL Information',
                    icon: '🔒',
                    properties: [
                        {
                            label: 'Principal',
                            value: aclDetails.principal,
                            code: true
                        },
                        {
                            label: 'Operation',
                            value: aclDetails.operation
                        },
                        {
                            label: 'Permission Type',
                            value: aclDetails.permissionType,
                            badge: {
                                type: aclDetails.permissionType.toLowerCase() === 'allow' ? 'success' : 'danger',
                                text: aclDetails.permissionType.toUpperCase()
                            }
                        },
                        {
                            label: 'Resource Type',
                            value: aclDetails.resourceType
                        },
                        {
                            label: 'Resource Name',
                            value: aclDetails.resourceName,
                            code: true
                        },
                        {
                            label: 'Host',
                            value: aclDetails.host
                        },
                        {
                            label: 'Pattern Type',
                            value: aclDetails.resourcePatternType
                        }
                    ]
                },
                {
                    title: 'Description',
                    icon: '📝',
                    html: `<p style="padding: 10px; line-height: 1.8;">${aclDetails.description}</p>`
                }
            ]
        };

        detailsView.showDetails(data);
    }, 'Show ACL Details');
}

export async function createACL(clientManager: KafkaClientManager, node: { clusterName?: string }): Promise<void> {
    await ErrorHandler.wrap(async () => {
        // Get cluster name
        let clusterName = node.clusterName;
        if (!clusterName) {
            const clusters = clientManager.getClusters();
            if (clusters.length === 0) {
                vscode.window.showInformationMessage('No clusters configured');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                clusters.map(c => ({ label: c, value: c })),
                { placeHolder: 'Select a cluster' }
            );

            if (!selected) {
                return;
            }
            clusterName = selected.value;
        }

        // Collect ACL details through input boxes
        const resourceType = await vscode.window.showQuickPick(
            [
                { label: 'Topic', value: 'topic' },
                { label: 'Group', value: 'group' },
                { label: 'Cluster', value: 'cluster' },
                { label: 'Transactional ID', value: 'transactional_id' }
            ],
            { placeHolder: 'Select resource type' }
        );
        if (!resourceType) { return; }

        const resourceName = await vscode.window.showInputBox({
            prompt: 'Resource name (* for wildcard)',
            placeHolder: 'e.g., my-topic or *',
            validateInput: (value) => value.trim() ? null : 'Resource name is required'
        });
        if (!resourceName) { return; }

        const principal = await vscode.window.showInputBox({
            prompt: 'Principal (e.g., User:alice)',
            placeHolder: 'User:username',
            validateInput: (value) => value.trim() ? null : 'Principal is required'
        });
        if (!principal) { return; }

        const operation = await vscode.window.showQuickPick(
            [
                { label: 'All', value: 'all' },
                { label: 'Read', value: 'read' },
                { label: 'Write', value: 'write' },
                { label: 'Create', value: 'create' },
                { label: 'Delete', value: 'delete' },
                { label: 'Alter', value: 'alter' },
                { label: 'Describe', value: 'describe' },
                { label: 'Cluster Action', value: 'cluster_action' },
                { label: 'Describe Configs', value: 'describe_configs' },
                { label: 'Alter Configs', value: 'alter_configs' },
                { label: 'Idempotent Write', value: 'idempotent_write' }
            ],
            { placeHolder: 'Select operation' }
        );
        if (!operation) { return; }

        const permissionType = await vscode.window.showQuickPick(
            [
                { label: 'Allow', value: 'allow' },
                { label: 'Deny', value: 'deny' }
            ],
            { placeHolder: 'Select permission type' }
        );
        if (!permissionType) { return; }

        const host = await vscode.window.showInputBox({
            prompt: 'Host (* for any host)',
            value: '*',
            placeHolder: '*'
        });
        if (host === undefined) { return; }

        const patternType = await vscode.window.showQuickPick(
            [
                { label: 'Literal', value: 'LITERAL', description: 'Exact match' },
                { label: 'Prefixed', value: 'PREFIXED', description: 'Prefix match' }
            ],
            { placeHolder: 'Select pattern type' }
        );
        if (!patternType) { return; }

        // Create the ACL
        await clientManager.createACL(clusterName, {
            resourceType: resourceType.value,
            resourceName: resourceName.trim(),
            principal: principal.trim(),
            operation: operation.value,
            permissionType: permissionType.value as 'allow' | 'deny',
            host: host.trim() || '*',
            resourcePatternType: patternType.value
        });

        vscode.window.showInformationMessage(
            `✅ ACL created: ${principal.trim()} can ${operation.label} on ${resourceType.label} "${resourceName.trim()}"`
        );
    }, 'Create ACL');
}

export async function deleteACL(clientManager: KafkaClientManager, node: { acl?: ACL; clusterName?: string }): Promise<void> {
    await ErrorHandler.wrap(async () => {
        const acl = node.acl;
        if (!acl) {
            vscode.window.showErrorMessage('No ACL selected for deletion');
            return;
        }

        // Get cluster name
        let clusterName = node.clusterName;
        if (!clusterName) {
            const clusters = clientManager.getClusters();
            if (clusters.length === 0) {
                vscode.window.showInformationMessage('No clusters configured');
                return;
            }

            if (clusters.length === 1) {
                clusterName = clusters[0];
            } else {
                const selected = await vscode.window.showQuickPick(
                    clusters.map(c => ({ label: c, value: c })),
                    { placeHolder: 'Select a cluster' }
                );

                if (!selected) {
                    return;
                }
                clusterName = selected.value;
            }
        }

        // Confirm deletion
        const aclDescription = `${acl.principal} → ${acl.operation} on ${acl.resourceType} "${acl.resourceName}" (${acl.permissionType})`;
        const confirmation = await vscode.window.showWarningMessage(
            `Delete ACL: ${aclDescription}?`,
            { modal: true },
            'Delete'
        );

        if (confirmation !== 'Delete') {
            return;
        }

        // Delete the ACL
        await clientManager.deleteACL(clusterName, {
            resourceType: acl.resourceType,
            resourceName: acl.resourceName,
            principal: acl.principal,
            operation: acl.operation,
            host: acl.host,
            resourcePatternType: acl.resourcePatternType
        });

        vscode.window.showInformationMessage(`✅ ACL deleted: ${aclDescription}`);
    }, 'Delete ACL');
}

export async function findACL(clientManager: KafkaClientManager): Promise<void> {
    try {
        const clusters = clientManager.getClusters();

        if (clusters.length === 0) {
            vscode.window.showInformationMessage('No clusters configured');
            return;
        }

        const message = DocumentationService.getACLSearchMessage();

        await vscode.window.showInformationMessage(message, 'Copy Command', 'Open Documentation')
            .then(async (selection) => {
                if (selection === 'Copy Command') {
                    await vscode.env.clipboard.writeText('kafka-acls --bootstrap-server <broker> --list');
                    vscode.window.showInformationMessage('Command copied to clipboard');
                } else if (selection === 'Open Documentation') {
                    await vscode.env.openExternal(vscode.Uri.parse('https://kafka.apache.org/documentation/#security_authz'));
                }
            });
    } catch (error: any) {
        ErrorHandler.handle(error, 'findACL');
    }
}

export async function showACLHelp(_clientManager: KafkaClientManager, context?: vscode.ExtensionContext): Promise<void> {
    try {
        const helpContent = DocumentationService.getACLHelpContent();

        // If no context provided, fall back to text document
        if (!context) {
            const doc = await vscode.workspace.openTextDocument({
                content: helpContent,
                language: 'html'
            });
            await vscode.window.showTextDocument(doc);
            return;
        }

        // Create webview panel for proper HTML rendering
        const panel = vscode.window.createWebviewPanel(
            'aclHelp',
            '🔒 ACL Help & Documentation',
            vscode.ViewColumn.One,
            {
                enableScripts: false,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = helpContent;
    } catch (error: any) {
        ErrorHandler.handle(error, 'showACLHelp');
    }
}
