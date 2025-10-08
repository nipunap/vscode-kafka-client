import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger {
    private static globalLevel: LogLevel = LogLevel.INFO;
    private channel: vscode.OutputChannel;

    constructor(private name: string) {
        this.channel = vscode.window.createOutputChannel(`Kafka: ${name}`);
    }

    /**
     * Set the global log level for all loggers
     */
    static setLevel(level: LogLevel): void {
        Logger.globalLevel = level;
    }

    /**
     * Get logger instance for a specific component
     */
    static getLogger(name: string): Logger {
        return new Logger(name);
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
            // Auto-show output channel on errors
            this.channel.show(true);
        }
    }

    /**
     * Log with custom level and optional data
     */
    private log(level: string, message: string, data: any[]): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.name}]`;
        
        this.channel.appendLine(`${prefix} ${message}`);
        
        if (data.length > 0) {
            data.forEach(item => {
                if (item instanceof Error) {
                    this.channel.appendLine(`  Error: ${item.message}`);
                    if (item.stack) {
                        this.channel.appendLine(`  Stack: ${item.stack}`);
                    }
                } else if (typeof item === 'object') {
                try {
                    this.channel.appendLine(`  Data: ${JSON.stringify(item, null, 2)}`);
                } catch (_e) {
                    this.channel.appendLine(`  Data: [Unable to stringify]`);
                }
                } else {
                    this.channel.appendLine(`  ${item}`);
                }
            });
        }
    }

    /**
     * Show the output channel
     */
    show(): void {
        this.channel.show();
    }

    /**
     * Dispose of the output channel
     */
    dispose(): void {
        this.channel.dispose();
    }
}

