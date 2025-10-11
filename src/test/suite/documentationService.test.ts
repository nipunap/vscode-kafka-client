import * as assert from 'assert';
import { DocumentationService } from '../../services/documentationService';

suite('DocumentationService Test Suite', () => {
    suite('getACLHelpContent', () => {
        test('should return non-empty help content', () => {
            const content = DocumentationService.getACLHelpContent();

            assert.ok(content.length > 0, 'Help content should not be empty');
            assert.ok(content.includes('<h1>🔐 Kafka ACL Management</h1>'), 'Should contain main heading');
            assert.ok(content.includes('<h2>📋 Overview</h2>'), 'Should contain overview section');
            assert.ok(content.includes('<h2>🧩 ACL Components</h2>'), 'Should contain ACL components section');
            assert.ok(content.includes('<h2>💡 Common ACL Patterns</h2>'), 'Should contain patterns section');
            assert.ok(content.includes('<h2>🔒 Security Considerations</h2>'), 'Should contain security section');
        });

        test('should contain all required sections', () => {
            const content = DocumentationService.getACLHelpContent();
            const requiredSections = [
                '<h2>📋 Overview</h2>',
                '<h2>🧩 ACL Components</h2>',
                '<h2>🚀 Using the VS Code Extension</h2>',
                '<h2>💡 Common ACL Patterns</h2>',
                '<h2>🔒 Security Considerations</h2>',
                '<h2>🔧 Troubleshooting</h2>'
            ];

            for (const section of requiredSections) {
                assert.ok(content.includes(section), `Should contain section: ${section}`);
            }
        });

        test('should contain extension usage examples', () => {
            const content = DocumentationService.getACLHelpContent();

            assert.ok(content.includes('Right-click on your <strong>cluster</strong>'), 'Should mention right-clicking cluster');
            assert.ok(content.includes('Create ACL'), 'Should mention creating ACLs');
            assert.ok(content.includes('Delete ACL'), 'Should mention deleting ACLs');
            assert.ok(content.includes('Resource Type'), 'Should contain resource type examples');
        });

        test('should contain security considerations', () => {
            const content = DocumentationService.getACLHelpContent();

            assert.ok(content.includes('Best Practices'), 'Should mention best practices');
            assert.ok(content.includes('Principle of Least Privilege'), 'Should mention least privilege');
            assert.ok(content.includes('Regular Audits'), 'Should mention audits');
        });
    });

    suite('getACLManagementMessage', () => {
        test('should return non-empty management message', () => {
            const message = DocumentationService.getACLManagementMessage();

            assert.ok(message.length > 0, 'Management message should not be empty');
            assert.ok(message.includes('ACL management'), 'Should mention ACL management');
            assert.ok(message.includes('integrated into this extension'), 'Should mention native integration');
        });

        test('should contain extension usage examples', () => {
            const message = DocumentationService.getACLManagementMessage();

            assert.ok(message.includes('Right-click on your cluster'), 'Should mention right-click action');
            assert.ok(message.includes('Create ACL'), 'Should mention creating ACLs');
            assert.ok(message.includes('Delete ACL'), 'Should mention deleting ACLs');
            assert.ok(message.includes('authorization enabled'), 'Should mention authorization requirement');
        });
    });

    suite('getACLSearchMessage', () => {
        test('should return non-empty search message', () => {
            const message = DocumentationService.getACLSearchMessage();

            assert.ok(message.length > 0, 'Search message should not be empty');
            assert.ok(message.includes('To view ACLs'), 'Should mention viewing ACLs');
            assert.ok(message.includes('extension'), 'Should mention using the extension');
        });

        test('should contain viewing instructions', () => {
            const message = DocumentationService.getACLSearchMessage();

            assert.ok(message.includes('Kafka Explorer'), 'Should mention Kafka Explorer');
            assert.ok(message.includes('Topic-Specific ACLs'), 'Should mention topic-specific ACLs');
            assert.ok(message.includes('authorization enabled'), 'Should mention authorization requirement');
        });
    });

    suite('Content Quality', () => {
        test('should have proper HTML formatting', () => {
            const helpContent = DocumentationService.getACLHelpContent();

            assert.ok(helpContent.includes('<h1>'), 'Should contain H1 headings');
            assert.ok(helpContent.includes('<h2>'), 'Should contain H2 headings');
            assert.ok(helpContent.includes('<h3>'), 'Should contain H3 headings');
            assert.ok(helpContent.includes('<div class="code-block">'), 'Should contain code blocks');
        });

        test('should contain external links', () => {
            const helpContent = DocumentationService.getACLHelpContent();

            // Validate URL structure more securely with regex pattern
            const urlPattern = /https:\/\/kafka\.apache\.org\/documentation\/#security_authz/;
            assert.ok(urlPattern.test(helpContent), 'Should contain properly formatted Kafka documentation URL');

            // Additional validation for other secure URLs
            const aclDocsPattern = /https:\/\/kafka\.apache\.org\/documentation\/#security_authz_acl/;
            assert.ok(aclDocsPattern.test(helpContent), 'Should contain ACL documentation URL');
        });

        test('should be educational and comprehensive', () => {
            const helpContent = DocumentationService.getACLHelpContent();

            // Check for educational content
            assert.ok(helpContent.includes('Principle of Least Privilege'), 'Should mention security principles');
            assert.ok(helpContent.includes('Regular Audits'), 'Should mention auditing');
            assert.ok(helpContent.includes('KafkaJS Admin API'), 'Should mention native API support');
            assert.ok(helpContent.includes('Best Practices'), 'Should mention best practices');
        });
    });
});
