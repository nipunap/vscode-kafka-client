import * as vscode from 'vscode';
import { Logger } from './Logger';

export interface StoredCredentials {
    saslPassword?: string;
    sslPassword?: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsSessionToken?: string;
    schemaRegistryApiKey?: string;
    schemaRegistryApiSecret?: string;
}

/**
 * Manages secure storage of credentials using VSCode's SecretStorage API
 */
export class CredentialManager {
    private logger = Logger.getLogger('CredentialManager');

    constructor(private secrets: vscode.SecretStorage) {}

    /**
     * Store credentials for a cluster securely
     */
    async storeCredentials(clusterId: string, credentials: StoredCredentials): Promise<void> {
        try {
            const key = this.getKey(clusterId);
            const serialized = JSON.stringify(credentials);
            await this.secrets.store(key, serialized);
            this.logger.debug(`Stored credentials for cluster: ${clusterId}`);
        } catch (error) {
            this.logger.error(`Failed to store credentials for cluster: ${clusterId}`, error);
            throw new Error('Failed to store credentials securely');
        }
    }

    /**
     * Retrieve credentials for a cluster
     */
    async getCredentials(clusterId: string): Promise<StoredCredentials | undefined> {
        try {
            const key = this.getKey(clusterId);
            const serialized = await this.secrets.get(key);

            if (!serialized) {
                this.logger.debug(`No credentials found for cluster: ${clusterId}`);
                return undefined;
            }

            const credentials = JSON.parse(serialized) as StoredCredentials;
            this.logger.debug(`Retrieved credentials for cluster: ${clusterId}`);
            return credentials;
        } catch (error) {
            this.logger.error(`Failed to retrieve credentials for cluster: ${clusterId}`, error);
            return undefined;
        }
    }

    /**
     * Delete credentials for a cluster
     */
    async deleteCredentials(clusterId: string): Promise<void> {
        try {
            const key = this.getKey(clusterId);
            await this.secrets.delete(key);
            this.logger.debug(`Deleted credentials for cluster: ${clusterId}`);
        } catch (error) {
            this.logger.error(`Failed to delete credentials for cluster: ${clusterId}`, error);
            throw new Error('Failed to delete credentials');
        }
    }

    /**
     * Store a single credential value
     */
    async storePassword(clusterId: string, passwordType: 'sasl' | 'ssl', password: string): Promise<void> {
        const existing = await this.getCredentials(clusterId) || {};

        if (passwordType === 'sasl') {
            existing.saslPassword = password;
        } else {
            existing.sslPassword = password;
        }

        await this.storeCredentials(clusterId, existing);
    }

    /**
     * Get a single credential value
     */
    async getPassword(clusterId: string, passwordType: 'sasl' | 'ssl'): Promise<string | undefined> {
        const credentials = await this.getCredentials(clusterId);
        return passwordType === 'sasl' ? credentials?.saslPassword : credentials?.sslPassword;
    }

    /**
     * Store Schema Registry credentials
     */
    async storeSchemaRegistryCredentials(clusterId: string, apiKey: string, apiSecret: string): Promise<void> {
        const existing = await this.getCredentials(clusterId) || {};
        existing.schemaRegistryApiKey = apiKey;
        existing.schemaRegistryApiSecret = apiSecret;
        await this.storeCredentials(clusterId, existing);
    }

    /**
     * Get Schema Registry credentials
     */
    async getSchemaRegistryCredentials(clusterId: string): Promise<{ apiKey?: string; apiSecret?: string }> {
        const credentials = await this.getCredentials(clusterId);
        return {
            apiKey: credentials?.schemaRegistryApiKey,
            apiSecret: credentials?.schemaRegistryApiSecret
        };
    }

    /**
     * Check if credentials exist for a cluster
     */
    async hasCredentials(clusterId: string): Promise<boolean> {
        const credentials = await this.getCredentials(clusterId);
        return credentials !== undefined && Object.keys(credentials).length > 0;
    }

    /**
     * Migrate plain text credentials to secure storage
     */
    async migrateFromPlainText(clusterId: string, plainTextCreds: StoredCredentials): Promise<void> {
        this.logger.info(`Migrating plain text credentials to secure storage: ${clusterId}`);

        // Store in secure storage
        await this.storeCredentials(clusterId, plainTextCreds);

        // Clear sensitive data from plain text creds object
        if (plainTextCreds.saslPassword) {
            plainTextCreds.saslPassword = undefined;
        }
        if (plainTextCreds.sslPassword) {
            plainTextCreds.sslPassword = undefined;
        }
        if (plainTextCreds.awsAccessKeyId) {
            plainTextCreds.awsAccessKeyId = undefined;
        }
        if (plainTextCreds.awsSecretAccessKey) {
            plainTextCreds.awsSecretAccessKey = undefined;
        }
        if (plainTextCreds.awsSessionToken) {
            plainTextCreds.awsSessionToken = undefined;
        }
        if (plainTextCreds.schemaRegistryApiKey) {
            plainTextCreds.schemaRegistryApiKey = undefined;
        }
        if (plainTextCreds.schemaRegistryApiSecret) {
            plainTextCreds.schemaRegistryApiSecret = undefined;
        }

        this.logger.info(`Migration completed for cluster: ${clusterId}`);
    }

    /**
     * Generate storage key for a cluster
     */
    private getKey(clusterId: string): string {
        // Use a consistent key format
        return `kafka.cluster.${clusterId}.credentials`;
    }

    /**
     * Clear all stored credentials (for cleanup/testing)
     */
    async clearAll(clusterIds: string[]): Promise<void> {
        this.logger.info(`Clearing credentials for ${clusterIds.length} clusters`);

        for (const clusterId of clusterIds) {
            try {
                await this.deleteCredentials(clusterId);
            } catch (error) {
                this.logger.error(`Failed to clear credentials for ${clusterId}`, error);
            }
        }
    }
}
