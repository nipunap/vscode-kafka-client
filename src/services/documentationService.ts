export class DocumentationService {
    static getACLHelpContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kafka ACL Management</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.6;
            color: var(--vscode-foreground);
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: var(--vscode-editor-background);
        }
        .container {
            background: var(--vscode-editor-background);
            padding: 30px;
            border-radius: 4px;
        }
        h1 {
            color: var(--vscode-foreground);
            border-bottom: 2px solid var(--vscode-textLink-foreground);
            padding-bottom: 10px;
        }
        h2 {
            color: var(--vscode-foreground);
            margin-top: 30px;
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding-left: 15px;
        }
        h3 {
            color: var(--vscode-foreground);
            margin-top: 25px;
        }
        .code-block {
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-textBlockQuote-border);
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
            font-family: var(--vscode-editor-font-family);
            overflow-x: auto;
            color: var(--vscode-textPreformat-foreground);
            white-space: pre-wrap;
        }
        .highlight {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        .warning {
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        ul, ol {
            padding-left: 20px;
        }
        li {
            margin: 8px 0;
        }
        code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        .resource-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        .resource-link:hover {
            color: var(--vscode-textLink-activeForeground);
            text-decoration: underline;
        }
        .step {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 15px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Kafka ACL Management</h1>

        <h2>📋 Overview</h2>
        <p>Access Control Lists (ACLs) in Kafka control which users can perform which operations on which resources. This guide provides comprehensive information about managing ACLs in Kafka.</p>

        <h2>🧩 ACL Components</h2>

        <h3>👤 Principal</h3>
        <ul>
            <li><strong>User</strong>: <code>User:username</code> - Individual user</li>
            <li><strong>Group</strong>: <code>Group:groupname</code> - User group</li>
            <li><strong>Anonymous</strong>: <code>User:*</code> - Anonymous users</li>
        </ul>

        <h3>⚙️ Operations</h3>
        <ul>
            <li><strong>Read</strong>: Read data from topics</li>
            <li><strong>Write</strong>: Write data to topics</li>
            <li><strong>Create</strong>: Create topics/partitions</li>
            <li><strong>Delete</strong>: Delete topics/partitions</li>
            <li><strong>Alter</strong>: Modify topic configurations</li>
            <li><strong>Describe</strong>: View topic metadata</li>
            <li><strong>ClusterAction</strong>: Administrative operations</li>
            <li><strong>DescribeConfigs</strong>: View configurations</li>
            <li><strong>AlterConfigs</strong>: Modify configurations</li>
        </ul>

        <h3>📦 Resource Types</h3>
        <ul>
            <li><strong>Topic</strong>: Individual topics</li>
            <li><strong>Group</strong>: Consumer groups</li>
            <li><strong>Cluster</strong>: Cluster-wide operations</li>
            <li><strong>TransactionalId</strong>: Transactional operations</li>
        </ul>

        <h3>🔑 Permission Types</h3>
        <ul>
            <li><strong>Allow</strong>: Grant permission</li>
            <li><strong>Deny</strong>: Explicitly deny permission</li>
        </ul>

        <h2>🚀 Using the VS Code Extension</h2>

        <div class="warning">
            <strong>⚠️ Important:</strong> Your Kafka cluster must have authorization enabled for ACLs to work.
            If you see "Security features are disabled", this is normal for dev/test environments.
        </div>

        <h3>➕ Creating ACLs</h3>
        <div class="step">
            <strong>Step 1:</strong> Right-click on your <strong>cluster</strong> in the Kafka Explorer<br>
            <strong>Step 2:</strong> Select <strong>"🔒 Create ACL"</strong><br>
            <strong>Step 3:</strong> Follow the interactive wizard to configure:
            <ul>
                <li>Resource Type (Topic, Consumer Group, Cluster, etc.)</li>
                <li>Resource Name (e.g., "my-topic")</li>
                <li>Pattern Type (Literal or Prefixed)</li>
                <li>Principal (e.g., "User:alice")</li>
                <li>Host (default: * for all hosts)</li>
                <li>Operation (Read, Write, All, etc.)</li>
                <li>Permission (Allow or Deny)</li>
            </ul>
        </div>

        <h3>🗑️ Deleting ACLs</h3>
        <div class="step">
            <strong>Step 1:</strong> Right-click on your <strong>cluster</strong> in the Kafka Explorer<br>
            <strong>Step 2:</strong> Select <strong>"🗑️ Delete ACL"</strong><br>
            <strong>Step 3:</strong> Specify the ACL to delete using the same wizard
        </div>

        <h3>📋 Viewing ACLs</h3>
        <div class="step">
            <strong>For Topics:</strong> Expand any topic → Click on the <strong>"🔒 ACLs"</strong> section<br>
            <strong>For Clusters:</strong> ACLs are automatically fetched and displayed
        </div>

        <h2>💡 Common ACL Patterns</h2>

        <h3>📖 Consumer Pattern (Read from Topic)</h3>
        <div class="code-block">
Resource: Topic → "my-topic"
Operation: Read
Permission: Allow
Principal: User:consumer-app

PLUS (for consumer groups):
Resource: Group → "my-consumer-group"
Operation: Read
Permission: Allow
Principal: User:consumer-app
        </div>

        <h3>✍️ Producer Pattern (Write to Topic)</h3>
        <div class="code-block">
Resource: Topic → "my-topic"
Operation: Write
Permission: Allow
Principal: User:producer-app
        </div>

        <h3>👑 Admin Pattern (Full Access)</h3>
        <div class="code-block">
Resource: Topic → "*" (all topics)
Operation: All
Permission: Allow
Principal: User:admin
        </div>

        <h2>🔒 Security Considerations</h2>

        <h3>✅ Best Practices</h3>
        <ol>
            <li><strong>Principle of Least Privilege</strong>: Grant only necessary permissions</li>
            <li><strong>Regular Audits</strong>: Review ACLs periodically</li>
            <li><strong>Group-based Access</strong>: Use groups for easier management</li>
            <li><strong>Wildcard Caution</strong>: Be careful with wildcard permissions</li>
            <li><strong>Documentation</strong>: Keep track of ACL purposes</li>
        </ol>

        <h3>🎯 Common Patterns</h3>
        <ul>
            <li><strong>Read-only users</strong>: Grant only Read and Describe operations</li>
            <li><strong>Producers</strong>: Grant Write, Create, and Describe operations</li>
            <li><strong>Consumers</strong>: Grant Read, Describe, and group operations</li>
            <li><strong>Admins</strong>: Grant All operations on specific resources</li>
        </ul>

        <h2>🔧 Troubleshooting</h2>

        <h3>❌ "Security features are disabled"</h3>
        <div class="highlight">
            This is <strong>expected behavior</strong> for Kafka clusters without authorization enabled.
            To enable ACLs, add this to your <code>server.properties</code>:
            <div class="code-block">
authorizer.class.name=kafka.security.authorizer.AclAuthorizer
allow.everyone.if.no.acl.found=false
super.users=User:ANONYMOUS
            </div>
            Then restart Kafka.
        </div>

        <h3>🔍 No ACLs showing up?</h3>
        <ul>
            <li>Check if authorization is enabled on your cluster</li>
            <li>Verify you have permission to describe ACLs</li>
            <li>Expand topics to see topic-specific ACLs</li>
            <li>Check cluster logs for authorization errors</li>
        </ul>

        <h3>📊 View ACLs for specific resources</h3>
        <ul>
            <li><strong>Topic ACLs:</strong> Expand topic → Click "🔒 ACLs" section</li>
            <li><strong>All ACLs:</strong> View cluster-level ACLs in Kafka Explorer</li>
        </ul>

        <h2>📚 External Resources</h2>
        <ul>
            <li><a href="https://kafka.apache.org/documentation/#security_authz" class="resource-link">Kafka Security Documentation</a></li>
            <li><a href="https://kafka.apache.org/documentation/#security_authz_acl" class="resource-link">ACL Configuration Guide</a></li>
            <li><a href="https://kafka.apache.org/documentation/#security_sasl" class="resource-link">SASL Configuration</a></li>
            <li><a href="https://kafka.apache.org/documentation/#security_ssl" class="resource-link">SSL/TLS Configuration</a></li>
        </ul>

        <div class="highlight">
            <h3>📝 Key Points</h3>
            <ul>
                <li>✅ <strong>Native Support:</strong> This extension uses the KafkaJS Admin API (no CLI required)</li>
                <li>✅ <strong>Instant Changes:</strong> ACL changes take effect immediately</li>
                <li>✅ <strong>Interactive Wizards:</strong> Guided UI for creating/deleting ACLs</li>
                <li>⚠️ <strong>Authorization Required:</strong> Your cluster must have authorization enabled</li>
                <li>📝 <strong>Best Practice:</strong> Always follow the principle of least privilege</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
    }

    static getACLManagementMessage(): string {
        return `✅ ACL management is now fully integrated into this extension!

To manage ACLs:
• Right-click on your cluster → "🔒 Create ACL"
• Right-click on your cluster → "🗑️ Delete ACL"
• Expand topics → Click "🔒 ACLs" to view topic-specific ACLs

⚠️ Note: Your Kafka cluster must have authorization enabled.
If you see "Security features are disabled", this is normal for dev/test environments.

Use the ACL Help command for detailed guidance.`;
    }

    static getACLSearchMessage(): string {
        return `To view ACLs in this extension:

📋 View All ACLs:
• Expand your cluster in Kafka Explorer
• ACLs are automatically loaded

🔍 View Topic-Specific ACLs:
• Expand any topic
• Click on the "🔒 ACLs" section

💡 Tip: If no ACLs appear, your cluster may not have authorization enabled.

Use the ACL Help command for more examples.`;
    }
}