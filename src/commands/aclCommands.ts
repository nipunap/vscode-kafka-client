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
        const detailsView = new DetailsWebview(context, `ACL Details`, '🔒');
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

        detailsView.show(data);
    }, 'Show ACL Details');
}

export async function createACL(_clientManager: KafkaClientManager, _node: { clusterName?: string }): Promise<void> {
    try {
        const message = DocumentationService.getACLManagementMessage();

        await vscode.window.showInformationMessage(message, 'Open Documentation', 'Copy Command')
            .then(async (selection) => {
                if (selection === 'Open Documentation') {
                    await vscode.env.openExternal(vscode.Uri.parse('https://kafka.apache.org/documentation/#security_authz'));
                } else if (selection === 'Copy Command') {
                    await vscode.env.clipboard.writeText('kafka-acls --bootstrap-server <broker> --list');
                    vscode.window.showInformationMessage('Command copied to clipboard');
                }
            });
    } catch (error: any) {
        ErrorHandler.handle(error, 'createACL');
    }
}

export async function deleteACL(clientManager: KafkaClientManager, node: { acl?: ACL }): Promise<void> {
    try {
        const acl = node.acl;
        if (!acl) {
            vscode.window.showErrorMessage('No ACL selected for deletion');
            return;
        }

        const message = `To delete this ACL, use the kafka-acls command line tool:

kafka-acls --bootstrap-server <broker> --remove \\
  --${acl.permissionType || 'allow'}-principal ${acl.principal || 'User:unknown'} \\
  --operation ${acl.operation || 'Unknown'} \\
  --${acl.resourceType || 'topic'} ${acl.resourceName || 'unknown'}`;

        await vscode.window.showInformationMessage(message, 'Copy Command', 'Open Documentation')
            .then(async (selection) => {
                if (selection === 'Copy Command') {
                    await vscode.env.clipboard.writeText(message);
                    vscode.window.showInformationMessage('Command copied to clipboard');
                } else if (selection === 'Open Documentation') {
                    await vscode.env.openExternal(vscode.Uri.parse('https://kafka.apache.org/documentation/#security_authz'));
                }
            });
    } catch (error: any) {
        ErrorHandler.handle(error, 'deleteACL');
    }
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

export async function showACLHelp(_clientManager: KafkaClientManager): Promise<void> {
    try {
        const helpContent = DocumentationService.getACLHelpContent();

        const doc = await vscode.workspace.openTextDocument({
            content: helpContent,
            language: 'html'
        });

        await vscode.window.showTextDocument(doc);
    } catch (error: any) {
        ErrorHandler.handle(error, 'showACLHelp');
    }
}
