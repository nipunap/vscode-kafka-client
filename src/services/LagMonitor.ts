import * as vscode from 'vscode';
import { KafkaClientManager } from '../kafka/kafkaClientManager';
import { Logger } from '../infrastructure/Logger';
import { EventBus, KafkaEvents } from '../infrastructure/EventBus';

/**
 * Consumer Group Lag Information
 */
export interface ConsumerGroupLag {
    groupId: string;
    topic: string;
    partition: number;
    currentOffset: string;
    logEndOffset: string;
    lag: number;
}

/**
 * Aggregated Lag Alert
 */
interface LagAlert {
    clusterName: string;
    groupId: string;
    totalLag: number;
    severity: 'warning' | 'critical';
    timestamp: number;
}

/**
 * Monitors consumer group lag and sends throttled alerts
 * SEC-3.2-1: Throttle alerts (max 1 per cluster per 5 minutes)
 * SEC-3.2-2: Aggregate multiple alerts into summary
 */
export class LagMonitor {
    private logger = Logger.getLogger('LagMonitor');
    private intervalHandle: NodeJS.Timeout | null = null;
    private lastAlertTime: Map<string, number> = new Map(); // clusterName -> timestamp
    private readonly ALERT_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

    constructor(
        private clientManager: KafkaClientManager,
        private eventBus?: EventBus
    ) {}

    /**
     * Start monitoring lag for all clusters
     */
    public start(): void {
        const config = vscode.workspace.getConfiguration('kafka.lagAlerts');
        const enabled = config.get<boolean>('enabled', false);

        if (!enabled) {
            this.logger.info('Lag monitoring is disabled');
            return;
        }

        const pollIntervalSeconds = config.get<number>('pollIntervalSeconds', 30);
        const pollIntervalMs = pollIntervalSeconds * 1000;

        this.logger.info(`Starting lag monitoring with ${pollIntervalSeconds}s interval`);

        // Initial check
        this.checkAllClusters();

        // Schedule periodic checks
        this.intervalHandle = setInterval(() => {
            this.checkAllClusters();
        }, pollIntervalMs);
    }

    /**
     * Stop monitoring
     */
    public stop(): void {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
            this.logger.info('Lag monitoring stopped');
        }
    }

    /**
     * Check lag for all configured clusters
     */
    private async checkAllClusters(): Promise<void> {
        try {
            const clusters = this.clientManager.getClusters();

            for (const clusterName of clusters) {
                await this.checkClusterLag(clusterName);
            }
        } catch (error: any) {
            this.logger.error('Error checking cluster lag', error);
        }
    }

    /**
     * Check lag for a specific cluster
     */
    private async checkClusterLag(clusterName: string): Promise<void> {
        try {
            const admin = await this.clientManager.getAdminClient(clusterName);
            
            // Get all consumer groups
            const { groups } = await admin.listGroups();

            if (groups.length === 0) {
                return;
            }

            const config = vscode.workspace.getConfiguration('kafka.lagAlerts');
            const warningThreshold = config.get<number>('warningThreshold', 1000);
            const criticalThreshold = config.get<number>('criticalThreshold', 10000);

            const alerts: LagAlert[] = [];

            // Check each consumer group
            for (const group of groups) {
                try {
                    const groupId = group.groupId;
                    
                    // Fetch offsets for this group
                    const offsets = await admin.fetchOffsets({ groupId });

                    // Calculate total lag for this group
                    let totalLag = 0;

                    for (const topicOffsets of offsets) {
                        const topic = topicOffsets.topic;
                        
                        for (const partitionOffset of topicOffsets.partitions) {
                            const partition = partitionOffset.partition;
                            const currentOffset = BigInt(partitionOffset.offset);

                            // Get log end offset
                            const topicOffsets = await admin.fetchTopicOffsets(topic);
                            const partitionInfo = topicOffsets.find(p => p.partition === partition);

                            if (partitionInfo) {
                                const logEndOffset = BigInt(partitionInfo.high);
                                const lag = Number(logEndOffset - currentOffset);

                                if (lag > 0) {
                                    totalLag += lag;
                                }
                            }
                        }
                    }

                    // Check if lag exceeds thresholds
                    if (totalLag >= criticalThreshold) {
                        alerts.push({
                            clusterName,
                            groupId,
                            totalLag,
                            severity: 'critical',
                            timestamp: Date.now()
                        });
                    } else if (totalLag >= warningThreshold) {
                        alerts.push({
                            clusterName,
                            groupId,
                            totalLag,
                            severity: 'warning',
                            timestamp: Date.now()
                        });
                    }
                } catch (error: any) {
                    // Skip groups that fail (might be in rebalancing, etc.)
                    this.logger.debug(`Failed to check lag for group ${group.groupId}: ${error.message}`);
                }
            }

            // Send aggregated alerts if any
            if (alerts.length > 0) {
                this.sendAggregatedAlert(clusterName, alerts);
            }
        } catch (error: any) {
            this.logger.error(`Failed to check lag for cluster ${clusterName}`, error);
        }
    }

    /**
     * Send aggregated alert with throttling
     * SEC-3.2-1: Max 1 alert per cluster per 5 minutes
     * SEC-3.2-2: Aggregate multiple alerts into summary
     */
    private sendAggregatedAlert(clusterName: string, alerts: LagAlert[]): void {
        const now = Date.now();
        const lastAlert = this.lastAlertTime.get(clusterName) || 0;

        // SEC-3.2-1: Throttle alerts
        if (now - lastAlert < this.ALERT_THROTTLE_MS) {
            this.logger.debug(`Throttling alert for cluster ${clusterName} (last alert was ${Math.round((now - lastAlert) / 1000)}s ago)`);
            return;
        }

        // SEC-3.2-2: Aggregate alerts
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        const warningAlerts = alerts.filter(a => a.severity === 'warning');

        let message = `⚠️ Consumer Lag Alert - ${clusterName}\n\n`;

        if (criticalAlerts.length > 0) {
            message += `🔴 Critical (${criticalAlerts.length} groups):\n`;
            criticalAlerts.slice(0, 3).forEach(alert => {
                message += `  • ${alert.groupId}: ${alert.totalLag.toLocaleString()} messages behind\n`;
            });
            if (criticalAlerts.length > 3) {
                message += `  • ... and ${criticalAlerts.length - 3} more\n`;
            }
            message += '\n';
        }

        if (warningAlerts.length > 0) {
            message += `🟡 Warning (${warningAlerts.length} groups):\n`;
            warningAlerts.slice(0, 3).forEach(alert => {
                message += `  • ${alert.groupId}: ${alert.totalLag.toLocaleString()} messages behind\n`;
            });
            if (warningAlerts.length > 3) {
                message += `  • ... and ${warningAlerts.length - 3} more\n`;
            }
        }

        // Show notification
        if (criticalAlerts.length > 0) {
            vscode.window.showErrorMessage(message, 'View Dashboard').then(selection => {
                if (selection === 'View Dashboard') {
                    vscode.commands.executeCommand('kafka.showClusterDashboard', { clusterName });
                }
            });
        } else {
            vscode.window.showWarningMessage(message, 'View Dashboard').then(selection => {
                if (selection === 'View Dashboard') {
                    vscode.commands.executeCommand('kafka.showClusterDashboard', { clusterName });
                }
            });
        }

        // Update last alert time
        this.lastAlertTime.set(clusterName, now);
        this.logger.info(`Sent aggregated lag alert for cluster ${clusterName}: ${criticalAlerts.length} critical, ${warningAlerts.length} warning`);

        // Emit telemetry event
        if (this.eventBus) {
            this.eventBus.emitSync(KafkaEvents.LAG_ALERT_SENT, {
                clusterName,
                criticalCount: criticalAlerts.length,
                warningCount: warningAlerts.length,
                totalGroups: alerts.length
            });
        }
    }

    /**
     * Get current lag for a specific consumer group
     */
    public async getConsumerGroupLag(clusterName: string, groupId: string): Promise<ConsumerGroupLag[]> {
        try {
            const admin = await this.clientManager.getAdminClient(clusterName);
            const offsets = await admin.fetchOffsets({ groupId });

            const lagInfo: ConsumerGroupLag[] = [];

            for (const topicOffsets of offsets) {
                const topic = topicOffsets.topic;

                for (const partitionOffset of topicOffsets.partitions) {
                    const partition = partitionOffset.partition;
                    const currentOffset = partitionOffset.offset;

                    // Get log end offset
                    const topicOffsetsInfo = await admin.fetchTopicOffsets(topic);
                    const partitionInfo = topicOffsetsInfo.find(p => p.partition === partition);

                    if (partitionInfo) {
                        const logEndOffset = partitionInfo.high;
                        const lag = Number(BigInt(logEndOffset) - BigInt(currentOffset));

                        lagInfo.push({
                            groupId,
                            topic,
                            partition,
                            currentOffset,
                            logEndOffset,
                            lag: Math.max(0, lag)
                        });
                    }
                }
            }

            return lagInfo;
        } catch (error: any) {
            this.logger.error(`Failed to get lag for group ${groupId}`, error);
            throw error;
        }
    }
}

