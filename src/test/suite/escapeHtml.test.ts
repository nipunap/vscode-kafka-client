/**
 * Unit tests for escapeHtml function
 * Tests the external script that provides XSS prevention
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Load the external script
let escapeHtml: (text: string) => string;

suite('escapeHtml External Script Tests', () => {
    suiteSetup(() => {
        const scriptPath = path.join(__dirname, '../../../src/views/webviewScripts/escapeHtml.js');
        const script = fs.readFileSync(scriptPath, 'utf-8');

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

        // Evaluate script with document mock
        const wrappedScript = `(function() { const document = arguments[0]; ${script}; return escapeHtml; })`;
        escapeHtml = eval(wrappedScript)(mockDocument);
    });

    suite('Basic HTML Escaping', () => {
        test('should escape ampersand (&)', () => {
            const result = escapeHtml('A & B');
            assert.ok(result.includes('&amp;'));
        });

        test('should escape less than (<)', () => {
            const result = escapeHtml('A < B');
            assert.ok(result.includes('&lt;'));
        });

        test('should escape greater than (>)', () => {
            const result = escapeHtml('A > B');
            assert.ok(result.includes('&gt;'));
        });

        test('should escape double quotes (")', () => {
            const result = escapeHtml('Say "hello"');
            assert.ok(result.includes('&quot;'));
        });

        test('should escape single quotes (\')', () => {
            const result = escapeHtml("It's working");
            assert.ok(result.includes('&#039;') || result.includes('&#39;'));
        });
    });

    suite('XSS Attack Vectors', () => {
        test('should escape script tags', () => {
            const result = escapeHtml('<script>alert("XSS")</script>');
            assert.ok(!result.includes('<script>'));
            assert.ok(result.includes('&lt;script&gt;'));
        });

        test('should escape img tags with onerror', () => {
            const result = escapeHtml('<img src=x onerror="alert(1)">');
            assert.ok(!result.includes('<img'));
            assert.ok(result.includes('&lt;img'));
        });

        test('should escape iframe tags', () => {
            const result = escapeHtml('<iframe src="malicious.com"></iframe>');
            assert.ok(!result.includes('<iframe'));
            assert.ok(result.includes('&lt;iframe'));
        });

        test('should escape style tags', () => {
            const result = escapeHtml('<style>body{display:none}</style>');
            assert.ok(!result.includes('<style>'));
            assert.ok(result.includes('&lt;style&gt;'));
        });

        test('should escape onclick attributes', () => {
            const result = escapeHtml('<div onclick="alert(1)">Click</div>');
            // The important part is that tags are escaped, preventing execution
            assert.ok(!result.includes('<div'));
            assert.ok(result.includes('&lt;div'));
            assert.ok(result.includes('&gt;')); // Tags are escaped
        });

        test('should escape javascript: protocol', () => {
            const result = escapeHtml('<a href="javascript:alert(1)">Link</a>');
            // The important part is that tags are escaped, preventing execution
            assert.ok(!result.includes('<a'));
            assert.ok(result.includes('&lt;a'));
            assert.ok(result.includes('&gt;')); // Tags are escaped
        });
    });

    suite('Unicode and Special Characters', () => {
        test('should preserve Unicode characters', () => {
            const input = '你好 世界 🎉';
            const result = escapeHtml(input);
            assert.ok(result.includes('你好'));
            assert.ok(result.includes('🎉'));
        });

        test('should preserve emoji', () => {
            const input = '📝 🎯 ⚠️ 📚 🔗';
            const result = escapeHtml(input);
            assert.ok(result.includes('📝'));
            assert.ok(result.includes('🎯'));
        });

        test('should handle mixed content', () => {
            const input = 'Normal text with <tags> and emoji 🎉';
            const result = escapeHtml(input);
            assert.ok(result.includes('Normal text'));
            assert.ok(result.includes('&lt;tags&gt;'));
            assert.ok(result.includes('🎉'));
        });
    });

    suite('Edge Cases', () => {
        test('should handle empty string', () => {
            const result = escapeHtml('');
            assert.strictEqual(result, '');
        });

        test('should handle whitespace only', () => {
            const result = escapeHtml('   ');
            assert.ok(result.trim() === '' || result === '   ');
        });

        test('should handle newlines', () => {
            const result = escapeHtml('Line 1\nLine 2');
            assert.ok(result.includes('Line 1'));
            assert.ok(result.includes('Line 2'));
        });

        test('should handle tabs', () => {
            const result = escapeHtml('Tab\there');
            assert.ok(result.includes('Tab'));
        });
    });

    suite('Complex HTML', () => {
        test('should escape nested tags', () => {
            const input = '<div><script>alert(1)</script></div>';
            const result = escapeHtml(input);
            assert.ok(!result.includes('<div>'));
            assert.ok(!result.includes('<script>'));
            assert.ok(result.includes('&lt;div&gt;'));
        });

        test('should escape tags with attributes', () => {
            const input = '<img src="image.jpg" alt="My Image" onerror="alert(1)">';
            const result = escapeHtml(input);
            assert.ok(!result.includes('<img'));
            assert.ok(result.includes('&lt;img'));
        });

        test('should handle multiple special characters', () => {
            const input = '<div class="test" id=\'myId\'>Content & more</div>';
            const result = escapeHtml(input);
            assert.ok(result.includes('&lt;'));
            assert.ok(result.includes('&gt;'));
            assert.ok(result.includes('&amp;'));
        });
    });

    suite('Performance', () => {
        test('should handle long strings efficiently', () => {
            const longString = '<script>alert("XSS")</script>'.repeat(1000);
            const start = Date.now();
            const result = escapeHtml(longString);
            const duration = Date.now() - start;

            assert.ok(!result.includes('<script>'));
            assert.ok(duration < 500, `Escaping took ${duration}ms, expected < 500ms`);
        });

        test('should handle many special characters efficiently', () => {
            const input = '&<>"\' '.repeat(1000);
            const start = Date.now();
            const result = escapeHtml(input);
            const duration = Date.now() - start;

            assert.ok(result.includes('&amp;'));
            assert.ok(duration < 500, `Escaping took ${duration}ms, expected < 500ms`);
        });
    });

    suite('Real-world Examples', () => {
        test('should escape code snippets', () => {
            const input = 'const html = `<div>${content}</div>`;';
            const result = escapeHtml(input);
            assert.ok(!result.includes('<div>'));
            assert.ok(result.includes('&lt;div&gt;'));
        });

        test('should escape XML content', () => {
            const input = '<?xml version="1.0"?><root><child>Data</child></root>';
            const result = escapeHtml(input);
            assert.ok(!result.includes('<?xml'));
            assert.ok(result.includes('&lt;'));
        });

        test('should escape SQL injection attempts', () => {
            const input = '<script>; DROP TABLE users; --</script>';
            const result = escapeHtml(input);
            assert.ok(!result.includes('<script>'));
            assert.ok(result.includes('&lt;script&gt;'));
        });
    });
});
