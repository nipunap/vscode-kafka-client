import { Admin, Producer, Kafka } from 'kafkajs';
import { Logger } from './Logger';

interface PooledConnection {
    kafka: Kafka;
    admin: Admin;
    producer: Producer;
    lastUsed: Date;
    useCount: number;
    isConnected: boolean;
}

export class ConnectionPool {
    private logger = Logger.getLogger('ConnectionPool');
    private connections: Map<string, PooledConnection> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;
    
    // Configuration
    private readonly maxIdleTime: number = 5 * 60 * 1000; // 5 minutes
    private readonly cleanupIntervalMs: number = 60 * 1000; // 1 minute

    constructor() {
        this.startCleanupTask();
    }

    /**
     * Get or create a connection for a cluster
     */
    async get(name: string, kafkaFactory: () => Kafka): Promise<{ admin: Admin; producer: Producer }> {
        const existing = this.connections.get(name);
        
        if (existing && existing.isConnected) {
            // Update last used time
            existing.lastUsed = new Date();
            existing.useCount++;
            
            this.logger.debug(`Reusing connection for cluster: ${name} (use count: ${existing.useCount})`);
            
            return {
                admin: existing.admin,
                producer: existing.producer
            };
        }

        // Create new connection
        this.logger.info(`Creating new connection for cluster: ${name}`);
        
        const kafka = kafkaFactory();
        const admin = kafka.admin();
        const producer = kafka.producer();

        // Connect admin and producer
        try {
            await admin.connect();
            await producer.connect();
            
            const connection: PooledConnection = {
                kafka,
                admin,
                producer,
                lastUsed: new Date(),
                useCount: 1,
                isConnected: true
            };

            this.connections.set(name, connection);
            
            this.logger.info(`Successfully connected to cluster: ${name}`);
            
            return { admin, producer };
        } catch (error) {
            this.logger.error(`Failed to connect to cluster: ${name}`, error);
            
            // Clean up partially created connections
            try {
                await admin.disconnect();
                await producer.disconnect();
            } catch (_cleanupError) {
                // Ignore cleanup errors
            }
            
            throw error;
        }
    }

    /**
     * Manually disconnect a specific cluster
     */
    async disconnect(name: string): Promise<void> {
        const connection = this.connections.get(name);
        
        if (!connection) {
            this.logger.debug(`No connection found for cluster: ${name}`);
            return;
        }

        this.logger.info(`Disconnecting cluster: ${name}`);
        
        try {
            if (connection.isConnected) {
                await Promise.all([
                    connection.admin.disconnect(),
                    connection.producer.disconnect()
                ]);
                connection.isConnected = false;
            }
            
            this.connections.delete(name);
            this.logger.info(`Successfully disconnected cluster: ${name}`);
        } catch (error) {
            this.logger.error(`Error disconnecting cluster: ${name}`, error);
            // Still remove from pool even if disconnect fails
            this.connections.delete(name);
        }
    }

    /**
     * Disconnect all connections
     */
    async disconnectAll(): Promise<void> {
        this.logger.info(`Disconnecting all connections (${this.connections.size} clusters)`);
        
        const disconnectPromises = Array.from(this.connections.keys()).map(name =>
            this.disconnect(name)
        );

        await Promise.allSettled(disconnectPromises);
        
        this.logger.info('All connections disconnected');
    }

    /**
     * Get connection statistics
     */
    getStats(): Map<string, { useCount: number; lastUsed: Date; isConnected: boolean }> {
        const stats = new Map<string, { useCount: number; lastUsed: Date; isConnected: boolean }>();
        
        for (const [name, conn] of this.connections) {
            stats.set(name, {
                useCount: conn.useCount,
                lastUsed: conn.lastUsed,
                isConnected: conn.isConnected
            });
        }
        
        return stats;
    }

    /**
     * Check if a cluster has an active connection
     */
    hasConnection(name: string): boolean {
        const conn = this.connections.get(name);
        return conn !== undefined && conn.isConnected;
    }

    /**
     * Periodic cleanup of idle connections
     */
    private startCleanupTask(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleConnections();
        }, this.cleanupIntervalMs);
        
        this.logger.debug('Cleanup task started');
    }

    /**
     * Stop the cleanup task
     */
    private stopCleanupTask(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            this.logger.debug('Cleanup task stopped');
        }
    }

    /**
     * Clean up connections that have been idle too long
     */
    private async cleanupIdleConnections(): Promise<void> {
        const now = Date.now();
        const clustersToClean: string[] = [];

        for (const [name, conn] of this.connections) {
            const idleTime = now - conn.lastUsed.getTime();
            
            if (idleTime > this.maxIdleTime) {
                this.logger.debug(`Connection to ${name} idle for ${Math.round(idleTime / 1000)}s, cleaning up`);
                clustersToClean.push(name);
            }
        }

        if (clustersToClean.length > 0) {
            this.logger.info(`Cleaning up ${clustersToClean.length} idle connections`);
            
            for (const name of clustersToClean) {
                await this.disconnect(name);
            }
        }
    }

    /**
     * Dispose of the connection pool
     */
    async dispose(): Promise<void> {
        this.logger.info('Disposing connection pool');
        
        this.stopCleanupTask();
        await this.disconnectAll();
        
        this.logger.info('Connection pool disposed');
    }
}

