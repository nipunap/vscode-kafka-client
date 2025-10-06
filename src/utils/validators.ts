/**
 * Validation utilities for user inputs
 */

/**
 * Validates a broker address in the format host:port
 *
 * Security considerations:
 * - Prevents URL injection attacks
 * - Blocks special characters that could manipulate connection strings
 * - Ensures proper host:port format
 * - Prevents CRLF injection and other protocol-level attacks
 *
 * @param broker The broker string to validate (e.g., "localhost:9092")
 * @returns true if valid, error message if invalid
 */
export function validateBrokerAddress(broker: string): string | undefined {
    // Check for dangerous characters BEFORE trimming (to catch trailing CRLF)
    // Specifically looking for: newlines, carriage returns, null bytes, URL special chars
    const dangerousChars = /[\r\n\0@/?#]/;
    if (dangerousChars.test(broker)) {
        return 'Broker address contains invalid characters';
    }

    const trimmed = broker.trim();

    // Check for empty input
    if (!trimmed) {
        return 'Broker address cannot be empty';
    }

    // Handle IPv6 addresses specially (they have multiple colons and are in brackets)
    let host: string;
    let portStr: string;

    if (trimmed.startsWith('[')) {
        // IPv6 format: [host]:port
        const ipv6Match = trimmed.match(/^(\[[0-9a-fA-F:]+\]):(\d+)$/);
        if (!ipv6Match) {
            return 'Invalid IPv6 format. Must be [host]:port (e.g., [::1]:9092)';
        }
        host = ipv6Match[1];
        portStr = ipv6Match[2];
    } else {
        // Regular format: host:port
        const parts = trimmed.split(':');
        if (parts.length !== 2) {
            return 'Broker address must be in format host:port (e.g., localhost:9092)';
        }
        [host, portStr] = parts;
    }

    // Validate host part
    if (!host || host.length === 0) {
        return 'Host cannot be empty';
    }

    // Host should be either:
    // 1. Valid IPv6 address in brackets (checked first due to special format)
    // 2. Valid IPv4 address (checked before hostname to catch invalid formats like 1.2.3)
    // 3. Valid hostname (alphanumeric, dots, hyphens)
    const ipv6Regex = /^\[([0-9a-fA-F:]+)\]$/;
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

    // Check IPv6 first (special format with brackets)
    const isValidIPv6 = ipv6Regex.test(host);
    if (!isValidIPv6) {
        // Not IPv6, check if it looks like an IPv4 (contains only digits and dots)
        const looksLikeIPv4 = /^[\d.]+$/.test(host);
        if (looksLikeIPv4) {
            // If it looks like IPv4, it MUST be a valid IPv4 (not a malformed one like 1.2.3)
            const ipv4Match = host.match(ipv4Regex);
            if (!ipv4Match) {
                return 'Invalid IPv4 address format. Must have exactly 4 octets (e.g., 192.168.1.1)';
            }

            // Validate each octet is 0-255
            const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]].map(Number);
            if (octets.some(octet => octet < 0 || octet > 255)) {
                return 'Invalid IPv4 address: octets must be between 0 and 255';
            }
            // Valid IPv4, continue to port validation
        } else {
            // Not IPv4 or IPv6, check if it's a valid hostname
            const isValidHostname = hostnameRegex.test(host);
            if (!isValidHostname) {
                return 'Invalid host format. Must be a valid hostname, IPv4, or IPv6 address';
            }
            // Valid hostname, continue to port validation
        }
    }
    // Valid IPv6, IPv4, or hostname - continue to port validation

    // Validate port part
    if (!portStr || portStr.length === 0) {
        return 'Port cannot be empty';
    }

    // Port must be a number
    const port = parseInt(portStr, 10);
    if (isNaN(port) || portStr !== port.toString()) {
        return 'Port must be a valid number';
    }

    // Port must be in valid range (1-65535)
    if (port < 1 || port > 65535) {
        return 'Port must be between 1 and 65535';
    }

    return undefined; // Valid
}

/**
 * Validates a comma-separated list of broker addresses
 *
 * @param brokersInput Comma-separated broker addresses
 * @returns Error message if invalid, undefined if valid
 */
export function validateBrokerList(brokersInput: string): string | undefined {
    if (!brokersInput || brokersInput.trim().length === 0) {
        return 'At least one broker is required';
    }

    const brokers = brokersInput.split(',').map(b => b.trim()).filter(b => b.length > 0);

    if (brokers.length === 0) {
        return 'At least one broker is required';
    }

    // Validate each broker
    for (const broker of brokers) {
        const error = validateBrokerAddress(broker);
        if (error) {
            return `Invalid broker "${broker}": ${error}`;
        }
    }

    return undefined; // All valid
}

/**
 * Sanitizes and validates broker addresses, returning an array of valid brokers
 * Throws an error if any broker is invalid
 *
 * @param brokersInput Comma-separated broker addresses
 * @returns Array of validated broker addresses
 * @throws Error if validation fails
 */
export function sanitizeBrokerList(brokersInput: string): string[] {
    const error = validateBrokerList(brokersInput);
    if (error) {
        throw new Error(error);
    }

    return brokersInput
        .split(',')
        .map(b => b.trim())
        .filter(b => b.length > 0);
}
