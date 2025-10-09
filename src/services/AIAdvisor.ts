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
                vscode.LanguageModelChatMessage.User(`You are a Kafka expert consultant. Analyze this topic and provide CONCISE, actionable recommendations.

**Topic Configuration:**
- Name: ${topicConfig.name}
- Partitions: ${topicConfig.partitions}
- Replication Factor: ${topicConfig.replicationFactor}
- Total Messages: ${topicConfig.totalMessages.toLocaleString()}

**Key Settings:**
${topicConfig.configurations.slice(0, 12).filter(c => 
    !c.configName.includes('segment.') && 
    !c.configName.includes('file.delete.') &&
    c.configSource !== 'DEFAULT_CONFIG'
).map(c => '- ' + c.configName + ': ' + c.configValue).join('\n') || '(Using default configurations)'}

**Instructions:**
Provide a brief analysis in this EXACT format:

## Status
[One sentence: Is this configuration production-ready? Any critical issues?]

## Critical Issues ⚠️
[List ONLY critical problems that could cause data loss or outages. If none, write "None identified."]

## Quick Wins 🎯
[2-3 immediate improvements with biggest impact. Format: "**Setting**: value → recommended_value (reason)"]

## Performance Tips ⚡
[2-3 specific optimizations for throughput/latency]

## Best Practices 📋
[2-3 important recommendations]

Keep each bullet point to ONE LINE. Be specific with numbers and settings. No fluff.`)
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
                vscode.LanguageModelChatMessage.User(`You are a Kafka expert consultant. Analyze this broker and provide CONCISE, actionable recommendations.

**Broker Configuration:**
- Broker ID: ${brokerConfig.nodeId}
- Address: ${brokerConfig.host}:${brokerConfig.port}

**Key Settings:**
${brokerConfig.configurations.slice(0, 15).filter(c => 
    !c.configName.startsWith('log.segment') && 
    !c.configName.startsWith('log.retention') &&
    c.configSource !== 'DEFAULT_CONFIG'
).map(c => '- ' + c.configName + ': ' + c.configValue).join('\n') || '(Using default configurations)'}

**Instructions:**
Provide a brief analysis in this EXACT format:

## Status
[One sentence: Is this broker production-ready? Any critical issues?]

## Critical Issues ⚠️
[List ONLY critical problems. If none, write "None identified."]

## Quick Wins 🎯
[2-3 immediate improvements. Format: "**Setting**: value → recommended_value (reason)"]

## Performance ⚡
[2-3 specific JVM, network, or I/O optimizations]

## Security 🔒
[2-3 security recommendations (SSL, SASL, ACLs)]

## Monitoring 📊
[Top 3 metrics to watch]

Keep each bullet to ONE LINE. Be specific with numbers. No fluff.`)
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
                vscode.LanguageModelChatMessage.User(`You are a Kafka expert consultant. Analyze this consumer group and provide CONCISE, actionable recommendations.

**Consumer Group:**
- Group ID: ${groupInfo.groupId}
- State: ${groupInfo.state}
- Active Members: ${groupInfo.members}
- Total Lag: ${groupInfo.totalLag.toLocaleString()} messages
- Topics: ${groupInfo.topics.join(', ')}

**Instructions:**
Provide a brief analysis in this EXACT format:

## Status
[One sentence: Is this consumer group healthy? Any immediate concerns?]

## Lag Analysis 📊
[Assess lag severity: Healthy (<1000), Warning (1000-10000), Critical (>10000). What's the impact?]

## Critical Issues ⚠️
[List ONLY critical problems. If none, write "None identified."]

## Scaling Recommendations 📈
[Should you scale? Format: "Current: X consumers → Recommended: Y consumers (reason)"]

## Performance Tips ⚡
[2-3 specific consumer configuration improvements]

## Monitoring 👀
[Top 3 metrics to watch]

Keep each bullet to ONE LINE. Be specific with numbers. No fluff.`)
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
            
            const contextMessage = context ? `\n\n**Context:**\n${context}` : '';
            
            const messages = [
                vscode.LanguageModelChatMessage.User(`You are a Kafka expert assistant. Answer this question CONCISELY:

**Question:** ${question}${contextMessage}

**Instructions:**
- Keep answer under 150 words
- Use bullet points for lists
- Include specific commands/settings when relevant
- Format: Use **bold** for key terms, \`code\` for settings
- No fluff or marketing speak`)
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

