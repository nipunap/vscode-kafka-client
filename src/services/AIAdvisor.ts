import * as vscode from 'vscode';
import { Logger } from '../infrastructure/Logger';

/**
 * AI Advisor service using VS Code Language Model API
 * Provides intelligent suggestions for Kafka configurations and best practices
 */
export class AIAdvisor {
    private static logger = Logger.getLogger('AIAdvisor');
    private static isAvailable: boolean | undefined;

    /**
     * Check if AI/LLM features are available
     */
    static async checkAvailability(): Promise<boolean> {
        if (this.isAvailable !== undefined) {
            return this.isAvailable;
        }

        try {
            // Check if the Language Model API is available
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4'
            });

            // Also check for gpt-3.5-turbo as fallback
            const fallbackModels = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-3.5-turbo'
            });

            this.isAvailable = models.length > 0 || fallbackModels.length > 0;
            
            if (this.isAvailable) {
                this.logger.info('AI Advisor features are available');
            } else {
                this.logger.info('AI Advisor features not available - GitHub Copilot may not be active');
            }
            
            return this.isAvailable;
        } catch (error) {
            this.logger.debug('Language Model API not available', error);
            this.isAvailable = false;
            return false;
        }
    }

    /**
     * Get AI suggestions for topic configuration
     */
    static async analyzeTopicConfiguration(topicConfig: {
        name: string;
        partitions: number;
        replicationFactor: number;
        configurations: Array<{ configName: string; configValue: string; configSource: string }>;
        totalMessages: number;
    }): Promise<string> {
        const available = await this.checkAvailability();
        if (!available) {
            throw new Error('AI features are not available. Please ensure GitHub Copilot is active.');
        }

        try {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4'
            });

            if (models.length === 0) {
                // Fallback to GPT-3.5
                const fallbackModels = await vscode.lm.selectChatModels({
                    vendor: 'copilot',
                    family: 'gpt-3.5-turbo'
                });
                if (fallbackModels.length === 0) {
                    throw new Error('No AI models available');
                }
            }

            const model = models[0];
            const messages = [
                vscode.LanguageModelChatMessage.User(`You are a Kafka expert. Analyze this Kafka topic configuration and provide specific recommendations:

Topic Name: ${topicConfig.name}
Partitions: ${topicConfig.partitions}
Replication Factor: ${topicConfig.replicationFactor}
Total Messages: ${topicConfig.totalMessages.toLocaleString()}

Key Configurations:
${topicConfig.configurations.slice(0, 15).map(c => `- ${c.configName}: ${c.configValue} (source: ${c.configSource})`).join('\n')}

Please provide:
1. **Configuration Analysis**: Assess current settings (partitions, replication, retention, etc.)
2. **Performance Optimization**: Specific suggestions to improve throughput and latency
3. **Reliability Recommendations**: How to improve durability and fault tolerance
4. **Resource Optimization**: Memory and disk usage improvements
5. **Best Practices**: Any deviations from Kafka best practices

Keep recommendations concise, actionable, and prioritized by impact.`)
            ];

            const chatRequest = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            let response = '';
            for await (const fragment of chatRequest.text) {
                response += fragment;
            }

            return response || 'Unable to generate recommendations at this time.';
        } catch (error: any) {
            this.logger.error('Failed to get AI recommendations', error);
            throw new Error(`AI analysis failed: ${error.message}`);
        }
    }

    /**
     * Get AI suggestions for broker configuration
     */
    static async analyzeBrokerConfiguration(brokerConfig: {
        nodeId: number;
        host: string;
        port: number;
        configurations: Array<{ configName: string; configValue: string; configSource: string }>;
    }): Promise<string> {
        const available = await this.checkAvailability();
        if (!available) {
            throw new Error('AI features are not available. Please ensure GitHub Copilot is active.');
        }

        try {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4'
            });

            if (models.length === 0) {
                const fallbackModels = await vscode.lm.selectChatModels({
                    vendor: 'copilot',
                    family: 'gpt-3.5-turbo'
                });
                if (fallbackModels.length === 0) {
                    throw new Error('No AI models available');
                }
            }

            const model = models[0];
            const messages = [
                vscode.LanguageModelChatMessage.User(`You are a Kafka expert. Analyze this Kafka broker configuration and provide specific recommendations:

Broker ID: ${brokerConfig.nodeId}
Address: ${brokerConfig.host}:${brokerConfig.port}

Key Configurations:
${brokerConfig.configurations.slice(0, 20).map(c => `- ${c.configName}: ${c.configValue} (source: ${c.configSource})`).join('\n')}

Please provide:
1. **Configuration Analysis**: Review critical broker settings
2. **Performance Tuning**: JVM, network, and disk I/O optimizations
3. **Security Recommendations**: SSL, SASL, and authentication settings
4. **High Availability**: Replication and failover configuration
5. **Monitoring & Alerts**: Key metrics to watch
6. **Potential Issues**: Any concerning configurations

Keep recommendations specific, actionable, and prioritized by importance.`)
            ];

            const chatRequest = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            let response = '';
            for await (const fragment of chatRequest.text) {
                response += fragment;
            }

            return response || 'Unable to generate recommendations at this time.';
        } catch (error: any) {
            this.logger.error('Failed to get AI recommendations', error);
            throw new Error(`AI analysis failed: ${error.message}`);
        }
    }

    /**
     * Get AI suggestions for consumer group optimization
     */
    static async analyzeConsumerGroup(groupInfo: {
        groupId: string;
        state: string;
        members: number;
        totalLag: number;
        topics: string[];
    }): Promise<string> {
        const available = await this.checkAvailability();
        if (!available) {
            throw new Error('AI features are not available. Please ensure GitHub Copilot is active.');
        }

        try {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4'
            });

            if (models.length === 0) {
                const fallbackModels = await vscode.lm.selectChatModels({
                    vendor: 'copilot',
                    family: 'gpt-3.5-turbo'
                });
                if (fallbackModels.length === 0) {
                    throw new Error('No AI models available');
                }
            }

            const model = models[0];
            const messages = [
                vscode.LanguageModelChatMessage.User(`You are a Kafka expert. Analyze this consumer group and provide optimization recommendations:

Group ID: ${groupInfo.groupId}
State: ${groupInfo.state}
Active Members: ${groupInfo.members}
Total Lag: ${groupInfo.totalLag.toLocaleString()} messages
Topics: ${groupInfo.topics.join(', ')}

Please provide:
1. **Lag Analysis**: Is the current lag acceptable? What's the risk level?
2. **Scaling Recommendations**: Should we add/remove consumers?
3. **Performance Optimization**: Consumer configuration improvements
4. **Partition Assignment**: Is the current distribution optimal?
5. **Monitoring Strategy**: Key metrics and alerts to set up

Be specific and actionable in your recommendations.`)
            ];

            const chatRequest = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            let response = '';
            for await (const fragment of chatRequest.text) {
                response += fragment;
            }

            return response || 'Unable to generate recommendations at this time.';
        } catch (error: any) {
            this.logger.error('Failed to get AI recommendations', error);
            throw new Error(`AI analysis failed: ${error.message}`);
        }
    }

    /**
     * General Kafka best practices query
     */
    static async askQuestion(question: string, context?: string): Promise<string> {
        const available = await this.checkAvailability();
        if (!available) {
            throw new Error('AI features are not available. Please ensure GitHub Copilot is active.');
        }

        try {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4'
            });

            if (models.length === 0) {
                const fallbackModels = await vscode.lm.selectChatModels({
                    vendor: 'copilot',
                    family: 'gpt-3.5-turbo'
                });
                if (fallbackModels.length === 0) {
                    throw new Error('No AI models available');
                }
            }

            const model = models[0];
            
            const contextMessage = context ? `\n\nContext:\n${context}` : '';
            
            const messages = [
                vscode.LanguageModelChatMessage.User(`You are a Kafka expert assistant. Answer this question about Apache Kafka:

${question}${contextMessage}

Provide a clear, concise, and actionable answer with specific examples or commands where applicable.`)
            ];

            const chatRequest = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            let response = '';
            for await (const fragment of chatRequest.text) {
                response += fragment;
            }

            return response || 'Unable to generate an answer at this time.';
        } catch (error: any) {
            this.logger.error('Failed to get AI answer', error);
            throw new Error(`AI query failed: ${error.message}`);
        }
    }
}

