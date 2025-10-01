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
exports.ConsumerGroupTreeItem = exports.ConsumerGroupProvider = void 0;
const vscode = __importStar(require("vscode"));
class ConsumerGroupProvider {
    constructor(clientManager) {
        this.clientManager = clientManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
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
            return clusters.map(cluster => new ConsumerGroupTreeItem(cluster, vscode.TreeItemCollapsibleState.Collapsed, 'cluster', cluster));
        }
        if (element.contextValue === 'cluster') {
            // Show consumer groups for this cluster
            try {
                const groups = await this.clientManager.getConsumerGroups(element.clusterName);
                if (groups.length === 0) {
                    // Show a placeholder item when no consumer groups exist
                    return [
                        new ConsumerGroupTreeItem('No consumer groups found', vscode.TreeItemCollapsibleState.None, 'empty', element.clusterName)
                    ];
                }
                return groups.map(group => new ConsumerGroupTreeItem(group.groupId, vscode.TreeItemCollapsibleState.None, 'consumerGroup', element.clusterName, group.groupId));
            }
            catch (error) {
                console.error(`Failed to load consumer groups for ${element.label}:`, error);
                vscode.window.showErrorMessage(`Failed to load consumer groups for ${element.label}: ${error?.message || error}`);
                return [
                    new ConsumerGroupTreeItem(`Error: ${error?.message || 'Failed to load consumer groups'}`, vscode.TreeItemCollapsibleState.None, 'error', element.clusterName)
                ];
            }
        }
        return [];
    }
}
exports.ConsumerGroupProvider = ConsumerGroupProvider;
class ConsumerGroupTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue, clusterName, groupId) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.clusterName = clusterName;
        this.groupId = groupId;
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        // Add click command for consumer groups
        if (this.contextValue === 'consumerGroup') {
            this.command = {
                command: 'kafka.showConsumerGroupDetails',
                title: 'Show Consumer Group Details',
                arguments: [this]
            };
        }
    }
    getTooltip() {
        if (this.contextValue === 'cluster') {
            return `Cluster: ${this.label}`;
        }
        if (this.contextValue === 'consumerGroup') {
            return `Consumer Group: ${this.label}`;
        }
        return this.label;
    }
    getIcon() {
        if (this.contextValue === 'cluster') {
            return new vscode.ThemeIcon('database');
        }
        if (this.contextValue === 'consumerGroup') {
            return new vscode.ThemeIcon('organization');
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
exports.ConsumerGroupTreeItem = ConsumerGroupTreeItem;
//# sourceMappingURL=consumerGroupProvider.js.map