/**
 * Kafka Error Classifier - Centralized error detection and classification
 * Extracted from KafkaClientManager to reduce duplication and improve maintainability
 */

export enum KafkaErrorType {
    /** ACLs/Authorization not enabled on cluster - expected in many environments */
    AUTHORIZATION_DISABLED = 'AUTHORIZATION_DISABLED',

    /** ACL permission denied - user lacks required permissions */
    AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',

    /** AWS credential issues */
    CREDENTIAL_ERROR = 'CREDENTIAL_ERROR',

    /** Network/connection errors */
    NETWORK_ERROR = 'NETWORK_ERROR',

    /** Kafka protocol errors */
    KAFKA_PROTOCOL_ERROR = 'KAFKA_PROTOCOL_ERROR',

    /** Unknown/unclassified errors */
    UNKNOWN = 'UNKNOWN'
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class KafkaErrorClassifier {
    /**
     * Classify an error into a specific type
     */
    static classify(error: any): KafkaErrorType {
        if (!error) {
            return KafkaErrorType.UNKNOWN;
        }

        const message = (error?.message || error?.toString() || '').toLowerCase();

        // Check for authorization disabled (expected error)
        if (this.isAuthorizationDisabled(message)) {
            return KafkaErrorType.AUTHORIZATION_DISABLED;
        }

        // Check for authorization failures (real errors)
        if (this.isAuthorizationFailed(message)) {
            return KafkaErrorType.AUTHORIZATION_FAILED;
        }

        // Check for credential errors
        if (this.isCredentialError(message)) {
            return KafkaErrorType.CREDENTIAL_ERROR;
        }

        // Check for network errors
        if (this.isNetworkError(message)) {
            return KafkaErrorType.NETWORK_ERROR;
        }

        // Check for Kafka protocol errors
        if (this.isKafkaProtocolError(message)) {
            return KafkaErrorType.KAFKA_PROTOCOL_ERROR;
        }

        return KafkaErrorType.UNKNOWN;
    }

    /**
     * Get appropriate log level for an error type
     */
    static getLogLevel(error: any): LogLevel {
        const errorType = this.classify(error);

        switch (errorType) {
            case KafkaErrorType.AUTHORIZATION_DISABLED:
                // Expected in many environments - not a real error
                return 'warn';

            case KafkaErrorType.AUTHORIZATION_FAILED:
            case KafkaErrorType.CREDENTIAL_ERROR:
            case KafkaErrorType.KAFKA_PROTOCOL_ERROR:
                // Real errors that need attention
                return 'error';

            case KafkaErrorType.NETWORK_ERROR:
                // Could be temporary - error but might resolve
                return 'error';

            default:
                return 'error';
        }
    }

    /**
     * Check if error is due to authorization/ACLs being disabled on the cluster
     * This is EXPECTED behavior in many Kafka clusters (especially dev/test)
     */
    static isAuthorizationDisabled(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return lowerMessage.includes('security features are disabled') ||
               lowerMessage.includes('security_disabled') ||
               lowerMessage.includes('authorization is not enabled') ||
               lowerMessage.includes('authorizer is not configured');
    }

    /**
     * Check if error is an actual authorization failure (user lacks permissions)
     * This is a REAL error that needs to be fixed
     */
    static isAuthorizationFailed(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return lowerMessage.includes('authorization_failed') ||
               lowerMessage.includes('authorization failed') ||
               lowerMessage.includes('topic_authorization_failed') ||
               lowerMessage.includes('group_authorization_failed') ||
               lowerMessage.includes('cluster_authorization_failed') ||
               lowerMessage.includes('transactional_id_authorization_failed') ||
               lowerMessage.includes('not authorized') ||
               lowerMessage.includes('not authorised') ||
               lowerMessage.includes('access denied') ||
               (lowerMessage.includes('kafka') && lowerMessage.includes('acl') && lowerMessage.includes('denied'));
    }

    /**
     * Check if error is credential-related (AWS, SASL, etc.)
     */
    static isCredentialError(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return lowerMessage.includes('credential') ||
               lowerMessage.includes('expired') ||
               lowerMessage.includes('expiredtoken') ||
               lowerMessage.includes('accessdenied') ||
               lowerMessage.includes('authentication') ||
               lowerMessage.includes('unauthenticated') ||
               lowerMessage.includes('sasl') ||
               lowerMessage.includes('invalid username') ||
               lowerMessage.includes('invalid password');
    }

    /**
     * Check if error is network-related
     */
    static isNetworkError(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return lowerMessage.includes('econnrefused') ||
               lowerMessage.includes('enotfound') ||
               lowerMessage.includes('etimedout') ||
               lowerMessage.includes('timeout') ||
               lowerMessage.includes('network') ||
               lowerMessage.includes('connection') ||
               lowerMessage.includes('unreachable') ||
               lowerMessage.includes('connect failed');
    }

    /**
     * Check if error is a Kafka protocol error
     */
    static isKafkaProtocolError(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return lowerMessage.includes('broker') ||
               lowerMessage.includes('topic') ||
               lowerMessage.includes('partition') ||
               lowerMessage.includes('consumer group') ||
               lowerMessage.includes('offset') ||
               lowerMessage.includes('kafkajs');
    }

    /**
     * Check if an error should be logged as warning instead of error
     * Returns true for expected/informational errors
     */
    static isExpectedError(error: any): boolean {
        const errorType = this.classify(error);
        return errorType === KafkaErrorType.AUTHORIZATION_DISABLED;
    }

    /**
     * Get user-friendly error message
     */
    static getUserFriendlyMessage(error: any, context?: string): string {
        const errorType = this.classify(error);
        const originalMessage = error?.message || error?.toString() || 'Unknown error';

        const prefix = context ? `${context}: ` : '';

        switch (errorType) {
            case KafkaErrorType.AUTHORIZATION_DISABLED:
                return `${prefix}ACL/Authorization features are not enabled on this Kafka cluster. This is normal for many development environments.`;

            case KafkaErrorType.AUTHORIZATION_FAILED:
                return `${prefix}Authorization failed. You don't have permission to perform this operation. Check your Kafka ACL permissions.`;

            case KafkaErrorType.CREDENTIAL_ERROR:
                if (originalMessage.includes('expired') || originalMessage.includes('ExpiredToken')) {
                    return `${prefix}AWS credentials have expired. Please refresh your credentials and try again.`;
                }
                if (originalMessage.includes('AccessDenied')) {
                    return `${prefix}Access denied. Check that your AWS profile has the necessary permissions.`;
                }
                return `${prefix}Credential error. Please check your authentication settings.`;

            case KafkaErrorType.NETWORK_ERROR:
                if (originalMessage.includes('ECONNREFUSED')) {
                    return `${prefix}Connection refused. Check that the broker is running and accessible.`;
                }
                if (originalMessage.includes('ENOTFOUND')) {
                    return `${prefix}Host not found. Check the broker address.`;
                }
                if (originalMessage.includes('timeout')) {
                    return `${prefix}Operation timed out. Check network connectivity and broker availability.`;
                }
                return `${prefix}Network error. Check your connection and broker settings.`;

            case KafkaErrorType.KAFKA_PROTOCOL_ERROR:
                return `${prefix}Kafka protocol error: ${originalMessage}`;

            default:
                return `${prefix}${originalMessage}`;
        }
    }
}
