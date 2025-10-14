import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

// Logger cache for singleton pattern
const loggerCache = new Map<string, Logger>();

// Check if running in test environment
const isTestEnvironment = (): boolean => {
    return process.env.NODE_ENV === 'test' || 
           process.env.VSCODE_TEST === '1' ||
           typeof (global as any).it === 'function'; // Mocha/test framework detection
};

export class Logger {
    private static globalLevel: LogLevel = LogLevel.INFO;
    private channel: vscode.OutputChannel | null;
    private isNoOp: boolean;

    private constructor(private name: string) {
        // In test environment, use no-op logger to prevent file handle exhaustion
        this.isNoOp = isTestEnvironment();
        
        if (this.isNoOp) {
            // Create a minimal no-op channel
            this.channel = null;
        } else {
            this.channel = vscode.window.createOutputChannel(`Kafka: ${name}`);
        }
    }

    /**
     * Set the global log level for all loggers
     */
    static setLevel(level: LogLevel): void {
        Logger.globalLevel = level;
    }

    /**
     * Get logger instance for a specific component (singleton pattern)
     */
    static getLogger(name: string): Logger {
        // Return cached logger if exists
        if (loggerCache.has(name)) {
            return loggerCache.get(name)!;
        }
        
        // Create new logger and cache it
        const logger = new Logger(name);
        loggerCache.set(name, logger);
        return logger;
    }

    /**
     * Clear all cached loggers (useful for testing)
     */
    static clearLoggers(): void {
        loggerCache.forEach(logger => logger.dispose());
        loggerCache.clear();
    }

    debug(message: string, ...data: any[]): void {
        if (Logger.globalLevel <= LogLevel.DEBUG) {
            this.log('DEBUG', message, data);
        }
    }

    info(message: string, ...data: any[]): void {
        if (Logger.globalLevel <= LogLevel.INFO) {
            this.log('INFO', message, data);
        }
    }

    warn(message: string, ...data: any[]): void {
        if (Logger.globalLevel <= LogLevel.WARN) {
            this.log('WARN', message, data);
        }
    }

    error(message: string, error?: any): void {
        if (Logger.globalLevel <= LogLevel.ERROR) {
            this.log('ERROR', message, error ? [error] : []);
            // Auto-show output channel on errors (only if not in no-op mode)
            if (this.channel) {
                this.channel.show(true);
            }
        }
    }

    /**
     * Log with custom level and optional data
     */
    private log(level: string, message: string, data: any[]): void {
        // Skip logging in no-op mode
        if (this.isNoOp || !this.channel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.name}]`;
        
        this.channel.appendLine(`${prefix} ${message}`);
        
        if (data.length > 0) {
            data.forEach(item => {
                if (item instanceof Error) {
                    this.channel!.appendLine(`  Error: ${item.message}`);
                    if (item.stack) {
                        this.channel!.appendLine(`  Stack: ${item.stack}`);
                    }
                } else if (typeof item === 'object') {
                try {
                    this.channel!.appendLine(`  Data: ${JSON.stringify(item, null, 2)}`);
                } catch (_e) {
                    this.channel!.appendLine(`  Data: [Unable to stringify]`);
                }
                } else {
                    this.channel!.appendLine(`  ${item}`);
                }
            });
        }
    }

    /**
     * Show the output channel
     */
    show(): void {
        if (this.channel) {
            this.channel.show();
        }
    }

    /**
     * Dispose of the output channel
     */
    dispose(): void {
        if (this.channel) {
            this.channel.dispose();
        }
    }
}

