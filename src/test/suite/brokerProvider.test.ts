import * as assert from 'assert';
import * as vscode from 'vscode';
import { BrokerProvider, BrokerTreeItem } from '../../providers/brokerProvider';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';

suite('Broker Provider Test Suite', () => {
    let clientManager: KafkaClientManager;
    let provider: BrokerProvider;

    setup(() => {
        clientManager = new KafkaClientManager();
        provider = new BrokerProvider(clientManager);
    });

    teardown(async () => {
        await clientManager.dispose();
    });

    suite('BrokerProvider', () => {
        test('should create instance', () => {
            assert.ok(provider);
        });

        test('should have refresh method', () => {
            assert.ok(typeof provider.refresh === 'function');
            provider.refresh(); // Should not throw
        });

        test('should have getTreeItem method', () => {
            assert.ok(typeof provider.getTreeItem === 'function');
        });

        test('should have getChildren method', () => {
            assert.ok(typeof provider.getChildren === 'function');
        });

        test('should return empty array when no clusters', async () => {
            const children = await provider.getChildren();
            assert.strictEqual(Array.isArray(children), true);
            assert.strictEqual(children.length, 0);
        });

        test('should have onDidChangeTreeData event', () => {
            assert.ok(provider.onDidChangeTreeData);
        });
    });

    suite('BrokerTreeItem', () => {
        test('should create cluster item', () => {
            const item = new BrokerTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            assert.strictEqual(item.label, 'test-cluster');
            assert.strictEqual(item.contextValue, 'cluster');
            assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
        });

        test('should create broker item with command', () => {
            const item = new BrokerTreeItem(
                'Broker 1',
                vscode.TreeItemCollapsibleState.None,
                'broker',
                'test-cluster',
                1
            );

            assert.strictEqual(item.label, 'Broker 1');
            assert.strictEqual(item.contextValue, 'broker');
            assert.strictEqual(item.brokerId, 1);
            assert.ok(item.command);
            assert.strictEqual(item.command?.command, 'kafka.showBrokerDetails');
        });

        test('should have correct icon for cluster', () => {
            const item = new BrokerTreeItem(
                'test-cluster',
                vscode.TreeItemCollapsibleState.Collapsed,
                'cluster',
                'test-cluster'
            );

            assert.ok(item.iconPath);
            assert.ok(item.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'database');
        });

        test('should have correct icon for broker', () => {
            const item = new BrokerTreeItem(
                'Broker 1',
                vscode.TreeItemCollapsibleState.None,
                'broker',
                'test-cluster',
                1
            );

            assert.ok(item.iconPath);
            assert.ok(item.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'server');
        });

        test('should have correct icon for empty state', () => {
            const item = new BrokerTreeItem(
                'No brokers found',
                vscode.TreeItemCollapsibleState.None,
                'empty',
                'test-cluster'
            );

            assert.ok(item.iconPath);
            assert.ok(item.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'info');
        });

        test('should have correct icon for error state', () => {
            const item = new BrokerTreeItem(
                'Error: Connection failed',
                vscode.TreeItemCollapsibleState.None,
                'error',
                'test-cluster'
            );

            assert.ok(item.iconPath);
            assert.ok(item.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'error');
        });

        test('should have tooltip', () => {
            const item = new BrokerTreeItem(
                'Broker 1',
                vscode.TreeItemCollapsibleState.None,
                'broker',
                'test-cluster',
                1
            );

            assert.ok(item.tooltip);
            assert.ok((item.tooltip as string).includes('Broker'));
        });
    });
});
