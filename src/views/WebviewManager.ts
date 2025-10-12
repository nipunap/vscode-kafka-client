/**
 * Webview Manager - Centralized management of all webview panels
 * Prevents memory leaks and ensures proper lifecycle management
 */

import { Logger } from '../infrastructure/Logger';
import { BaseWebview } from './BaseWebview';

export class WebviewManager {
    private static instance: WebviewManager;
    private panels: Map<string, BaseWebview> = new Map();
    private logger = Logger.getLogger('WebviewManager');

    private constructor() {
        this.logger.info('WebviewManager initialized');
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): WebviewManager {
        if (!WebviewManager.instance) {
            WebviewManager.instance = new WebviewManager();
        }
        return WebviewManager.instance;
    }

    /**
     * Register a webview with the manager
     * @param key Unique identifier for this webview instance
     * @param webview The webview instance to register
     */
    register(key: string, webview: BaseWebview): void {
        if (this.panels.has(key)) {
            this.logger.debug(`Webview already registered: ${key}, disposing old instance`);
            const existing = this.panels.get(key);
            existing?.dispose();
        }

        this.panels.set(key, webview);
        this.logger.debug(`Registered webview: ${key}, Total active: ${this.panels.size}`);
    }

    /**
     * Unregister a webview from the manager
     * Called automatically when webview is disposed
     */
    unregister(key: string): void {
        if (this.panels.has(key)) {
            this.panels.delete(key);
            this.logger.debug(`Unregistered webview: ${key}, Remaining: ${this.panels.size}`);
        }
    }

    /**
     * Get a registered webview by key
     */
    get(key: string): BaseWebview | undefined {
        return this.panels.get(key);
    }

    /**
     * Check if a webview is registered and visible
     */
    isVisible(key: string): boolean {
        const webview = this.panels.get(key);
        return webview ? webview.isVisible() : false;
    }

    /**
     * Get all registered webview keys
     */
    getActiveKeys(): string[] {
        return Array.from(this.panels.keys());
    }

    /**
     * Get count of active webviews
     */
    getActiveCount(): number {
        return this.panels.size;
    }

    /**
     * Dispose a specific webview
     */
    disposeWebview(key: string): void {
        const webview = this.panels.get(key);
        if (webview) {
            this.logger.debug(`Disposing webview: ${key}`);
            webview.dispose();
            this.panels.delete(key);
        }
    }

    /**
     * Dispose all webviews (call on extension deactivation)
     */
    disposeAll(): void {
        this.logger.info(`Disposing all webviews (${this.panels.size} active)`);

        for (const [key, webview] of this.panels.entries()) {
            this.logger.debug(`Disposing webview: ${key}`);
            webview.dispose();
        }

        this.panels.clear();
        this.logger.info('All webviews disposed');
    }

    /**
     * Get statistics about active webviews
     */
    getStatistics(): {
        totalActive: number;
        activeKeys: string[];
        visibleCount: number;
    } {
        const visibleCount = Array.from(this.panels.values())
            .filter(webview => webview.isVisible())
            .length;

        return {
            totalActive: this.panels.size,
            activeKeys: this.getActiveKeys(),
            visibleCount
        };
    }

    /**
     * Log current webview statistics (useful for debugging)
     */
    logStatistics(): void {
        const stats = this.getStatistics();
        this.logger.info(
            `Webview Statistics: ${stats.totalActive} total, ${stats.visibleCount} visible`,
            { keys: stats.activeKeys }
        );
    }
}
