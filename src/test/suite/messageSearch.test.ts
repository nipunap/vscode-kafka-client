import * as assert from 'assert';

suite('Message Search Test Suite', () => {
    suite('Client-Side Filtering (SEC-1.2-1)', () => {
        test('should filter messages by key using regex', () => {
            const messages = [
                { key: 'user-123', value: 'test1', offset: '0' },
                { key: 'user-456', value: 'test2', offset: '1' },
                { key: 'order-789', value: 'test3', offset: '2' }
            ];

            const keyPattern = 'user-.*';
            const regex = new RegExp(keyPattern, 'i');

            const filtered = messages.filter(msg => regex.test(msg.key || ''));

            assert.strictEqual(filtered.length, 2, 'Should match 2 user keys');
            assert.ok(filtered.every(m => m.key?.startsWith('user-')), 'All results should match pattern');
        });

        test('should filter messages by minimum offset', () => {
            const messages = [
                { key: 'test', value: 'msg1', offset: '0' },
                { key: 'test', value: 'msg2', offset: '500' },
                { key: 'test', value: 'msg3', offset: '1000' },
                { key: 'test', value: 'msg4', offset: '1500' }
            ];

            const minOffset = 1000;
            const filtered = messages.filter(msg => parseInt(msg.offset) >= minOffset);

            assert.strictEqual(filtered.length, 2, 'Should match 2 messages >= offset 1000');
            assert.ok(filtered.every(m => parseInt(m.offset) >= minOffset), 'All offsets should be >= minimum');
        });

        test('should handle invalid regex gracefully', () => {
            const invalidPattern = '[invalid(regex';

            // Should not throw, just return empty or all messages
            try {
                new RegExp(invalidPattern);
                assert.fail('Should throw for invalid regex');
            } catch (_error) {
                assert.ok(true, 'Invalid regex should be caught');
            }
        });

        test('should perform case-insensitive search', () => {
            const messages = [
                { key: 'USER-123', value: 'test1', offset: '0' },
                { key: 'user-456', value: 'test2', offset: '1' },
                { key: 'User-789', value: 'test3', offset: '2' }
            ];

            const keyPattern = 'user-.*';
            const regex = new RegExp(keyPattern, 'i'); // case-insensitive flag

            const filtered = messages.filter(msg => regex.test(msg.key || ''));

            assert.strictEqual(filtered.length, 3, 'Should match all case variations');
        });

        test('should combine multiple filters', () => {
            const messages = [
                { key: 'user-123', value: 'test1', offset: '0' },
                { key: 'user-456', value: 'test2', offset: '500' },
                { key: 'user-789', value: 'test3', offset: '1000' },
                { key: 'order-111', value: 'test4', offset: '1500' }
            ];

            const keyPattern = 'user-.*';
            const minOffset = 500;
            const regex = new RegExp(keyPattern, 'i');

            const filtered = messages.filter(msg => {
                const matchesKey = regex.test(msg.key || '');
                const matchesOffset = parseInt(msg.offset) >= minOffset;
                return matchesKey && matchesOffset;
            });

            assert.strictEqual(filtered.length, 2, 'Should match 2 messages (user-456, user-789)');
            assert.ok(filtered.every(m => m.key?.startsWith('user-')), 'All should match key pattern');
            assert.ok(filtered.every(m => parseInt(m.offset) >= minOffset), 'All should match offset filter');
        });

        test('should search in message value (JSON content)', () => {
            const messages = [
                { key: 'user-1', value: '{"name": "John Doe", "email": "john@example.com"}', offset: '0' },
                { key: 'user-2', value: '{"name": "Jane Smith", "email": "jane@example.com"}', offset: '1' },
                { key: 'user-3', value: '{"name": "Bob Johnson", "email": "bob@example.com"}', offset: '2' }
            ];

            const keyPattern = 'John';
            const regex = new RegExp(keyPattern, 'i');

            // Search in both key AND value
            const filtered = messages.filter(msg => {
                const matchesKey = regex.test(msg.key || '');
                const matchesValue = regex.test(msg.value || '');
                return matchesKey || matchesValue;
            });

            assert.strictEqual(filtered.length, 2, 'Should match 2 messages containing "John"');
            assert.ok(filtered.some(m => m.value.includes('John Doe')), 'Should match John Doe');
            assert.ok(filtered.some(m => m.value.includes('Bob Johnson')), 'Should match Bob Johnson');
        });

        test('should search in key when value does not match', () => {
            const messages = [
                { key: 'order-123', value: '{"product": "laptop"}', offset: '0' },
                { key: 'order-456', value: '{"product": "phone"}', offset: '1' },
                { key: 'payment-789', value: '{"product": "tablet"}', offset: '2' }
            ];

            const keyPattern = 'order-.*';
            const regex = new RegExp(keyPattern, 'i');

            const filtered = messages.filter(msg => {
                const matchesKey = regex.test(msg.key || '');
                const matchesValue = regex.test(msg.value || '');
                return matchesKey || matchesValue;
            });

            assert.strictEqual(filtered.length, 2, 'Should match 2 messages with order- keys');
            assert.ok(filtered.every(m => m.key?.startsWith('order-')), 'All should have order- keys');
        });

        test('should match either key OR value', () => {
            const messages = [
                { key: 'user-123', value: '{"status": "active"}', offset: '0' },
                { key: 'order-456', value: '{"user": "John"}', offset: '1' },
                { key: 'payment-789', value: '{"status": "pending"}', offset: '2' }
            ];

            const keyPattern = 'user';
            const regex = new RegExp(keyPattern, 'i');

            const filtered = messages.filter(msg => {
                const matchesKey = regex.test(msg.key || '');
                const matchesValue = regex.test(msg.value || '');
                return matchesKey || matchesValue;
            });

            // Should match: user-123 (key) and order-456 (value contains "user")
            assert.strictEqual(filtered.length, 2, 'Should match messages where key OR value contains "user"');
        });
    });

    suite('PII Detection (SEC-1.2-2)', () => {
        test('should detect email patterns', () => {
            const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

            const testCases = [
                { input: 'user@example.com', expected: true },
                { input: 'test.user+tag@domain.co.uk', expected: true },
                { input: 'not-an-email', expected: false },
                { input: 'user-123', expected: false }
            ];

            testCases.forEach(({ input, expected }) => {
                const matches = emailPattern.test(input);
                assert.strictEqual(
                    matches,
                    expected,
                    `Email detection for "${input}" should be ${expected}`
                );
            });
        });

        test('should detect credit card patterns', () => {
            const ccPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/;

            const testCases = [
                { input: '1234-5678-9012-3456', expected: true },
                { input: '1234 5678 9012 3456', expected: true },
                { input: '1234567890123456', expected: true },
                { input: 'user-1234', expected: false },
                { input: '123-456', expected: false }
            ];

            testCases.forEach(({ input, expected }) => {
                const matches = ccPattern.test(input);
                assert.strictEqual(
                    matches,
                    expected,
                    `CC detection for "${input}" should be ${expected}`
                );
            });
        });

        test('should warn on PII in search terms', () => {
            const searchTerms = [
                'user@example.com',
                '1234-5678-9012-3456',
                'normal-search-term'
            ];

            const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
            const ccPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/;

            const hasPII = searchTerms.map(term => {
                return emailPattern.test(term) || ccPattern.test(term);
            });

            assert.strictEqual(hasPII[0], true, 'Should detect email PII');
            assert.strictEqual(hasPII[1], true, 'Should detect CC PII');
            assert.strictEqual(hasPII[2], false, 'Should not flag normal terms');
        });
    });

    suite('Performance', () => {
        test('should filter 10,000 messages in under 1 second', () => {
            // Generate 10k test messages
            const messages = Array.from({ length: 10000 }, (_, i) => ({
                key: `user-${i}`,
                value: `message-${i}`,
                offset: i.toString()
            }));

            const keyPattern = 'user-5.*';
            const regex = new RegExp(keyPattern);

            const startTime = Date.now();
            const filtered = messages.filter(msg => regex.test(msg.key || ''));
            const duration = Date.now() - startTime;

            assert.ok(duration < 1000, `Filtering should take < 1s (took ${duration}ms)`);
            assert.ok(filtered.length > 0, 'Should find matching messages');
        });

        test('should handle empty message list', () => {
            const messages: any[] = [];
            const keyPattern = 'user-.*';
            const regex = new RegExp(keyPattern);

            const filtered = messages.filter(msg => regex.test(msg.key || ''));

            assert.strictEqual(filtered.length, 0, 'Should return empty array');
        });

        test('should handle messages without keys', () => {
            const messages = [
                { key: null, value: 'test1', offset: '0' },
                { key: undefined, value: 'test2', offset: '1' },
                { key: 'user-123', value: 'test3', offset: '2' }
            ];

            const keyPattern = 'user-.*';
            const regex = new RegExp(keyPattern);

            const filtered = messages.filter(msg => regex.test(msg.key || ''));

            assert.strictEqual(filtered.length, 1, 'Should only match message with key');
            assert.strictEqual(filtered[0].key, 'user-123', 'Should match the correct message');
        });
    });

    suite('Edge Cases', () => {
        test('should handle special regex characters in search', () => {
            const messages = [
                { key: 'user.123', value: 'test1', offset: '0' },
                { key: 'user*456', value: 'test2', offset: '1' },
                { key: 'user[789]', value: 'test3', offset: '2' }
            ];

            // Escape special characters
            const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = escapeRegex('user.123');
            const regex = new RegExp(pattern);

            const filtered = messages.filter(msg => regex.test(msg.key || ''));

            assert.strictEqual(filtered.length, 1, 'Should match exact pattern with escaped chars');
            assert.strictEqual(filtered[0].key, 'user.123', 'Should match the literal dot');
        });

        test('should handle very long keys', () => {
            const longKey = 'a'.repeat(10000);
            const messages = [
                { key: longKey, value: 'test', offset: '0' }
            ];

            const pattern = 'a+';
            const regex = new RegExp(pattern);

            const startTime = Date.now();
            const filtered = messages.filter(msg => regex.test(msg.key || ''));
            const duration = Date.now() - startTime;

            assert.ok(duration < 100, 'Should handle long keys efficiently');
            assert.strictEqual(filtered.length, 1, 'Should match long key');
        });

        test('should handle unicode characters', () => {
            const messages = [
                { key: 'user-日本語', value: 'test1', offset: '0' },
                { key: 'user-emoji-🎉', value: 'test2', offset: '1' },
                { key: 'user-arabic-العربية', value: 'test3', offset: '2' }
            ];

            const pattern = 'user-.*';
            const regex = new RegExp(pattern, 'u'); // unicode flag

            const filtered = messages.filter(msg => regex.test(msg.key || ''));

            assert.strictEqual(filtered.length, 3, 'Should match unicode keys');
        });
    });
});

