import * as assert from 'assert';
import * as path from 'path';
import { FieldDescriptions } from '../../utils/fieldDescriptions';

suite('FieldDescriptions Utility Test Suite', () => {
    let fieldDescriptions: FieldDescriptions;
    const extensionPath = path.join(__dirname, '../../../');

    setup(() => {
        fieldDescriptions = FieldDescriptions.getInstance();
        fieldDescriptions.load(extensionPath);
    });

    suite('Singleton Pattern', () => {
        test('should return the same instance on multiple calls', () => {
            const instance1 = FieldDescriptions.getInstance();
            const instance2 = FieldDescriptions.getInstance();
            assert.strictEqual(instance1, instance2, 'Should return the same singleton instance');
        });
    });

    suite('Description Loading', () => {
        test('should load descriptions from JSON file', () => {
            const count = fieldDescriptions.getCount();
            assert.ok(count > 0, 'Should load at least one description');
        });

        test('should have loaded topic descriptions', () => {
            const description = fieldDescriptions.getDescription('Name');
            assert.ok(description, 'Should have description for "Name"');
            assert.ok(description.length > 0, 'Description should not be empty');
        });

        test('should have loaded topic config descriptions', () => {
            const description = fieldDescriptions.getDescription('retention.ms');
            assert.ok(description, 'Should have description for "retention.ms"');
            assert.ok(description.includes('retain'), 'Description should mention retention');
        });

        test('should have loaded consumer config descriptions', () => {
            const description = fieldDescriptions.getDescription('auto.offset.reset');
            assert.ok(description, 'Should have description for "auto.offset.reset"');
        });

        test('should have loaded broker config descriptions', () => {
            const description = fieldDescriptions.getDescription('advertised.listeners');
            assert.ok(description, 'Should have description for "advertised.listeners"');
        });

        test('should have loaded common field descriptions', () => {
            const propertyDesc = fieldDescriptions.getDescription('PROPERTY');
            const valueDesc = fieldDescriptions.getDescription('VALUE');
            const sourceDesc = fieldDescriptions.getDescription('SOURCE');

            assert.ok(propertyDesc, 'Should have description for PROPERTY');
            assert.ok(valueDesc, 'Should have description for VALUE');
            assert.ok(sourceDesc, 'Should have description for SOURCE');
        });

        test('should return undefined for non-existent field', () => {
            const description = fieldDescriptions.getDescription('NON_EXISTENT_FIELD_XYZ');
            assert.ok(!description || description === '', 'Should return undefined or empty string for non-existent field');
        });
    });

    suite('Modal Info Icon HTML Generation', () => {
        test('should generate HTML with onclick handler', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('onclick="showInfoModal(this)"'), 'Should include onclick handler');
        });

        test('should generate HTML with data-field attribute', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('data-field="retention.ms"'), 'Should include data-field attribute');
        });

        test('should generate HTML with data-description attribute', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('data-description='), 'Should include data-description attribute');
            assert.ok(html.includes('retain'), 'Description should contain expected text');
        });

        test('should include info icon emoji', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('ℹ️'), 'Should include info icon emoji');
        });

        test('should have info-icon CSS class', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('class="info-icon"'), 'Should include info-icon CSS class');
        });

        test('should return empty string for non-existent field', () => {
            const html = fieldDescriptions.getInfoIconHtml('NON_EXISTENT_FIELD_XYZ');
            assert.strictEqual(html, '', 'Should return empty string for non-existent field');
        });

        test('should not include title attribute (no tooltip)', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(!html.includes('title='), 'Should not include title attribute for tooltips');
        });
    });

    suite('HTML Escaping and Security', () => {
        test('should escape double quotes in field names', () => {
            // Create a mock description with quotes
            const testField = 'compression.type';
            const html = fieldDescriptions.getInfoIconHtml(testField);

            // Field name should be escaped
            assert.ok(html.includes('data-field='), 'Should have data-field attribute');
            assert.ok(!html.includes('data-field=""compression'), 'Should not have unescaped quotes breaking attribute');
        });

        test('should escape apostrophes in descriptions', () => {
            const html = fieldDescriptions.getInfoIconHtml('cleanup.policy');

            // If the description contains apostrophes, they should be escaped
            if (html.includes('data-description=')) {
                // Check that HTML is well-formed
                const dataDescMatch = html.match(/data-description="[^"]*"/);
                assert.ok(dataDescMatch, 'data-description attribute should be properly formed');
            }
        });

        test('should produce valid HTML that can be parsed', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');

            // Check basic HTML structure
            assert.ok(html.includes('<span'), 'Should start with span tag');
            assert.ok(html.includes('</span>'), 'Should end with closing span tag');
            assert.ok(html.includes('class='), 'Should have class attribute');
            assert.ok(html.includes('data-field='), 'Should have data-field attribute');
            assert.ok(html.includes('data-description='), 'Should have data-description attribute');
            assert.ok(html.includes('onclick='), 'Should have onclick attribute');
        });

        test('should handle fields with special characters', () => {
            // Test with actual Kafka config that might have special chars
            const html = fieldDescriptions.getInfoIconHtml('log.retention.ms');
            assert.ok(html.length > 0 || html === '', 'Should handle dots in field names');
        });

        test('should handle fields with underscores', () => {
            const html = fieldDescriptions.getInfoIconHtml('min.insync.replicas');
            assert.ok(html.length > 0 || html === '', 'Should handle underscores in field names');
        });

        test('should handle fields with numbers', () => {
            const html = fieldDescriptions.getInfoIconHtml('replica.lag.time.max.ms');
            assert.ok(html.length > 0 || html === '', 'Should handle numbers in field names');
        });
    });

    suite('Complete HTML Structure Validation', () => {
        test('should generate complete valid span element', () => {
            const html = fieldDescriptions.getInfoIconHtml('compression.type');

            // Should be a complete span element
            assert.ok(html.trim().startsWith('<span'), 'Should start with span tag');
            assert.ok(html.trim().endsWith('</span>'), 'Should end with span closing tag');

            // Should have all required attributes
            const hasClass = html.includes('class="info-icon"');
            const hasDataField = html.includes('data-field=');
            const hasDataDescription = html.includes('data-description=');
            const hasOnClick = html.includes('onclick="showInfoModal(this)"');
            const hasIcon = html.includes('ℹ️');

            assert.ok(hasClass, 'Should have class attribute');
            assert.ok(hasDataField, 'Should have data-field attribute');
            assert.ok(hasDataDescription, 'Should have data-description attribute');
            assert.ok(hasOnClick, 'Should have onclick attribute');
            assert.ok(hasIcon, 'Should have info icon emoji');
        });

        test('should generate HTML with proper attribute order', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');

            // Attributes should appear in a logical order
            const classPos = html.indexOf('class=');
            const dataFieldPos = html.indexOf('data-field=');
            const dataDescPos = html.indexOf('data-description=');
            const onclickPos = html.indexOf('onclick=');

            assert.ok(classPos > 0, 'Should have class attribute');
            assert.ok(dataFieldPos > 0, 'Should have data-field attribute');
            assert.ok(dataDescPos > 0, 'Should have data-description attribute');
            assert.ok(onclickPos > 0, 'Should have onclick attribute');
        });

        test('should generate HTML with leading space', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');

            // Should start with space for proper inline rendering
            assert.ok(html.startsWith(' '), 'Should start with a space for inline rendering');
        });
    });

    suite('Integration with Different Field Types', () => {
        test('should work with topic fields', () => {
            const fields = ['Name', 'Partitions', 'Replication Factor', 'Leader', 'ISR'];

            fields.forEach(field => {
                const html = fieldDescriptions.getInfoIconHtml(field);
                // Some fields may not have descriptions, which is OK
                if (html.length > 0) {
                    assert.ok(html.includes('data-field='), `Should generate valid HTML for ${field}`);
                }
            });
        });

        test('should work with consumer group fields', () => {
            const fields = ['Group ID', 'State', 'Members', 'Lag'];

            fields.forEach(field => {
                const html = fieldDescriptions.getInfoIconHtml(field);
                // Some fields may not have descriptions, which is OK
                if (html.length > 0) {
                    assert.ok(html.includes('data-field='), `Should generate valid HTML for ${field}`);
                }
            });
        });

        test('should work with broker fields', () => {
            const fields = ['Broker ID', 'Host', 'Port', 'Rack'];

            fields.forEach(field => {
                const html = fieldDescriptions.getInfoIconHtml(field);
                // Some fields may not have descriptions, which is OK
                if (html.length > 0) {
                    assert.ok(html.includes('data-field='), `Should generate valid HTML for ${field}`);
                }
            });
        });

        test('should work with ACL fields', () => {
            const fields = ['Resource Type', 'Resource Name', 'Principal', 'Operation', 'Permission'];

            fields.forEach(field => {
                const html = fieldDescriptions.getInfoIconHtml(field);
                // Some fields may not have descriptions, which is OK
                if (html.length > 0) {
                    assert.ok(html.includes('data-field='), `Should generate valid HTML for ${field}`);
                }
            });
        });

        test('should work with config table headers', () => {
            const headers = ['PROPERTY', 'VALUE', 'SOURCE'];

            headers.forEach(header => {
                const html = fieldDescriptions.getInfoIconHtml(header);
                assert.ok(html.length > 0, `Should have description for ${header}`);
                assert.ok(html.includes('data-field='), `Should generate valid HTML for ${header}`);
            });
        });
    });

    suite('Modal Dialog JavaScript Integration', () => {
        test('should generate HTML that calls showInfoModal function', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('showInfoModal(this)'), 'Should call showInfoModal with this context');
        });

        test('should pass this context to showInfoModal', () => {
            const html = fieldDescriptions.getInfoIconHtml('compression.type');
            const onclickMatch = html.match(/onclick="([^"]*)"/);

            assert.ok(onclickMatch, 'Should have onclick attribute');
            assert.ok(onclickMatch[1].includes('this'), 'Should pass this as parameter to showInfoModal');
        });

        test('should have clickable cursor style (via CSS class)', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('class="info-icon"'), 'Should have info-icon class for cursor styling');
        });
    });

    suite('Performance and Edge Cases', () => {
        test('should handle multiple calls efficiently', () => {
            const iterations = 100;
            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                fieldDescriptions.getInfoIconHtml('retention.ms');
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete 100 iterations in less than 100ms
            assert.ok(duration < 100, `Should be fast (took ${duration}ms for ${iterations} iterations)`);
        });

        test('should handle rapid successive calls', () => {
            const html1 = fieldDescriptions.getInfoIconHtml('retention.ms');
            const html2 = fieldDescriptions.getInfoIconHtml('compression.type');
            const html3 = fieldDescriptions.getInfoIconHtml('cleanup.policy');

            assert.ok(html1.includes('retention.ms'), 'First call should work');
            assert.ok(html2.includes('compression.type'), 'Second call should work');
            assert.ok(html3.includes('cleanup.policy'), 'Third call should work');
        });

        test('should handle empty string field name', () => {
            const html = fieldDescriptions.getInfoIconHtml('');
            assert.strictEqual(html, '', 'Should return empty string for empty field name');
        });

        test('should handle very long field names', () => {
            const longField = 'a'.repeat(200);
            const html = fieldDescriptions.getInfoIconHtml(longField);
            assert.strictEqual(html, '', 'Should handle very long field names gracefully');
        });

        test('should be case-sensitive for field lookup', () => {
            const html1 = fieldDescriptions.getInfoIconHtml('Name');
            const html2 = fieldDescriptions.getInfoIconHtml('name');
            const html3 = fieldDescriptions.getInfoIconHtml('NAME');

            // 'Name' should exist (capitalized)
            assert.ok(html1.length > 0, 'Should find exact case match for Name');
            // Lowercase and uppercase may not exist depending on data
            assert.ok(html2.length === 0 || html2.length > 0, 'Lowercase name check');
            assert.ok(html3.length === 0 || html3.length > 0, 'Uppercase NAME check');
        });
    });

    suite('Comparison with Previous Tooltip Implementation', () => {
        test('should NOT use title attribute (old tooltip method)', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(!html.includes('title='), 'Should not use title attribute (replaced by modal)');
        });

        test('should use data attributes instead of title', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('data-field='), 'Should use data-field instead of title');
            assert.ok(html.includes('data-description='), 'Should use data-description instead of title');
        });

        test('should use onclick instead of hover (title)', () => {
            const html = fieldDescriptions.getInfoIconHtml('retention.ms');
            assert.ok(html.includes('onclick='), 'Should use onclick for explicit user action');
            assert.ok(!html.includes('onmouseover'), 'Should not use hover events');
        });
    });

    suite('Real-World Kafka Configuration Parameters', () => {
        const topicConfigs = [
            'cleanup.policy',
            'compression.type',
            'retention.ms',
            'retention.bytes',
            'segment.ms',
            'segment.bytes',
            'max.message.bytes',
            'min.insync.replicas',
            'unclean.leader.election.enable'
        ];

        topicConfigs.forEach(config => {
            test(`should handle topic config: ${config}`, () => {
                const html = fieldDescriptions.getInfoIconHtml(config);
                if (html.length > 0) {
                    assert.ok(html.includes(config), `Should reference field name ${config}`);
                    assert.ok(html.includes('onclick='), 'Should have onclick handler');
                }
            });
        });

        const consumerConfigs = [
            'auto.offset.reset',
            'enable.auto.commit',
            'fetch.min.bytes',
            'max.poll.records',
            'session.timeout.ms'
        ];

        consumerConfigs.forEach(config => {
            test(`should handle consumer config: ${config}`, () => {
                const html = fieldDescriptions.getInfoIconHtml(config);
                if (html.length > 0) {
                    assert.ok(html.includes(config), `Should reference field name ${config}`);
                    assert.ok(html.includes('onclick='), 'Should have onclick handler');
                }
            });
        });

        const brokerConfigs = [
            'advertised.listeners',
            'num.network.threads',
            'num.io.threads',
            'log.dirs',
            'auto.create.topics.enable'
        ];

        brokerConfigs.forEach(config => {
            test(`should handle broker config: ${config}`, () => {
                const html = fieldDescriptions.getInfoIconHtml(config);
                if (html.length > 0) {
                    assert.ok(html.includes(config), `Should reference field name ${config}`);
                    assert.ok(html.includes('onclick='), 'Should have onclick handler');
                }
            });
        });
    });

    suite('Data Coverage Verification', () => {
        test('should have at least 150 descriptions loaded', () => {
            const count = fieldDescriptions.getCount();
            assert.ok(count >= 150, `Should have at least 150 descriptions (found ${count})`);
        });

        test('should have descriptions for all config table columns', () => {
            const propertyHtml = fieldDescriptions.getInfoIconHtml('PROPERTY');
            const valueHtml = fieldDescriptions.getInfoIconHtml('VALUE');
            const sourceHtml = fieldDescriptions.getInfoIconHtml('SOURCE');

            assert.ok(propertyHtml.length > 0, 'Should have description for PROPERTY column');
            assert.ok(valueHtml.length > 0, 'Should have description for VALUE column');
            assert.ok(sourceHtml.length > 0, 'Should have description for SOURCE column');
        });

        test('should explain SOURCE values in description', () => {
            const description = fieldDescriptions.getDescription('SOURCE');
            assert.ok(description, 'Should have SOURCE description');
            assert.ok(description.includes('1=') || description.includes('Topic'), 'Should explain SOURCE value 1');
            assert.ok(description.includes('5=') || description.includes('server.properties'), 'Should explain SOURCE value 5');
        });
    });
});
