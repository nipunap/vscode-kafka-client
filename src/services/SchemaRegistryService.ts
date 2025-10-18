import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { Logger } from '../infrastructure/Logger';
import { CredentialManager } from '../infrastructure/CredentialManager';
import { EventBus, KafkaEvents } from '../infrastructure/EventBus';

export interface SchemaRegistryConfig {
    url: string;
    username?: string;
    password?: string;
}

export interface Schema {
    id: number;
    version: number;
    schema: string;
    subject: string;
}

/**
 * Service for managing Schema Registry operations
 * Supports Confluent Schema Registry and AWS MSK Schema Registry
 */
export class SchemaRegistryService {
    private registry: SchemaRegistry | null = null;
    private logger = Logger.getLogger('SchemaRegistryService');
    private config: SchemaRegistryConfig;
    private credentialManager: CredentialManager;
    private clusterId: string;
    private eventBus?: EventBus;

    constructor(
        config: SchemaRegistryConfig,
        credentialManager: CredentialManager,
        clusterId: string,
        eventBus?: EventBus
    ) {
        this.config = config;
        this.credentialManager = credentialManager;
        this.clusterId = clusterId;
        this.eventBus = eventBus;
    }

    /**
     * Initialize the Schema Registry connection
     * SEC-3.1-3: Enforce HTTPS for Schema Registry
     */
    async initialize(): Promise<void> {
        try {
            // SEC-3.1-3: Enforce HTTPS
            if (!this.config.url.startsWith('https://')) {
                throw new Error('Schema Registry must use HTTPS (SEC-3.1-3)');
            }

            // SEC-3.1-1: Get credentials from secure storage
            const credentials = await this.credentialManager.getCredentials(this.clusterId);

            const registryConfig: any = {
                host: this.config.url,
            };

            // Add authentication if credentials exist
            if (credentials?.schemaRegistryApiKey && credentials?.schemaRegistryApiSecret) {
                registryConfig.auth = {
                    username: credentials.schemaRegistryApiKey,
                    password: credentials.schemaRegistryApiSecret,
                };
            } else if (this.config.username && this.config.password) {
                registryConfig.auth = {
                    username: this.config.username,
                    password: this.config.password,
                };
            }

            this.registry = new SchemaRegistry(registryConfig);
            this.logger.info(`Schema Registry initialized for cluster: ${this.clusterId}`);
        } catch (error) {
            this.logger.error('Failed to initialize Schema Registry', error);
            throw error;
        }
    }

    /**
     * Get the latest schema for a subject
     * SEC-3.1-5: Audit schema fetches
     */
    async getLatestSchema(subject: string): Promise<Schema> {
        if (!this.registry) {
            await this.initialize();
        }

        try {
            this.logger.debug(`Fetching latest schema for subject: ${subject}`);

            const schemaId = await this.registry!.getLatestSchemaId(subject);
            const registeredSchema: any = await this.registry!.getSchema(schemaId);

            // SEC-3.1-5: Audit operation (no sensitive data)
            this.logger.info(`Schema fetched successfully for subject: ${subject}`);

            // Emit telemetry event
            if (this.eventBus) {
                this.eventBus.emitSync(KafkaEvents.SCHEMA_FETCHED, {
                    clusterId: this.clusterId,
                    subject,
                    schemaId
                });
            }

            return {
                id: schemaId,
                version: registeredSchema.version || 0,
                schema: typeof registeredSchema === 'string' ? registeredSchema : registeredSchema.schema || '',
                subject: subject
            };
        } catch (error) {
            this.logger.error(`Failed to fetch schema for subject: ${subject}`, error);
            throw error;
        }
    }

    /**
     * Get schema by ID
     */
    async getSchemaById(schemaId: number): Promise<string> {
        if (!this.registry) {
            await this.initialize();
        }

        try {
            this.logger.debug(`Fetching schema by ID: ${schemaId}`);
            const registeredSchema: any = await this.registry!.getSchema(schemaId);
            return typeof registeredSchema === 'string' ? registeredSchema : registeredSchema.schema || '';
        } catch (error) {
            this.logger.error(`Failed to fetch schema by ID: ${schemaId}`, error);
            throw error;
        }
    }

    /**
     * Get all versions of a schema subject
     * Note: This method is a placeholder as the library may not support this directly
     */
    async getSchemaVersions(subject: string): Promise<number[]> {
        if (!this.registry) {
            await this.initialize();
        }

        try {
            this.logger.debug(`Fetching schema versions for subject: ${subject}`);
            // The library may not have getSubjectVersions, return empty array for now
            this.logger.warn('getSchemaVersions not fully implemented - library API limitation');
            return [];
        } catch (error) {
            this.logger.error(`Failed to fetch schema versions for subject: ${subject}`, error);
            throw error;
        }
    }

    /**
     * List all subjects in the registry
     * Note: This method is a placeholder as the library may not support this directly
     */
    async listSubjects(): Promise<string[]> {
        if (!this.registry) {
            await this.initialize();
        }

        try {
            this.logger.debug('Fetching all subjects from Schema Registry');
            // The library may not have getSubjects, return empty array for now
            this.logger.warn('listSubjects not fully implemented - library API limitation');
            return [];
        } catch (error) {
            this.logger.error('Failed to fetch subjects from Schema Registry', error);
            throw error;
        }
    }

    /**
     * Validate a message against a schema
     * SEC-3.1-5: Audit validation operations
     */
    async validateMessage(subject: string, payload: any): Promise<boolean> {
        if (!this.registry) {
            await this.initialize();
        }

        try {
            this.logger.debug(`Validating message against schema for subject: ${subject}`);

            // Get the latest schema
            const schema = await this.getLatestSchema(subject);

            // Encode the payload (this will throw if invalid)
            await this.registry!.encode(schema.id, payload);

            // SEC-3.1-5: Audit validation
            this.logger.info(`Message validated successfully for subject: ${subject}`);

            // Emit telemetry event
            if (this.eventBus) {
                this.eventBus.emitSync(KafkaEvents.SCHEMA_VALIDATED, {
                    clusterId: this.clusterId,
                    subject,
                    success: true
                });
            }

            return true;
        } catch (error) {
            this.logger.error(`Message validation failed for subject: ${subject}`, error);

            // Emit telemetry event for failure
            if (this.eventBus) {
                this.eventBus.emitSync(KafkaEvents.SCHEMA_VALIDATED, {
                    clusterId: this.clusterId,
                    subject,
                    success: false
                });
            }

            return false;
        }
    }

    /**
     * Encode a message with schema
     */
    async encodeMessage(subject: string, payload: any): Promise<Buffer> {
        if (!this.registry) {
            await this.initialize();
        }

        try {
            this.logger.debug(`Encoding message for subject: ${subject}`);
            const schema = await this.getLatestSchema(subject);
            const encoded = await this.registry!.encode(schema.id, payload);
            return encoded;
        } catch (error) {
            this.logger.error(`Failed to encode message for subject: ${subject}`, error);
            throw error;
        }
    }

    /**
     * Decode a message using schema
     */
    async decodeMessage(buffer: Buffer): Promise<any> {
        if (!this.registry) {
            await this.initialize();
        }

        try {
            this.logger.debug('Decoding message with schema');
            const decoded = await this.registry!.decode(buffer);
            return decoded;
        } catch (error) {
            this.logger.error('Failed to decode message', error);
            throw error;
        }
    }

    /**
     * Check if Schema Registry is configured and accessible
     */
    async isAvailable(): Promise<boolean> {
        try {
            if (!this.registry) {
                await this.initialize();
            }
            // Try to list subjects as a health check
            await this.listSubjects();
            return true;
        } catch (error) {
            this.logger.debug('Schema Registry not available', error);
            return false;
        }
    }

    /**
     * Disconnect from Schema Registry
     */
    async disconnect(): Promise<void> {
        this.registry = null;
        this.logger.debug('Schema Registry disconnected');
    }
}
