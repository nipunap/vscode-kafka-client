/**
 * Service to fetch AI-enhanced parameter details from Apache Kafka and AWS MSK documentation
 */

import * as vscode from 'vscode';
import { Logger } from '../infrastructure/Logger';
import { AIAdvisor } from './AIAdvisor';

export class ParameterAIService {
    private static instance: ParameterAIService;
    private logger = Logger.getLogger('ParameterAIService');
    private cache: Map<string, { content: string; timestamp: number }> = new Map();
    private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

    private constructor() {}

    public static getInstance(): ParameterAIService {
        if (!ParameterAIService.instance) {
            ParameterAIService.instance = new ParameterAIService();
        }
        return ParameterAIService.instance;
    }

    /**
     * Get AI-enhanced details for a Kafka parameter
     */
    public async getParameterDetails(parameterName: string): Promise<string> {
        // Check cache first
        const cached = this.cache.get(parameterName);
        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
            this.logger.debug(`Returning cached AI details for ${parameterName}`);
            return cached.content;
        }

        this.logger.info(`Fetching AI details for parameter: ${parameterName}`);

        try {
            // Check if AI is available
            const aiAvailable = await AIAdvisor.checkAvailability();

            let details: string;

            if (aiAvailable) {
                // Use VS Code Language Model API for dynamic, context-aware responses
                details = await this.getAIEnhancedDetails(parameterName);
            } else {
                // Fall back to curated static content
                details = await this.getCuratedDetails(parameterName);
            }

            // Cache the result
            this.cache.set(parameterName, {
                content: details,
                timestamp: Date.now()
            });

            return details;
        } catch (error: any) {
            this.logger.error(`Error fetching parameter details: ${error.message}`, error);
            throw new Error(`Failed to fetch parameter details: ${error.message}`);
        }
    }

    /**
     * Get AI-enhanced details using VS Code Language Model API with timeout
     */
    private async getAIEnhancedDetails(parameterName: string): Promise<string> {
        try {
            // Set a 5-second timeout for AI requests
            const timeoutPromise = new Promise<string>((_, reject) => {
                setTimeout(() => reject(new Error('AI request timed out after 5 seconds')), 5000);
            });

            const aiPromise = this.fetchAIResponse(parameterName);

            // Race between AI request and timeout
            return await Promise.race([aiPromise, timeoutPromise]);
        } catch (error: any) {
            this.logger.warn(`AI request failed, falling back to curated content: ${error.message}`);
            return this.getCuratedDetails(parameterName);
        }
    }

    /**
     * Fetch response from AI model
     */
    private async fetchAIResponse(parameterName: string): Promise<string> {
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4'
        });

        const model = models[0] || (await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-3.5-turbo'
        }))[0];

        if (!model) {
            throw new Error('No AI model available');
        }

        const messages = [
            vscode.LanguageModelChatMessage.User(`You are a Kafka configuration expert. Provide a COMPACT, CONCISE explanation of the Kafka parameter "${parameterName}".

**Output Format (max 150 words):**

📝 Purpose: [One clear sentence]

🎯 Default: [Default value] | AWS MSK: [MSK default if different]

⚠️ Production Recommendation: [Concise best practice]

📚 Use Case: [When/why to modify]

🔗 Reference: kafka.apache.org/documentation

**Important:**
- Be EXTREMELY COMPACT (max 150 words)
- One sentence per section
- No verbose explanations
- Focus on actionable info only`)
        ];

        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

        let fullResponse = '';
        for await (const fragment of response.text) {
            fullResponse += fragment;
        }

        return fullResponse.trim() || this.getCuratedDetails(parameterName);
    }

    /**
     * Get curated details from our knowledge base
     * This provides high-quality, concise information without external API calls
     */
    private async getCuratedDetails(parameterName: string): Promise<string> {
        const normalizedParam = parameterName.toLowerCase().replace(/_/g, '.');

        // Common Kafka broker configurations
        const brokerConfigs: { [key: string]: string } = {
            'auto.create.topics.enable':
                '📝 Purpose: Controls automatic topic creation when producers/consumers reference non-existent topics.\n\n' +
                '🎯 Default: true | AWS MSK: false\n' +
                '⚠️ Production Recommendation: Disable (false) to prevent accidental topic creation with default settings (1 partition, replication factor 1).\n\n' +
                '📚 Use Case: Enable in dev/test for convenience. Disable in production and use explicit topic creation with proper partition/replication settings.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#brokerconfigs_auto.create.topics.enable',

            'default.replication.factor':
                '📝 Purpose: Default replication factor for automatically created topics.\n\n' +
                '🎯 Default: 1 | AWS MSK: 3\n' +
                '⚠️ Production Recommendation: Set to 3 for fault tolerance (can survive 2 broker failures).\n\n' +
                '📚 Use Case: Higher replication = better durability but more storage. Minimum 2 for production.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#brokerconfigs_default.replication.factor',

            'min.insync.replicas':
                '📝 Purpose: Minimum number of replicas that must acknowledge a write for it to be considered successful.\n\n' +
                '🎯 Default: 1 | AWS MSK: 2\n' +
                '⚠️ Production Recommendation: Set to 2 when replication.factor=3 for balanced durability.\n\n' +
                '📚 Use Case: Prevents data loss if broker fails mid-write. Use with producer acks=all for strongest guarantees.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#topicconfigs_min.insync.replicas',

            'log.retention.ms':
                '📝 Purpose: Maximum time to retain log segments before deletion (milliseconds).\n\n' +
                '🎯 Default: 604800000 (7 days) | AWS MSK: Same\n' +
                '⚠️ Production Recommendation: Adjust based on storage capacity and compliance needs.\n\n' +
                '📚 Use Case: Balance between data availability and storage costs. Common: 3-30 days for general use, longer for audit logs.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#topicconfigs_retention.ms',

            'log.retention.hours':
                '📝 Purpose: Alternative to log.retention.ms (in hours). Lower priority than ms setting.\n\n' +
                '🎯 Default: 168 hours (7 days)\n' +
                '⚠️ Production Recommendation: Use log.retention.ms for precise control.\n\n' +
                '📚 Use Case: Simpler configuration for hour-granularity retention.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#topicconfigs_retention.ms',

            'num.network.threads':
                '📝 Purpose: Number of threads handling network requests (receiving/sending data).\n\n' +
                '🎯 Default: 3 | AWS MSK: 8 (optimized)\n' +
                '⚠️ Production Recommendation: Increase for high-throughput workloads (8-16 threads).\n\n' +
                '📚 Use Case: More threads = better concurrent client handling. Monitor CPU usage.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#brokerconfigs_num.network.threads',

            'num.io.threads':
                '📝 Purpose: Number of threads performing disk I/O operations.\n\n' +
                '🎯 Default: 8 | AWS MSK: 16 (optimized)\n' +
                '⚠️ Production Recommendation: Match your disk count (1-2 threads per disk).\n\n' +
                '📚 Use Case: More threads = better I/O parallelism. Important for write-heavy workloads.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#brokerconfigs_num.io.threads',

            'log.segment.bytes':
                '📝 Purpose: Maximum size of a single log segment file.\n\n' +
                '🎯 Default: 1073741824 (1 GB) | AWS MSK: Same\n' +
                '⚠️ Production Recommendation: Smaller segments (256-512 MB) for faster recovery, larger for less overhead.\n\n' +
                '📚 Use Case: Affects retention granularity and disk I/O patterns. Smaller = more frequent file rolls.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#topicconfigs_segment.bytes',

            'offsets.retention.minutes':
                '📝 Purpose: How long to retain consumer group offset commits after the group becomes empty.\n\n' +
                '🎯 Default: 10080 minutes (7 days) | AWS MSK: Same\n' +
                '⚠️ Production Recommendation: Increase for infrequent consumers (30+ days).\n\n' +
                '📚 Use Case: Prevents offset loss for consumers that run intermittently (e.g., batch jobs).\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#brokerconfigs_offsets.retention.minutes',

            'compression.type':
                '📝 Purpose: Compression codec for messages (none, gzip, snappy, lz4, zstd).\n\n' +
                '🎯 Default: producer | AWS MSK: Same\n' +
                '⚠️ Production Recommendation: Use lz4 or zstd for best speed/compression balance.\n\n' +
                '📚 Use Case: Reduces network bandwidth and storage. zstd offers best compression, lz4 fastest speed.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#topicconfigs_compression.type',

            'unclean.leader.election.enable':
                '📝 Purpose: Whether to allow out-of-sync replicas to become leaders.\n\n' +
                '🎯 Default: false | AWS MSK: false\n' +
                '⚠️ Production Recommendation: Keep false to prevent data loss. Enable only if availability > durability.\n\n' +
                '📚 Use Case: Enabling risks data loss but maintains availability when all ISR replicas fail.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#brokerconfigs_unclean.leader.election.enable'
        };

        // Topic-specific configurations
        const topicConfigs: { [key: string]: string } = {
            'cleanup.policy':
                '📝 Purpose: Determines how old log segments are removed (delete or compact).\n\n' +
                '🎯 Options: delete (time/size-based) or compact (keep latest per key)\n' +
                '⚠️ Production Recommendation: Use delete for event logs, compact for changelog/state topics.\n\n' +
                '📚 Use Case: Compaction ideal for KTables, materialized views. Delete for general event streaming.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#topicconfigs_cleanup.policy',

            'segment.ms':
                '📝 Purpose: Time-based log segment rolling (milliseconds).\n\n' +
                '🎯 Default: 604800000 (7 days)\n' +
                '⚠️ Production Recommendation: Reduce for faster compaction or more frequent retention checks.\n\n' +
                '📚 Use Case: Complements log.segment.bytes. Ensures segments roll even with low traffic.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#topicconfigs_segment.ms',

            'retention.bytes':
                '📝 Purpose: Maximum size of partition log before old segments are deleted.\n\n' +
                '🎯 Default: -1 (unlimited)\n' +
                '⚠️ Production Recommendation: Set explicit limits in storage-constrained environments.\n\n' +
                '📚 Use Case: Complements time-based retention. Useful for capping storage per partition.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#topicconfigs_retention.bytes'
        };

        // Consumer configurations
        const consumerConfigs: { [key: string]: string } = {
            'auto.offset.reset':
                '📝 Purpose: What to do when no initial offset exists (earliest, latest, none).\n\n' +
                '🎯 Default: latest\n' +
                '⚠️ Production Recommendation: Use earliest for batch jobs, latest for real-time processing.\n\n' +
                '📚 Use Case: earliest = process all messages, latest = only new messages, none = throw error.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#consumerconfigs_auto.offset.reset',

            'enable.auto.commit':
                '📝 Purpose: Automatically commit offsets periodically.\n\n' +
                '🎯 Default: true\n' +
                '⚠️ Production Recommendation: Disable (false) for exactly-once processing, enable for at-least-once.\n\n' +
                '📚 Use Case: Manual commits give better control over processing guarantees.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#consumerconfigs_enable.auto.commit',

            'max.poll.records':
                '📝 Purpose: Maximum number of records returned in a single poll().\n\n' +
                '🎯 Default: 500\n' +
                '⚠️ Production Recommendation: Reduce for slow processing, increase for fast batch processing.\n\n' +
                '📚 Use Case: Balance between throughput and processing latency. Lower = more frequent commits.\n\n' +
                '🔗 Apache Kafka Docs: kafka.apache.org/documentation/#consumerconfigs_max.poll.records'
        };

        // Check all config types
        let details = brokerConfigs[normalizedParam] ||
                      topicConfigs[normalizedParam] ||
                      consumerConfigs[normalizedParam];

        if (!details) {
            // Generic fallback for unknown parameters
            details = `📝 Parameter: ${parameterName}\n\n` +
                      `ℹ️ This is a Kafka configuration parameter. For detailed information, please refer to the official documentation.\n\n` +
                      `🔗 Apache Kafka Documentation:\n` +
                      `• Broker Configs: kafka.apache.org/documentation/#brokerconfigs\n` +
                      `• Topic Configs: kafka.apache.org/documentation/#topicconfigs\n` +
                      `• Consumer Configs: kafka.apache.org/documentation/#consumerconfigs\n\n` +
                      `🔗 AWS MSK Documentation:\n` +
                      `• Configuration: docs.aws.amazon.com/msk/latest/developerguide/msk-configuration.html`;
        }

        return details;
    }

    /**
     * Clear cache
     */
    public clearCache(): void {
        this.cache.clear();
    }
}
