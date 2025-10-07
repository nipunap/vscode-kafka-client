import * as vscode from 'vscode';
import { Logger } from './Logger';

export class ErrorHandler {
    private static logger = Logger.getLogger('ErrorHandler');

    /**
     * Handle an error with appropriate user feedback
     */
    static handle(error: any, context: string): void {
        const message = this.formatError(error, context);
        
        // Log for debugging
        this.logger.error(`${context}: ${error?.message || error}`, error);
        
        // Show appropriate UI based on error type
        if (this.isCredentialError(error)) {
            vscode.window.showErrorMessage(
                message,
                'View AWS Credentials',
                'Show Logs'
            ).then(action => {
                if (action === 'Show Logs') {
                    this.logger.show();
                }
            });
        } else if (this.isNetworkError(error)) {
            vscode.window.showErrorMessage(
                message,
                'Retry',
                'Check Connection',
                'Show Logs'
            ).then(action => {
                if (action === 'Show Logs') {
                    this.logger.show();
                }
            });
        } else {
            vscode.window.showErrorMessage(message, 'Show Logs').then(action => {
                if (action === 'Show Logs') {
                    this.logger.show();
                }
            });
        }
    }

    /**
     * Wrap an async function with error handling
     */
    static async wrap<T>(
        fn: () => Promise<T>,
        context: string
    ): Promise<T | undefined> {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, context);
            return undefined;
        }
    }

    /**
     * Wrap an async function with error handling and return a default value on error
     */
    static async wrapWithDefault<T>(
        fn: () => Promise<T>,
        context: string,
        defaultValue: T
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, context);
            return defaultValue;
        }
    }

    /**
     * Format error message for display
     */
    private static formatError(error: any, context: string): string {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        
        // Simplify common error messages
        if (this.isCredentialError(error)) {
            return `AWS credentials error in ${context}: ${this.simplifyCredentialError(errorMsg)}`;
        } else if (this.isNetworkError(error)) {
            return `Network error in ${context}: ${this.simplifyNetworkError(errorMsg)}`;
        } else if (this.isKafkaError(error)) {
            return `Kafka error in ${context}: ${this.simplifyKafkaError(errorMsg)}`;
        }
        
        return `Error in ${context}: ${errorMsg}`;
    }

    /**
     * Check if error is credential-related
     */
    static isCredentialError(error: any): boolean {
        const msg = error?.message?.toLowerCase() || '';
        return msg.includes('credential') || 
               msg.includes('expired') || 
               msg.includes('expiredtoken') ||
               msg.includes('accessdenied') ||
               msg.includes('unauthorized') ||
               msg.includes('authentication') ||
               msg.includes('unauthenticated');
    }

    /**
     * Check if error is network-related
     */
    private static isNetworkError(error: any): boolean {
        const msg = error?.message?.toLowerCase() || '';
        return msg.includes('econnrefused') ||
               msg.includes('enotfound') ||
               msg.includes('timeout') ||
               msg.includes('network') ||
               msg.includes('connection');
    }

    /**
     * Check if error is Kafka-specific
     */
    private static isKafkaError(error: any): boolean {
        const msg = error?.message?.toLowerCase() || '';
        return msg.includes('broker') ||
               msg.includes('topic') ||
               msg.includes('partition') ||
               msg.includes('consumer group') ||
               msg.includes('kafka');
    }

    /**
     * Simplify credential error messages
     */
    private static simplifyCredentialError(msg: string): string {
        if (msg.includes('expired') || msg.includes('ExpiredToken')) {
            return 'AWS credentials have expired. Please refresh your credentials and try again.';
        }
        if (msg.includes('AccessDenied')) {
            return 'Access denied. Check that your AWS profile has the necessary permissions.';
        }
        if (msg.includes('No credentials')) {
            return 'No AWS credentials found. Please configure your AWS credentials.';
        }
        return msg;
    }

    /**
     * Simplify network error messages
     */
    private static simplifyNetworkError(msg: string): string {
        if (msg.includes('ECONNREFUSED')) {
            return 'Connection refused. Check that the broker is running and accessible.';
        }
        if (msg.includes('ENOTFOUND')) {
            return 'Host not found. Check the broker address.';
        }
        if (msg.includes('timeout')) {
            return 'Operation timed out. Check network connectivity and broker availability.';
        }
        return msg;
    }

    /**
     * Simplify Kafka error messages
     */
    private static simplifyKafkaError(msg: string): string {
        if (msg.includes('TOPIC_ALREADY_EXISTS')) {
            return 'Topic already exists.';
        }
        if (msg.includes('UNKNOWN_TOPIC_OR_PARTITION')) {
            return 'Topic or partition not found.';
        }
        if (msg.includes('NOT_COORDINATOR')) {
            return 'Not the coordinator for this consumer group.';
        }
        return msg;
    }

    /**
     * Handle error silently (only log, no UI)
     */
    static handleSilently(error: any, context: string): void {
        this.logger.error(`${context}: ${error?.message || error}`, error);
    }

    /**
     * Show warning (less severe than error)
     */
    static warn(message: string, context: string): void {
        this.logger.warn(`${context}: ${message}`);
        vscode.window.showWarningMessage(`${context}: ${message}`);
    }
}

