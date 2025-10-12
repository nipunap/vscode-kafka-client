/**
 * Format AI response with markdown-like syntax
 * Performance optimized: Uses array + join instead of string concatenation
 * @param {string} content - Raw AI response content
 * @returns {string} - Formatted HTML
 */
function formatAIResponse(content) {
    // XSS prevention
    const escaped = escapeHtml(content);

    // Bold text conversion (avoid regex for escaping issues)
    const parts = escaped.split('**');
    const boldFormatted = parts.map(function(part, i) {
        return i % 2 === 1 ? '<strong>' + part + '</strong>' : part;
    }).join('');

    // Line processing with performance optimization
    const lines = boldFormatted.split('\n');
    const htmlParts = []; // Array for efficient concatenation

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') {
            htmlParts.push('<div style="height: 8px;"></div>');
        } else if (line.indexOf('📝') === 0 || line.indexOf('🎯') === 0 ||
                   line.indexOf('⚠️') === 0 || line.indexOf('📚') === 0 ||
                   line.indexOf('🔗') === 0) {
            // Section headers with emoji - add extra spacing and styling
            htmlParts.push('<div style="margin-top: 12px; margin-bottom: 4px; line-height: 1.5;">' + line + '</div>');
        } else {
            // Regular content
            htmlParts.push('<div style="margin-left: 20px; line-height: 1.5; color: var(--vscode-foreground);">' + line + '</div>');
        }
    }

    return htmlParts.join(''); // O(n) join vs O(n²) concatenation
}
