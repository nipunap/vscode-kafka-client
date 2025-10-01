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
exports.KafkaTreeItem = exports.KafkaExplorerProvider = void 0;
const vscode = __importStar(require("vscode"));
class KafkaExplorerProvider {
    constructor(clientManager) {
        this.clientManager = clientManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Load saved clusters on startup
        this.clientManager.loadConfiguration();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level - show clusters
            const clusters = this.clientManager.getClusters();
            return clusters.map(cluster => new KafkaTreeItem(cluster, vscode.TreeItemCollapsibleState.Collapsed, 'cluster', cluster));
        }
        if (element.contextValue === 'cluster') {
            // Show topics for this cluster
            try {
                const topics = await this.clientManager.getTopics(element.clusterName);
                if (topics.length === 0) {
                    return [
                        new KafkaTreeItem('No topics found', vscode.TreeItemCollapsibleState.None, 'empty', element.clusterName)
                    ];
                }
                return topics.map(topic => new KafkaTreeItem(topic, vscode.TreeItemCollapsibleState.None, 'topic', element.clusterName, topic));
            }
            catch (error) {
                console.error(`Failed to load topics for ${element.label}:`, error);
                // Show error in the tree view
                return [
                    new KafkaTreeItem(`Error: Connection failed`, vscode.TreeItemCollapsibleState.None, 'error', element.clusterName)
                ];
            }
        }
        return [];
    }
}
exports.KafkaExplorerProvider = KafkaExplorerProvider;
class KafkaTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue, clusterName, topicName) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.clusterName = clusterName;
        this.topicName = topicName;
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        // Add click command for topics
        if (this.contextValue === 'topic') {
            this.command = {
                command: 'kafka.showTopicDetails',
                title: 'Show Topic Details',
                arguments: [this]
            };
        }
    }
    getTooltip() {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'topic') {
            return `Topic: ${this.label}`;
        }
        return this.label;
    }
    getIcon() {
        if (this.contextValue === 'cluster') {
            return new vscode.ThemeIcon('database');
        }
        if (this.contextValue === 'topic') {
            return new vscode.ThemeIcon('symbol-event');
        }
        if (this.contextValue === 'empty') {
            return new vscode.ThemeIcon('info');
        }
        if (this.contextValue === 'error') {
            return new vscode.ThemeIcon('error');
        }
        return new vscode.ThemeIcon('circle-outline');
    }
}
exports.KafkaTreeItem = KafkaTreeItem;
//# sourceMappingURL=kafkaExplorerProvider.js.map