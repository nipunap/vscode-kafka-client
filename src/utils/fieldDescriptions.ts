import * as fs from 'fs';
import * as path from 'path';

/**
 * Field descriptions database for showing info icons with tooltips
 * in webviews (topics, consumer groups, brokers, ACLs)
 */
export class FieldDescriptions {
    private static instance: FieldDescriptions;
    private descriptions: Map<string, string> = new Map();
    private loaded: boolean = false;

    private constructor() {}

    public static getInstance(): FieldDescriptions {
        if (!FieldDescriptions.instance) {
            FieldDescriptions.instance = new FieldDescriptions();
        }
        return FieldDescriptions.instance;
    }

    /**
     * Load field descriptions from JSON file
     */
    public load(extensionPath: string): void {
        if (this.loaded) {
            return; // Already loaded
        }

        try {
            // Try bundled path first (production), then development path
            const possiblePaths = [
                path.join(extensionPath, 'dist', 'data', 'fieldDescriptions.json'),
                path.join(extensionPath, 'src', 'data', 'fieldDescriptions.json')
            ];

            let jsonPath: string | null = null;
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    jsonPath = p;
                    break;
                }
            }

            if (!jsonPath) {
                throw new Error('fieldDescriptions.json not found in any expected location');
            }

            const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
            const data = JSON.parse(jsonContent) as Record<string, Record<string, string>>;

            // Flatten all categories into a single map for quick lookup
            for (const categoryKey in data) {
                const category = data[categoryKey];
                if (category && typeof category === 'object') {
                    for (const [field, description] of Object.entries(category)) {
                        if (typeof description === 'string') {
                            this.descriptions.set(field, description);
                        }
                    }
                }
            }

            this.loaded = true;
        } catch (error) {
            console.error('Failed to load field descriptions:', error);
            // Fail gracefully - info icons just won't appear
        }
    }

    /**
     * Get description for a field label
     * @param label Field label (e.g., "Partitions", "Consumer Group")
     * @returns Description text or empty string if not found
     */
    public getDescription(label: string): string {
        return this.descriptions.get(label) || '';
    }

    /**
     * Check if a field has a description
     * @param label Field label
     * @returns true if description exists
     */
    public hasDescription(label: string): boolean {
        return this.descriptions.has(label);
    }

    /**
     * Get all available field labels
     * @returns Array of field labels
     */
    public getAllFields(): string[] {
        return Array.from(this.descriptions.keys());
    }

    /**
     * Get count of loaded descriptions
     * @returns Number of field descriptions
     */
    public getCount(): number {
        return this.descriptions.size;
    }

    /**
     * Generate inline HTML for info icon with click handler
     * @param label Field label
     * @returns HTML string with info icon or empty string if no description
     */
    public getInfoIconHtml(label: string): string {
        const description = this.getDescription(label);
        if (!description) {
            return '';
        }

        // Escape quotes for HTML attributes
        const escapedLabel = label.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const escapedDescription = description.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return ` <span class="info-icon" data-field="${escapedLabel}" data-description="${escapedDescription}" onclick="showInfoModal(this)">ℹ️</span>`;
    }
}
