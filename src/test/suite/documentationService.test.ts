import * as assert from 'assert';
import { DocumentationService } from '../../services/documentationService';

suite('DocumentationService Test Suite', () => {
    suite('getACLHelpContent', () => {
        test('should return non-empty help content', () => {
            const content = DocumentationService.getACLHelpContent();
            
            assert.ok(content.length > 0, 'Help content should not be empty');
            assert.ok(content.includes('# Kafka ACL Management'), 'Should contain main heading');
            assert.ok(content.includes('## Overview'), 'Should contain overview section');
            assert.ok(content.includes('## ACL Components'), 'Should contain ACL components section');
            assert.ok(content.includes('## Common ACL Examples'), 'Should contain examples section');
            assert.ok(content.includes('## Best Practices'), 'Should contain best practices section');
        });

        test('should contain all required sections', () => {
            const content = DocumentationService.getACLHelpContent();
            const requiredSections = [
                '## Overview',
                '## ACL Components',
                '## Common ACL Examples',
                '## Best Practices',
                '## Troubleshooting',
                '## Security Considerations'
            ];

            for (const section of requiredSections) {
                assert.ok(content.includes(section), `Should contain section: ${section}`);
            }
        });

        test('should contain code examples', () => {
            const content = DocumentationService.getACLHelpContent();
            
            assert.ok(content.includes('kafka-acls --bootstrap-server'), 'Should contain kafka-acls commands');
            assert.ok(content.includes('--allow-principal'), 'Should contain principal examples');
            assert.ok(content.includes('--operation Read'), 'Should contain operation examples');
            assert.ok(content.includes('--topic'), 'Should contain topic examples');
        });

        test('should contain security considerations', () => {
            const content = DocumentationService.getACLHelpContent();
            
            assert.ok(content.includes('Network Security'), 'Should mention network security');
            assert.ok(content.includes('Authentication'), 'Should mention authentication');
            assert.ok(content.includes('Monitoring'), 'Should mention monitoring');
        });
    });

    suite('getACLManagementMessage', () => {
        test('should return non-empty management message', () => {
            const message = DocumentationService.getACLManagementMessage();
            
            assert.ok(message.length > 0, 'Management message should not be empty');
            assert.ok(message.includes('ACL management requires'), 'Should mention ACL management requirements');
            assert.ok(message.includes('kafka-acls command line tool'), 'Should mention kafka-acls tool');
        });

        test('should contain command examples', () => {
            const message = DocumentationService.getACLManagementMessage();
            
            assert.ok(message.includes('kafka-acls --bootstrap-server'), 'Should contain kafka-acls commands');
            assert.ok(message.includes('--list'), 'Should contain list command');
            assert.ok(message.includes('--add'), 'Should contain add command');
            assert.ok(message.includes('--remove'), 'Should contain remove command');
        });
    });

    suite('getACLSearchMessage', () => {
        test('should return non-empty search message', () => {
            const message = DocumentationService.getACLSearchMessage();
            
            assert.ok(message.length > 0, 'Search message should not be empty');
            assert.ok(message.includes('To search for ACLs'), 'Should mention ACL search');
            assert.ok(message.includes('kafka-acls command line tool'), 'Should mention kafka-acls tool');
        });

        test('should contain search command examples', () => {
            const message = DocumentationService.getACLSearchMessage();
            
            assert.ok(message.includes('kafka-acls --bootstrap-server'), 'Should contain kafka-acls commands');
            assert.ok(message.includes('--list'), 'Should contain list command');
            assert.ok(message.includes('--principal'), 'Should contain principal filter');
            assert.ok(message.includes('--topic'), 'Should contain topic filter');
            assert.ok(message.includes('--operation'), 'Should contain operation filter');
        });
    });

    suite('Content Quality', () => {
        test('should have proper markdown formatting', () => {
            const helpContent = DocumentationService.getACLHelpContent();
            
            assert.ok(helpContent.includes('# '), 'Should contain H1 headings');
            assert.ok(helpContent.includes('## '), 'Should contain H2 headings');
            assert.ok(helpContent.includes('### '), 'Should contain H3 headings');
            assert.ok(helpContent.includes('```'), 'Should contain code blocks');
        });

        test('should contain external links', () => {
            const helpContent = DocumentationService.getACLHelpContent();
            
            assert.ok(helpContent.includes('https://kafka.apache.org'), 'Should contain Kafka documentation link');
        });

        test('should be educational and comprehensive', () => {
            const helpContent = DocumentationService.getACLHelpContent();
            
            // Check for educational content
            assert.ok(helpContent.includes('Principle of Least Privilege'), 'Should mention security principles');
            assert.ok(helpContent.includes('Regular Audits'), 'Should mention auditing');
            assert.ok(helpContent.includes('Testing'), 'Should mention testing');
            assert.ok(helpContent.includes('Backup'), 'Should mention backup');
        });
    });
});
