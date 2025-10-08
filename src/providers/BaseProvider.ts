import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { Logger } from '../infrastructure/Logger';
import { ErrorHandler } from '../infrastructure/ErrorHandler';

/**
 * Base class for all Kafka tree data providers
 * Reduces code duplication and provides common functionality
 */
export abstract class BaseProvider<T extends vscode.TreeItem> implements vscode.TreeDataProvider<T> {
    protected logger: Logger;
    protected _onDidChangeTreeData = new vscode.EventEmitter<T | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        protected clientManager: KafkaClientManager,
        loggerName: string
    ) {
        this.logger = Logger.getLogger(loggerName);
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this.logger.debug('Refreshing tree view');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item representation
     */
    getTreeItem(element: T): vscode.TreeItem {
        return element;
    }

    /**
     * Get children of a tree item
     * Must be implemented by subclasses
     */
    abstract getChildren(element?: T): Promise<T[]>;

    /**
     * Safely get children with error handling
     */
    protected async getChildrenSafely(
        element: T | undefined,
        fetcher: (element: T | undefined) => Promise<T[]>,
        context: string
    ): Promise<T[]> {
        try {
            return await fetcher(element);
        } catch (error) {
            ErrorHandler.handleSilently(error, context);
            return [];
        }
    }

    /**
     * Get all cluster names
     */
    protected getClusters(): string[] {
        return this.clientManager.getClusters();
    }

    /**
     * Create an error tree item
     */
    protected createErrorItem(message: string): vscode.TreeItem {
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
        item.contextValue = 'error';
        return item as T;
    }

    /**
     * Create an empty tree item
     */
    protected createEmptyItem(message: string): vscode.TreeItem {
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        item.contextValue = 'empty';
        return item as T;
    }

    /**
     * Create a loading tree item
     */
    protected createLoadingItem(): vscode.TreeItem {
        const item = new vscode.TreeItem('Loading...', vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('loading~spin');
        item.contextValue = 'loading';
        return item as T;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

