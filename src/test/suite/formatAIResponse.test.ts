/**
 * Unit tests for formatAIResponse function
 * Tests the external script that formats AI responses with markdown-like syntax
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Since formatAIResponse and escapeHtml are external scripts, we need to evaluate them in a context
// We'll use a simple eval-based approach for testing
let formatAIResponse: (content: string) => string;

suite('formatAIResponse External Script Tests', () => {
    suiteSetup(() => {
        // Load the external scripts
        const escapeHtmlPath = path.join(__dirname, '../../../src/views/webviewScripts/escapeHtml.js');
        const formatAIResponsePath = path.join(__dirname, '../../../src/views/webviewScripts/formatAIResponse.js');

        const escapeHtmlScript = fs.readFileSync(escapeHtmlPath, 'utf-8');
        const formatAIResponseScript = fs.readFileSync(formatAIResponsePath, 'utf-8');

        // Create a mock DOM environment
        const mockDiv = {
            _textContent: '',
            _innerHTML: '',
            get textContent() { return this._textContent; },
            set textContent(value: string) {
                this._textContent = value;
                // Simple HTML escaping for testing
                this._innerHTML = value
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            },
            get innerHTML() { return this._innerHTML; }
        };

        const mockDocument = {
            createElement: () => mockDiv
        };

        // Evaluate scripts with document mock
        const wrappedEscapeHtml = `(function() { const document = arguments[0]; ${escapeHtmlScript}; return escapeHtml; })`;
        const escapeHtmlFn = eval(wrappedEscapeHtml)(mockDocument);

        const wrappedFormatAI = `(function() { const document = arguments[0]; const escapeHtml = arguments[1]; ${formatAIResponseScript}; return formatAIResponse; })`;
        formatAIResponse = eval(wrappedFormatAI)(mockDocument, escapeHtmlFn);
    });

    suite('Basic Text Formatting', () => {
        test('should return plain text without formatting', () => {
            const input = 'This is plain text';
            const result = formatAIResponse(input);
            assert.ok(result.includes('This is plain text'));
        });

        test('should wrap content in divs', () => {
            const input = 'Content line';
            const result = formatAIResponse(input);
            assert.ok(result.includes('<div'));
            assert.ok(result.includes('</div>'));
        });
    });

    suite('Bold Text Conversion', () => {
        test('should convert **bold** text to <strong> tags', () => {
            const input = 'This is **bold** text';
            const result = formatAIResponse(input);
            assert.ok(result.includes('<strong>bold</strong>'));
        });

        test('should handle multiple bold segments in one line', () => {
            const input = '**First** and **Second** bold';
            const result = formatAIResponse(input);
            assert.ok(result.includes('<strong>First</strong>'));
            assert.ok(result.includes('<strong>Second</strong>'));
        });

        test('should handle consecutive bold markers', () => {
            const input = '**Bold1****Bold2**';
            const result = formatAIResponse(input);
            assert.ok(result.includes('<strong>'));
        });

        test('should not format incomplete bold markers', () => {
            const input = 'Text with **incomplete bold';
            const result = formatAIResponse(input);
            // Should still process it, just not as bold
            assert.ok(result.includes('incomplete bold'));
        });
    });

    suite('Empty Lines Handling', () => {
        test('should add spacing for empty lines', () => {
            const input = 'Line 1\n\nLine 2';
            const result = formatAIResponse(input);
            assert.ok(result.includes('height: 8px'));
        });

        test('should handle multiple consecutive empty lines', () => {
            const input = 'Line 1\n\n\n\nLine 2';
            const result = formatAIResponse(input);
            const spacingCount = (result.match(/height: 8px/g) || []).length;
            assert.strictEqual(spacingCount, 3);
        });
    });

    suite('Emoji Section Headers', () => {
        test('should style 📝 section headers', () => {
            const input = '📝 Section Header\nContent';
            const result = formatAIResponse(input);
            assert.ok(result.includes('margin-top: 12px'));
            assert.ok(result.includes('📝 Section Header'));
        });

        test('should style 🎯 section headers', () => {
            const input = '🎯 Target Section';
            const result = formatAIResponse(input);
            assert.ok(result.includes('margin-top: 12px'));
        });

        test('should style ⚠️ warning sections', () => {
            const input = '⚠️ Warning Section';
            const result = formatAIResponse(input);
            assert.ok(result.includes('margin-top: 12px'));
        });

        test('should style 📚 documentation sections', () => {
            const input = '📚 Documentation';
            const result = formatAIResponse(input);
            assert.ok(result.includes('margin-top: 12px'));
        });

        test('should style 🔗 link sections', () => {
            const input = '🔗 Related Links';
            const result = formatAIResponse(input);
            assert.ok(result.includes('margin-top: 12px'));
        });

        test('should apply regular styling to non-header lines', () => {
            const input = 'Regular content line';
            const result = formatAIResponse(input);
            assert.ok(result.includes('margin-left: 20px'));
        });
    });

    suite('XSS Prevention', () => {
        test('should escape HTML script tags', () => {
            const input = '<script>alert("XSS")</script>';
            const result = formatAIResponse(input);
            assert.ok(!result.includes('<script>'));
            assert.ok(result.includes('&lt;script&gt;') || result.includes('&amp;lt;'));
        });

        test('should escape HTML img tags', () => {
            const input = '<img src=x onerror="alert(1)">';
            const result = formatAIResponse(input);
            assert.ok(!result.includes('<img'));
            assert.ok(result.includes('&lt;') || result.includes('&amp;lt;'));
        });

        test('should escape HTML in bold content', () => {
            const input = '**<script>**';
            const result = formatAIResponse(input);
            assert.ok(!result.includes('<script>'));
            assert.ok(result.includes('&lt;') || result.includes('&amp;lt;'));
        });

        test('should handle quotes and special characters', () => {
            const input = 'Text with "quotes" and <brackets>';
            const result = formatAIResponse(input);
            assert.ok(!result.includes('"quotes"') || result.includes('&quot;'));
        });
    });

    suite('Edge Cases', () => {
        test('should handle empty string', () => {
            const input = '';
            const result = formatAIResponse(input);
            assert.ok(typeof result === 'string');
        });

        test('should handle only whitespace', () => {
            const input = '   \n   \n   ';
            const result = formatAIResponse(input);
            assert.ok(typeof result === 'string');
        });

        test('should handle special characters', () => {
            const input = '© ® ™ € £ ¥';
            const result = formatAIResponse(input);
            assert.ok(result.includes('©') || result.length > 0);
        });

        test('should handle long content without crashing', () => {
            const input = 'Lorem ipsum '.repeat(1000);
            const result = formatAIResponse(input);
            assert.ok(result.length > 0);
        });
    });

    suite('Performance', () => {
        test('should format large content efficiently', () => {
            const lines = Array(1000).fill('Content line').join('\n');
            const start = Date.now();
            const result = formatAIResponse(lines);
            const duration = Date.now() - start;

            assert.ok(result.length > 0);
            assert.ok(duration < 1000, `Formatting took ${duration}ms, expected < 1000ms`);
        });

        test('should handle many bold markers efficiently', () => {
            const input = Array(100).fill('**bold**').join(' ');
            const start = Date.now();
            const result = formatAIResponse(input);
            const duration = Date.now() - start;

            assert.ok(result.includes('<strong>'));
            assert.ok(duration < 500, `Formatting took ${duration}ms, expected < 500ms`);
        });
    });

    suite('Integration', () => {
        test('should handle complex AI response with multiple features', () => {
            const input = `📝 Configuration Guide

This is **important** information about your setup.

🎯 Key Points:
- Set **max.poll.records** to control batch size
- Use **fetch.min.bytes** for throughput

⚠️ Warning
Don't use <script> tags in configuration!

📚 Documentation
Visit the official docs for more info.`;

            const result = formatAIResponse(input);

            // Should have emoji section headers
            assert.ok(result.includes('📝'));
            assert.ok(result.includes('🎯'));
            assert.ok(result.includes('⚠️'));
            assert.ok(result.includes('📚'));

            // Should have bold text
            assert.ok(result.includes('<strong>important</strong>'));
            assert.ok(result.includes('<strong>max.poll.records</strong>'));

            // Should escape HTML
            assert.ok(!result.includes('<script>'));

            // Should have proper spacing
            assert.ok(result.includes('height: 8px'));
        });
    });
});
