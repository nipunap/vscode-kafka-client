import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { formatTopicDetailsYaml } from '../utils/formatters';
import { ErrorHandler } from '../infrastructure/ErrorHandler';
import { DocumentationService } from '../services/documentationService';
import { ACL } from '../types/acl';

export async function showACLDetails(clientManager: KafkaClientManager, node: { clusterName: string; acl: ACL }): Promise<void> {
    try {
        const aclDetails = await clientManager.getACLDetails(node.clusterName, node.acl);
        const yaml = formatTopicDetailsYaml(aclDetails);
        
        const doc = await vscode.workspace.openTextDocument({
            content: yaml,
            language: 'yaml'
        });

        await vscode.window.showTextDocument(doc);
    } catch (error: any) {
        ErrorHandler.handle(error, 'showACLDetails');
    }
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
