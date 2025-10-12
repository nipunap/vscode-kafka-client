/**
 * Audit Log - Track sensitive operations for compliance and debugging
 * Provides operation tracking without storing sensitive data
 */

import { Logger } from './Logger';

export enum AuditOperation {
    // Cluster Operations
    CLUSTER_ADDED = 'CLUSTER_ADDED',
    CLUSTER_REMOVED = 'CLUSTER_REMOVED',
    CLUSTER_CONNECTED = 'CLUSTER_CONNECTED',
    CLUSTER_DISCONNECTED = 'CLUSTER_DISCONNECTED',

    // Topic Operations
    TOPIC_CREATED = 'TOPIC_CREATED',
    TOPIC_DELETED = 'TOPIC_DELETED',
    TOPIC_CONFIG_UPDATED = 'TOPIC_CONFIG_UPDATED',
    MESSAGE_PRODUCED = 'MESSAGE_PRODUCED',
    MESSAGE_CONSUMED = 'MESSAGE_CONSUMED',

    // Consumer Group Operations
    CONSUMER_GROUP_DELETED = 'CONSUMER_GROUP_DELETED',
    CONSUMER_GROUP_OFFSETS_RESET = 'CONSUMER_GROUP_OFFSETS_RESET',

    // ACL Operations
    ACL_CREATED = 'ACL_CREATED',
    ACL_DELETED = 'ACL_DELETED',
    ACL_VIEWED = 'ACL_VIEWED',

    // Administrative Operations
    CONFIG_EXPORTED = 'CONFIG_EXPORTED',
    CREDENTIALS_STORED = 'CREDENTIALS_STORED',
    CREDENTIALS_RETRIEVED = 'CREDENTIALS_RETRIEVED'
}

export enum AuditResult {
    SUCCESS = 'SUCCESS',
    FAILURE = 'FAILURE',
    PARTIAL = 'PARTIAL'
}

export interface AuditEntry {
    /** Unique identifier for this audit entry */
    id: string;

    /** Timestamp when the operation occurred */
    timestamp: Date;

    /** Type of operation performed */
    operation: AuditOperation;

    /** Cluster where the operation was performed */
    cluster: string;

    /** Resource affected (topic name, consumer group, etc.) */
    resource?: string;

    /** Result of the operation */
    result: AuditResult;

    /** Additional context (NO SENSITIVE DATA) */
    metadata?: Record<string, any>;

    /** Error message if operation failed */
    error?: string;

    /** Duration of the operation in milliseconds */
    duration?: number;
}

export class AuditLog {
    private static logger = Logger.getLogger('AuditLog');
    private static entries: AuditEntry[] = [];
    private static readonly MAX_ENTRIES = 1000; // Keep last 1000 entries in memory

    /**
     * Record an audit entry
     */
    static record(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
        const auditEntry: AuditEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            ...entry
        };

        // Add to in-memory store
        this.entries.unshift(auditEntry);

        // Trim to max size
        if (this.entries.length > this.MAX_ENTRIES) {
            this.entries = this.entries.slice(0, this.MAX_ENTRIES);
        }

        // Log to output channel
        this.logEntry(auditEntry);
    }

    /**
     * Record a successful operation
     */
    static success(
        operation: AuditOperation,
        cluster: string,
        resource?: string,
        metadata?: Record<string, any>,
        duration?: number
    ): void {
        this.record({
            operation,
            cluster,
            resource,
            result: AuditResult.SUCCESS,
            metadata,
            duration
        });
    }

    /**
     * Record a failed operation
     */
    static failure(
        operation: AuditOperation,
        cluster: string,
        resource: string | undefined,
        error: string,
        metadata?: Record<string, any>,
        duration?: number
    ): void {
        this.record({
            operation,
            cluster,
            resource,
            result: AuditResult.FAILURE,
            error,
            metadata,
            duration
        });
    }

    /**
     * Get all audit entries (most recent first)
     */
    static getEntries(filter?: {
        operation?: AuditOperation;
        cluster?: string;
        result?: AuditResult;
        since?: Date;
    }): AuditEntry[] {
        let filtered = this.entries;

        if (filter) {
            if (filter.operation) {
                filtered = filtered.filter(e => e.operation === filter.operation);
            }
            if (filter.cluster) {
                filtered = filtered.filter(e => e.cluster === filter.cluster);
            }
            if (filter.result) {
                filtered = filtered.filter(e => e.result === filter.result);
            }
            if (filter.since) {
                filtered = filtered.filter(e => e.timestamp >= filter.since!);
            }
        }

        return filtered;
    }

    /**
     * Get statistics about operations
     */
    static getStatistics(cluster?: string): {
        total: number;
        successful: number;
        failed: number;
        byOperation: Record<string, number>;
        avgDuration: number;
    } {
        const entries = cluster
            ? this.entries.filter(e => e.cluster === cluster)
            : this.entries;

        const byOperation: Record<string, number> = {};
        let totalDuration = 0;
        let durationCount = 0;

        for (const entry of entries) {
            byOperation[entry.operation] = (byOperation[entry.operation] || 0) + 1;

            if (entry.duration !== undefined) {
                totalDuration += entry.duration;
                durationCount++;
            }
        }

        return {
            total: entries.length,
            successful: entries.filter(e => e.result === AuditResult.SUCCESS).length,
            failed: entries.filter(e => e.result === AuditResult.FAILURE).length,
            byOperation,
            avgDuration: durationCount > 0 ? totalDuration / durationCount : 0
        };
    }

    /**
     * Clear all audit entries (for testing or privacy)
     */
    static clear(): void {
        this.entries = [];
        this.logger.info('Audit log cleared');
    }

    /**
     * Export audit log as JSON
     */
    static export(): string {
        return JSON.stringify({
            exportedAt: new Date().toISOString(),
            entries: this.entries,
            statistics: this.getStatistics()
        }, null, 2);
    }

    /**
     * Generate unique ID for audit entry
     */
    private static generateId(): string {
        return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Log audit entry to output channel
     */
    private static logEntry(entry: AuditEntry): void {
        const level = entry.result === AuditResult.SUCCESS ? 'info' : 'warn';
        const duration = entry.duration ? ` (${entry.duration}ms)` : '';
        const resource = entry.resource ? ` ${entry.resource}` : '';
        const error = entry.error ? ` - ${entry.error}` : '';

        const message = `[AUDIT] ${entry.operation} on ${entry.cluster}${resource}: ${entry.result}${duration}${error}`;

        if (level === 'info') {
            this.logger.info(message, entry.metadata);
        } else {
            this.logger.warn(message, entry.metadata);
        }
    }
}
