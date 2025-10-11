/**
 * Formatting utilities for displaying Kafka data in human-readable formats
 */

/**
 * Format consumed messages as JSON
 */
export function formatMessages(messages: any[]): string {
    return JSON.stringify(
        messages.map(msg => ({
            partition: msg.partition,
            offset: msg.offset,
            key: msg.key?.toString(),
            value: msg.value?.toString(),
            timestamp: msg.timestamp,
            headers: msg.headers
        })),
        null,
        2
    );
}

/**
 * Format topic details as YAML
 */
export function formatTopicDetailsYaml(details: any): string {
    const totalMessages = Object.values(details.partitionDetails).reduce(
        (sum: number, p: any) => {
            const count = typeof p.messageCount === 'string' ?
                parseInt(p.messageCount) : p.messageCount;
            return sum + (isNaN(count) ? 0 : count);
        },
        0
    );

    let yaml = `# Topic Configuration\n`;
    yaml += `# Similar to: kafka-configs.sh --describe --entity-type topics --entity-name ${details.name}\n`;
    yaml += `# Generated at ${new Date().toLocaleString()}\n\n`;

    yaml += `topic:\n`;
    yaml += `  name: "${details.name}"\n`;
    yaml += `  partitions: ${details.partitions}\n`;
    yaml += `  replicationFactor: ${details.replicationFactor}\n`;
    yaml += `  totalMessages: ${totalMessages}\n\n`;

    yaml += `partitions:\n`;
    const sortedPartitions = Object.entries(details.partitionDetails).sort(
        ([a], [b]) => Number(a) - Number(b)
    );

    for (const [_partId, part] of sortedPartitions) {
        const p = part as any;
        const msgCount = typeof p.messageCount === 'string' ?
            parseInt(p.messageCount) : p.messageCount;
        const count = isNaN(msgCount) ? 0 : msgCount;

        yaml += `  - partition: ${p.partition}\n`;
        yaml += `    leader: ${p.leader}\n`;
        yaml += `    replicas: [${p.replicas.join(', ')}]\n`;
        yaml += `    isr: [${p.isr.join(', ')}]\n`;
        yaml += `    offsets:\n`;
        yaml += `      low: "${p.lowWaterMark}"\n`;
        yaml += `      high: "${p.highWaterMark}"\n`;
        yaml += `    messages: ${count}\n\n`;
    }

    // Group configurations by source
    const configsBySource: { [key: string]: any[] } = {
        'DYNAMIC_TOPIC_CONFIG': [],
        'DYNAMIC_BROKER_CONFIG': [],
        'DYNAMIC_DEFAULT_BROKER_CONFIG': [],
        'STATIC_BROKER_CONFIG': [],
        'DEFAULT_CONFIG': [],
        'OTHER': []
    };

    for (const config of details.configuration) {
        const source = config.configSource || 'OTHER';
        if (configsBySource[source]) {
            configsBySource[source].push(config);
        } else {
            configsBySource['OTHER'].push(config);
        }
    }

    yaml += `configuration:\n`;
    yaml += `  total: ${details.configuration.length}\n\n`;

    // Show non-default configs first
    const nonDefaultConfigs = details.configuration.filter((c: any) => !c.isDefault);
    if (nonDefaultConfigs.length > 0) {
        yaml += `  # Non-default configurations (${nonDefaultConfigs.length})\n`;
        yaml += `  modified:\n`;
        for (const config of nonDefaultConfigs) {
            const value = config.configValue || 'null';
            const safeValue = value.includes(':') || value.includes('\n') || value.includes('\\') || value.includes('"') ?
                `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
            const source = config.configSource || 'UNKNOWN';
            const sensitive = config.isSensitive ? ' [SENSITIVE]' : '';
            const readOnly = config.isReadOnly ? ' [READ-ONLY]' : '';
            yaml += `    ${config.configName}: ${safeValue}  # ${source}${sensitive}${readOnly}\n`;
        }
        yaml += `\n`;
    }

    // Show all configurations grouped by source
    yaml += `  # All configurations by source\n`;

    for (const [source, configs] of Object.entries(configsBySource)) {
        if (configs.length === 0) {
            continue;
        }

        const sourceLabel = source.replace(/_/g, ' ').toLowerCase();
        yaml += `  ${sourceLabel}:\n`;

        // Sort configs by name
        configs.sort((a, b) => a.configName.localeCompare(b.configName));

        for (const config of configs) {
            const value = config.configValue || 'null';
            const safeValue = value.includes(':') || value.includes('\n') || value.includes('\\') || value.includes('"') ?
                `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
            const sensitive = config.isSensitive ? ' [SENSITIVE]' : '';
            const readOnly = config.isReadOnly ? ' [READ-ONLY]' : '';
            const isDefault = config.isDefault ? ' [default]' : '';
            yaml += `    ${config.configName}: ${safeValue}${sensitive}${readOnly}${isDefault}\n`;
        }
        yaml += `\n`;
    }

    return yaml;
}

/**
 * Format consumer group details as YAML
 */
export function formatConsumerGroupDetailsYaml(details: any): string {
    let yaml = `# Consumer Group Details\n`;
    yaml += `# Generated at ${new Date().toLocaleString()}\n\n`;

    yaml += `consumerGroup:\n`;
    yaml += `  groupId: "${details.groupId}"\n`;
    yaml += `  state: "${details.state}"\n`;
    yaml += `  protocolType: "${details.protocolType}"\n`;
    yaml += `  protocol: "${details.protocol || 'N/A'}"\n`;
    yaml += `  memberCount: ${details.members.length}\n`;
    yaml += `  totalLag: ${details.totalLag}\n\n`;

    if (details.members.length > 0) {
        yaml += `members:\n`;
        for (const member of details.members) {
            yaml += `  - memberId: "${member.memberId}"\n`;
            yaml += `    clientId: "${member.clientId}"\n`;
            yaml += `    clientHost: "${member.clientHost}"\n\n`;
        }
    } else {
        yaml += `members: []  # No active members\n\n`;
    }

    if (details.offsets.length > 0) {
        yaml += `offsets:\n`;

        // Group by topic for better readability
        const byTopic: { [key: string]: any[] } = {};
        for (const offset of details.offsets) {
            if (!byTopic[offset.topic]) {
                byTopic[offset.topic] = [];
            }
            byTopic[offset.topic].push(offset);
        }

        for (const [topic, offsets] of Object.entries(byTopic)) {
            yaml += `  - topic: "${topic}"\n`;
            yaml += `    partitions:\n`;

            // Sort by partition number
            offsets.sort((a, b) => a.partition - b.partition);

            for (const offset of offsets) {
                let lagStatus = 'ok';
                if (offset.lag > 10000) {
                    lagStatus = 'critical';
                } else if (offset.lag > 1000) {
                    lagStatus = 'warning';
                } else if (offset.lag > 0) {
                    lagStatus = 'minor';
                }

                yaml += `      - partition: ${offset.partition}\n`;
                yaml += `        currentOffset: "${offset.currentOffset}"\n`;
                yaml += `        highWaterMark: "${offset.highWaterMark}"\n`;
                yaml += `        lag: ${offset.lag}\n`;
                yaml += `        status: ${lagStatus}\n`;
            }
            yaml += `\n`;
        }
    } else {
        yaml += `offsets: []  # No offset information\n`;
    }

    return yaml;
}

/**
 * Format broker details as YAML
 */
export function formatBrokerDetailsYaml(details: any): string {
    let yaml = `# Broker Configuration\n`;
    yaml += `# Similar to: kafka-configs.sh --describe --entity-type brokers --entity-name ${details.nodeId}\n`;
    yaml += `# Generated at ${new Date().toLocaleString()}\n\n`;

    yaml += `broker:\n`;
    yaml += `  nodeId: ${details.nodeId}\n`;
    yaml += `  host: "${details.host}"\n`;
    yaml += `  port: ${details.port}\n`;
    yaml += `  rack: "${details.rack}"\n\n`;

    // Group configurations by source
    const configsBySource: { [key: string]: any[] } = {
        'DYNAMIC_BROKER_CONFIG': [],
        'DYNAMIC_DEFAULT_BROKER_CONFIG': [],
        'STATIC_BROKER_CONFIG': [],
        'DEFAULT_CONFIG': [],
        'OTHER': []
    };

    for (const config of details.configuration) {
        const source = config.configSource || 'OTHER';
        if (configsBySource[source]) {
            configsBySource[source].push(config);
        } else {
            configsBySource['OTHER'].push(config);
        }
    }

    yaml += `configuration:\n`;
    yaml += `  total: ${details.configuration.length}\n\n`;

    // Show non-default configs first
    const nonDefaultConfigs = details.configuration.filter((c: any) => !c.isDefault);
    if (nonDefaultConfigs.length > 0) {
        yaml += `  # Non-default configurations (${nonDefaultConfigs.length})\n`;
        yaml += `  modified:\n`;
        for (const config of nonDefaultConfigs) {
            const value = config.configValue || 'null';
            const safeValue = value.includes(':') || value.includes('\n') || value.includes('\\') || value.includes('"') ?
                `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
            const source = config.configSource || 'UNKNOWN';
            const sensitive = config.isSensitive ? ' [SENSITIVE]' : '';
            const readOnly = config.isReadOnly ? ' [READ-ONLY]' : '';
            yaml += `    ${config.configName}: ${safeValue}  # ${source}${sensitive}${readOnly}\n`;
        }
        yaml += `\n`;
    }

    // Show all configurations grouped by source
    yaml += `  # All configurations by source\n`;

    for (const [source, configs] of Object.entries(configsBySource)) {
        if (configs.length === 0) {
            continue;
        }

        const sourceLabel = source.replace(/_/g, ' ').toLowerCase();
        yaml += `  ${sourceLabel}:\n`;

        // Sort configs by name
        configs.sort((a, b) => a.configName.localeCompare(b.configName));

        for (const config of configs) {
            const value = config.configValue || 'null';
            const safeValue = value.includes(':') || value.includes('\n') || value.includes('\\') || value.includes('"') ?
                `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
            const sensitive = config.isSensitive ? ' [SENSITIVE]' : '';
            const readOnly = config.isReadOnly ? ' [READ-ONLY]' : '';
            const isDefault = config.isDefault ? ' [default]' : '';
            yaml += `    ${config.configName}: ${safeValue}${sensitive}${readOnly}${isDefault}\n`;
        }
        yaml += `\n`;
    }

    return yaml;
}

/**
 * Convert milliseconds to human-readable time format
 * @param ms Milliseconds
 * @returns Human-readable time string
 */
export function formatMilliseconds(ms: number | string): string {
    const msNum = typeof ms === 'string' ? parseFloat(ms) : ms;

    if (isNaN(msNum) || msNum < 0) {
        return String(ms);
    }

    // Special cases
    if (msNum === 0) {
        return '0ms';
    }
    if (msNum === 9223372036854775807 || msNum > 9000000000000000) {
        return 'unlimited';
    }
    if (msNum === -1) {
        return 'unlimited';
    }

    const seconds = msNum / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const days = hours / 24;
    const weeks = days / 7;

    // Choose the most appropriate unit
    if (weeks >= 1 && weeks === Math.floor(weeks)) {
        return weeks === 1 ? '1 week' : `${weeks} weeks`;
    }
    if (days >= 1 && days === Math.floor(days)) {
        return days === 1 ? '1 day' : `${days} days`;
    }
    if (hours >= 1 && hours === Math.floor(hours)) {
        return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    if (minutes >= 1 && minutes === Math.floor(minutes)) {
        return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    }
    if (seconds >= 1 && seconds === Math.floor(seconds)) {
        return seconds === 1 ? '1 second' : `${seconds} seconds`;
    }

    // For sub-second values
    if (msNum === Math.floor(msNum)) {
        return msNum === 1 ? '1ms' : `${msNum}ms`;
    }

    return `${msNum.toFixed(2)}ms`;
}

/**
 * Convert bytes to human-readable size format
 * @param bytes Number of bytes
 * @returns Human-readable size string
 */
export function formatBytes(bytes: number | string): string {
    const bytesNum = typeof bytes === 'string' ? parseFloat(bytes) : bytes;

    if (isNaN(bytesNum) || bytesNum < 0) {
        return String(bytes);
    }

    // Special cases
    if (bytesNum === 0) {
        return '0 bytes';
    }
    if (bytesNum === -1) {
        return 'unlimited';
    }
    if (bytesNum > 9000000000000000000) {
        return 'unlimited';
    }

    const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const k = 1024;

    // Find the appropriate unit
    let unitIndex = 0;
    let size = bytesNum;

    while (size >= k && unitIndex < units.length - 1) {
        size /= k;
        unitIndex++;
    }

    // Format with appropriate precision
    if (size === Math.floor(size)) {
        return `${size} ${units[unitIndex]}`;
    }

    // Use 2 decimal places for non-integer values
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Check if a config property name indicates milliseconds
 */
export function isMillisecondsProperty(propertyName: string): boolean {
    return propertyName.endsWith('.ms');
}

/**
 * Check if a config property name indicates bytes
 */
export function isBytesProperty(propertyName: string): boolean {
    return propertyName.endsWith('.bytes') ||
           propertyName.endsWith('.byte') ||
           propertyName === 'max.message.bytes' ||
           propertyName === 'message.max.bytes' ||
           propertyName === 'fetch.max.bytes' ||
           propertyName === 'socket.request.max.bytes' ||
           propertyName === 'socket.receive.buffer.bytes' ||
           propertyName === 'socket.send.buffer.bytes' ||
           propertyName === 'replica.fetch.max.bytes';
}

/**
 * Format a config value based on its property name
 */
export function formatConfigValue(propertyName: string, value: string | number): string {
    if (isMillisecondsProperty(propertyName)) {
        return formatMilliseconds(value);
    }
    if (isBytesProperty(propertyName)) {
        return formatBytes(value);
    }
    return String(value);
}
