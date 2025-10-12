/**
 * Input Validator - Validate and sanitize user inputs
 * Prevents injection attacks and ensures data integrity
 */

export class InputValidator {
    /**
     * Validate topic name
     * Kafka topic names: alphanumeric, dots, underscores, hyphens (max 249 chars)
     */
    static isValidTopicName(name: string): boolean {
        if (!name || typeof name !== 'string') {
            return false;
        }
        if (name.length === 0 || name.length > 249) {
            return false;
        }
        // Kafka allows: a-z, A-Z, 0-9, ., _, -
        return /^[a-zA-Z0-9._-]+$/.test(name);
    }

    /**
     * Validate consumer group ID
     */
    static isValidConsumerGroupId(groupId: string): boolean {
        if (!groupId || typeof groupId !== 'string') {
            return false;
        }
        if (groupId.length === 0 || groupId.length > 255) {
            return false;
        }
        // Consumer groups have same rules as topics
        return /^[a-zA-Z0-9._-]+$/.test(groupId);
    }

    /**
     * Validate partition number
     */
    static isValidPartition(partition: any): boolean {
        const num = Number(partition);
        return Number.isInteger(num) && num >= 0 && num < 100000;
    }

    /**
     * Validate replication factor
     */
    static isValidReplicationFactor(factor: any): boolean {
        const num = Number(factor);
        return Number.isInteger(num) && num >= 1 && num <= 32767;
    }

    /**
     * Validate message key (can be any string, but check length)
     */
    static isValidMessageKey(key: string): boolean {
        if (typeof key !== 'string') {
            return false;
        }
        // Max 1MB for keys
        return key.length <= 1048576;
    }

    /**
     * Validate message value (can be any string, but check length)
     */
    static isValidMessageValue(value: string): boolean {
        if (typeof value !== 'string') {
            return false;
        }
        // Max 10MB for messages (configurable in Kafka, but this is a reasonable default)
        return value.length <= 10485760;
    }

    /**
     * Validate JSON string
     */
    static isValidJSON(jsonString: string): boolean {
        if (typeof jsonString !== 'string') {
            return false;
        }
        try {
            JSON.parse(jsonString);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate broker address (host:port)
     */
    static isValidBrokerAddress(address: string): boolean {
        if (!address || typeof address !== 'string') {
            return false;
        }
        // host:port format
        const regex = /^[a-zA-Z0-9.-]+:\d{1,5}$/;
        if (!regex.test(address)) {
            return false;
        }
        const [, portStr] = address.split(':');
        const port = parseInt(portStr, 10);
        return port > 0 && port <= 65535;
    }

    /**
     * Validate cluster name (alphanumeric, underscores, hyphens)
     */
    static isValidClusterName(name: string): boolean {
        if (!name || typeof name !== 'string') {
            return false;
        }
        if (name.length === 0 || name.length > 255) {
            return false;
        }
        return /^[a-zA-Z0-9_-]+$/.test(name);
    }

    /**
     * Sanitize string for display (prevent XSS)
     */
    static sanitizeForDisplay(input: string): string {
        if (typeof input !== 'string') {
            return String(input);
        }
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Validate command name (for webview messages)
     */
    static isValidCommand(command: any, allowedCommands: string[]): boolean {
        if (typeof command !== 'string') {
            return false;
        }
        return allowedCommands.includes(command);
    }

    /**
     * Validate offset value
     */
    static isValidOffset(offset: any): boolean {
        if (typeof offset === 'string') {
            // Special values
            if (offset === 'beginning' || offset === 'latest') {
                return true;
            }
        }
        const num = Number(offset);
        return Number.isInteger(num) && num >= 0;
    }

    /**
     * Validate timeout value (milliseconds)
     */
    static isValidTimeout(timeout: any): boolean {
        const num = Number(timeout);
        return Number.isInteger(num) && num >= 0 && num <= 300000; // Max 5 minutes
    }

    /**
     * Validate ACL principal format
     */
    static isValidPrincipal(principal: string): boolean {
        if (!principal || typeof principal !== 'string') {
            return false;
        }
        // Format: User:username or Group:groupname
        return /^(User|Group):[a-zA-Z0-9._-]+$/.test(principal);
    }

    /**
     * Validate ACL host (IP address or *)
     */
    static isValidACLHost(host: string): boolean {
        if (!host || typeof host !== 'string') {
            return false;
        }
        // Allow wildcard
        if (host === '*') {
            return true;
        }
        // Simple IP v4 validation
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    }

    /**
     * Comprehensive validation with error messages
     */
    static validate(
        value: any,
        rules: {
            required?: boolean;
            type?: 'string' | 'number' | 'boolean' | 'object';
            min?: number;
            max?: number;
            pattern?: RegExp;
            custom?: (val: any) => boolean;
        }
    ): { valid: boolean; error?: string } {
        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            return { valid: false, error: 'Value is required' };
        }

        // Skip other checks if not required and empty
        if (!rules.required && (value === undefined || value === null || value === '')) {
            return { valid: true };
        }

        // Type check
        if (rules.type && typeof value !== rules.type) {
            return { valid: false, error: `Expected type ${rules.type}, got ${typeof value}` };
        }

        // Min/Max for strings
        if (typeof value === 'string') {
            if (rules.min !== undefined && value.length < rules.min) {
                return { valid: false, error: `Minimum length is ${rules.min}` };
            }
            if (rules.max !== undefined && value.length > rules.max) {
                return { valid: false, error: `Maximum length is ${rules.max}` };
            }
        }

        // Min/Max for numbers
        if (typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                return { valid: false, error: `Minimum value is ${rules.min}` };
            }
            if (rules.max !== undefined && value > rules.max) {
                return { valid: false, error: `Maximum value is ${rules.max}` };
            }
        }

        // Pattern check
        if (rules.pattern && typeof value === 'string') {
            if (!rules.pattern.test(value)) {
                return { valid: false, error: 'Invalid format' };
            }
        }

        // Custom validation
        if (rules.custom && !rules.custom(value)) {
            return { valid: false, error: 'Validation failed' };
        }

        return { valid: true };
    }
}
