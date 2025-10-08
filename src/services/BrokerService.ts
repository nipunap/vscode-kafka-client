import { Admin } from 'kafkajs';
import { Logger } from '../infrastructure/Logger';

/**
 * Service for managing Kafka broker operations
 * Encapsulates all broker-related logic
 */
export class BrokerService {
    private logger = Logger.getLogger('BrokerService');

    /**
     * Get all brokers in the cluster
     */
    async getBrokers(admin: Admin): Promise<any[]> {
        try {
            this.logger.debug('Fetching brokers');
            
            const cluster = await admin.describeCluster();
            
            this.logger.debug(`Found ${cluster.brokers.length} brokers`);
            return cluster.brokers;
        } catch (error) {
            this.logger.error('Failed to fetch brokers', error);
            throw error;
        }
    }

    /**
     * Get broker configuration
     */
    async getBrokerConfig(admin: Admin, brokerId: number): Promise<any> {
        try {
            this.logger.debug(`Fetching configuration for broker: ${brokerId}`);
            
            const configs = await admin.describeConfigs({
                resources: [{
                    type: 4, // BROKER = 4
                    name: String(brokerId)
                }],
                includeSynonyms: false
            });
            
            if (configs.resources.length === 0) {
                throw new Error(`Broker configuration not found: ${brokerId}`);
            }
            
            return configs.resources[0];
        } catch (error) {
            this.logger.error(`Failed to fetch configuration for broker: ${brokerId}`, error);
            throw error;
        }
    }

    /**
     * Get cluster information
     */
    async getClusterInfo(admin: Admin): Promise<any> {
        try {
            this.logger.debug('Fetching cluster information');
            
            const cluster = await admin.describeCluster();
            
            return {
                clusterId: cluster.clusterId,
                controller: cluster.controller,
                brokers: cluster.brokers
            };
        } catch (error) {
            this.logger.error('Failed to fetch cluster information', error);
            throw error;
        }
    }

    /**
     * Get broker details (broker info + config)
     */
    async getBrokerDetails(admin: Admin, brokerId: number): Promise<any> {
        try {
            this.logger.debug(`Fetching comprehensive details for broker: ${brokerId}`);
            
            const [cluster, config] = await Promise.all([
                admin.describeCluster(),
                this.getBrokerConfig(admin, brokerId)
            ]);
            
            const broker = cluster.brokers.find(b => b.nodeId === brokerId);
            
            if (!broker) {
                throw new Error(`Broker not found: ${brokerId}`);
            }
            
            return {
                brokerId,
                broker,
                config,
                isController: cluster.controller === brokerId
            };
        } catch (error) {
            this.logger.error(`Failed to fetch details for broker: ${brokerId}`, error);
            throw error;
        }
    }
}

