import * as vscode from 'vscode';

/**
 * URL validation utilities for secure external link handling
 */

/**
 * Validates and creates secure external URLs
 */
export class URLValidator {
    /**
     * Validates that a URL is a secure external link
     * @param url The URL to validate
     * @returns true if the URL is secure and valid
     */
    static isValidExternalUrl(url: string): boolean {
        try {
            const parsedUrl = new URL(url);
            
            // Only allow HTTPS URLs
            if (parsedUrl.protocol !== 'https:') {
                return false;
            }
            
            // Allow only trusted domains
            const allowedDomains = [
                'kafka.apache.org',
                'docs.aws.amazon.com',
                'github.com'
            ];
            
            return allowedDomains.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain));
        } catch {
            return false;
        }
    }

    /**
     * Creates a secure VSCode URI for external links
     * @param url The URL to create a URI for
     * @returns VSCode URI if valid, null if invalid
     */
    static createSecureUri(url: string): vscode.Uri | null {
        if (!this.isValidExternalUrl(url)) {
            return null;
        }
        
        try {
            return vscode.Uri.parse(url);
        } catch {
            return null;
        }
    }

    /**
     * Opens a secure external URL
     * @param url The URL to open
     * @returns Promise that resolves when the URL is opened
     */
    static async openSecureUrl(url: string): Promise<void> {
        const uri = this.createSecureUri(url);
        if (!uri) {
            throw new Error(`Invalid or insecure URL: ${url}`);
        }
        
        await vscode.env.openExternal(uri);
    }
}

/**
 * Predefined secure URLs for the application
 */
export const SECURE_URLS = {
    KAFKA_DOCS: 'https://kafka.apache.org/documentation/#security_authz',
    KAFKA_ACL_DOCS: 'https://kafka.apache.org/documentation/#security_authz_acl',
    KAFKA_SASL_DOCS: 'https://kafka.apache.org/documentation/#security_sasl',
    KAFKA_SSL_DOCS: 'https://kafka.apache.org/documentation/#security_ssl',
    AWS_SSO_DOCS: 'https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html',
    AWS_CREDENTIALS_DOCS: 'https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html'
} as const;
