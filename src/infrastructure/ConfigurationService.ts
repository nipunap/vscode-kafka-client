import * as vscode from 'vscode';
import { ClusterConnection } from '../forms/clusterConnectionForm';
import { Logger } from './Logger';

/**
 * Service for managing cluster configuration persistence
 * Handles saving/loading cluster configurations from VSCode settings
 */
export class ConfigurationService {
    private logger = Logger.getLogger('ConfigurationService');

    /**
     * Save cluster configurations to VSCode settings
     */
    save(clusters: ClusterConnection[]): void {
        try {
            const config = vscode.workspace.getConfiguration('kafka');
            const sanitizedClusters = clusters.map(c => this.sanitizeForStorage(c));
            
            config.update('clusters', sanitizedClusters, vscode.ConfigurationTarget.Global);
            this.logger.debug(`Saved ${clusters.length} cluster configurations`);
        } catch (error) {
            this.logger.error('Failed to save cluster configurations', error);
            throw error;
        }
    }

    /**
     * Load cluster configurations from VSCode settings
     */
    async load(): Promise<ClusterConnection[]> {
        try {
            const config = vscode.workspace.getConfiguration('kafka');
            const clusters = config.get<any[]>('clusters', []);
            
            this.logger.info(`Loaded ${clusters.length} cluster configurations`);
            return clusters as ClusterConnection[];
        } catch (error) {
            this.logger.error('Failed to load cluster configurations', error);
            throw error;
        }
    }

    /**
     * Update a specific cluster configuration
     */
    async update(clusterName: string, updatedCluster: ClusterConnection, allClusters: ClusterConnection[]): Promise<void> {
        const index = allClusters.findIndex(c => c.name === clusterName);
        
        if (index === -1) {
            throw new Error(`Cluster "${clusterName}" not found`);
        }

        allClusters[index] = updatedCluster;
        this.save(allClusters);
    }

    /**
     * Remove a cluster configuration
     */
    async remove(clusterName: string, allClusters: ClusterConnection[]): Promise<void> {
        const filtered = allClusters.filter(c => c.name !== clusterName);
        this.save(filtered);
        this.logger.info(`Removed cluster configuration: ${clusterName}`);
    }

    /**
     * Sanitize cluster configuration for storage
     * Removes sensitive data and unnecessary fields
     */
    private sanitizeForStorage(cluster: ClusterConnection): any {
        const sanitized: any = {
            name: cluster.name,
            type: cluster.type,
            brokers: cluster.brokers,
            securityProtocol: cluster.securityProtocol
        };

        // Save MSK-specific configuration (needed for reconnection)
        if (cluster.type === 'msk') {
            sanitized.region = cluster.region;
            sanitized.clusterArn = cluster.clusterArn;
            sanitized.awsProfile = cluster.awsProfile;
            sanitized.assumeRoleArn = cluster.assumeRoleArn;
            sanitized.saslMechanism = cluster.saslMechanism;
        }

        // Save SASL mechanism for non-MSK clusters (but not credentials)
        if (cluster.saslMechanism && cluster.type !== 'msk') {
            sanitized.saslMechanism = cluster.saslMechanism;
            sanitized.saslUsername = cluster.saslUsername;
            // Note: We don't save password for security
        }

        // Save SSL file paths (not the actual certificates)
        if (cluster.sslCaFile || cluster.sslCertFile || cluster.sslKeyFile) {
            sanitized.sslCaFile = cluster.sslCaFile;
            sanitized.sslCertFile = cluster.sslCertFile;
            sanitized.sslKeyFile = cluster.sslKeyFile;
            sanitized.rejectUnauthorized = cluster.rejectUnauthorized;
        }

        return sanitized;
    }

    /**
     * Check if a cluster name already exists
     */
    async exists(clusterName: string): Promise<boolean> {
        const clusters = await this.load();
        return clusters.some(c => c.name === clusterName);
    }

    /**
     * Get a specific cluster configuration
     */
    async get(clusterName: string): Promise<ClusterConnection | undefined> {
        const clusters = await this.load();
        return clusters.find(c => c.name === clusterName);
    }
}

