/**
 * Maps Kafka ConfigSource numeric values to human-readable text
 * @see https://github.com/apache/kafka/blob/trunk/clients/src/main/java/org/apache/kafka/common/requests/DescribeConfigsResponse.java
 */

export class ConfigSourceMapper {
    /**
     * Map ConfigSource number to user-friendly text
     */
    public static toHumanReadable(source: number | string): string {
        const sourceNum = typeof source === 'string' ? parseInt(source, 10) : source;

        switch (sourceNum) {
            case 0:
                return 'Unknown';
            case 1:
                return 'Topic Override';
            case 2:
                return 'Dynamic Broker';
            case 3:
                return 'Dynamic Default';
            case 4:
                return 'Server Config';
            case 5:
                return 'Kafka Default';
            case 6:
                return 'Dynamic Logger';
            default:
                return String(source);
        }
    }

    /**
     * Map ConfigSource number to detailed description
     */
    public static toDescription(source: number | string): string {
        const sourceNum = typeof source === 'string' ? parseInt(source, 10) : source;

        switch (sourceNum) {
            case 0:
                return 'Unknown configuration source';
            case 1:
                return 'Topic-specific configuration override (highest priority)';
            case 2:
                return 'Dynamic broker configuration (can be changed without restart)';
            case 3:
                return 'Dynamic default broker configuration';
            case 4:
                return 'Static broker configuration from server.properties';
            case 5:
                return 'Kafka built-in default value (lowest priority)';
            case 6:
                return 'Dynamic logger configuration (log levels)';
            default:
                return 'Configuration source';
        }
    }

    /**
     * Get icon for source type
     */
    public static toIcon(source: number | string): string {
        const sourceNum = typeof source === 'string' ? parseInt(source, 10) : source;

        switch (sourceNum) {
            case 0:
                return '❓';
            case 1:
                return '🎯'; // Topic override - targeted
            case 2:
                return '⚡'; // Dynamic - can change
            case 3:
                return '⚙️'; // Dynamic default
            case 4:
                return '📄'; // Server.properties - file
            case 5:
                return '🔧'; // Default - built-in
            case 6:
                return '📝'; // Logger
            default:
                return '📋';
        }
    }
}
