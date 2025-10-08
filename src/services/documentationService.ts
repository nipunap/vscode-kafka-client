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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            border-left: 4px solid #3498db;
            padding-left: 15px;
        }
        h3 {
            color: #2c3e50;
            margin-top: 25px;
        }
        .code-block {
            background: #f4f4f4;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            overflow-x: auto;
        }
        .highlight {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        ul, ol {
            padding-left: 20px;
        }
        li {
            margin: 5px 0;
        }
        .resource-link {
            color: #3498db;
            text-decoration: none;
        }
        .resource-link:hover {
            text-decoration: underline;
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
        
        <h2>💡 Common ACL Examples</h2>
        
        <h3>📖 Grant read access to a topic</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --add \\
  --allow-principal User:myuser \\
  --operation Read \\
  --topic my-topic
        </div>
        
        <h3>✍️ Grant write access to a topic</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --add \\
  --allow-principal User:myuser \\
  --operation Write \\
  --topic my-topic
        </div>
        
        <h3>👑 Grant admin access to all topics</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --add \\
  --allow-principal User:admin \\
  --operation All \\
  --topic "*"
        </div>
        
        <h3>👥 Grant consumer group access</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --add \\
  --allow-principal User:consumer \\
  --operation Read \\
  --group my-group
        </div>
        
        <h3>🏢 Grant cluster admin access</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --add \\
  --allow-principal User:cluster-admin \\
  --operation ClusterAction \\
  --cluster
        </div>
        
        <h2>🛠️ ACL Management Commands</h2>
        
        <h3>📋 List all ACLs</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --list
        </div>
        
        <h3>🗑️ Remove an ACL</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --remove \\
  --allow-principal User:myuser \\
  --operation Read \\
  --topic my-topic
        </div>
        
        <h3>🧹 Remove all ACLs for a principal</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --remove \\
  --allow-principal User:myuser
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
        
        <h3>🔍 Check ACLs for a specific principal</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --list \\
  --principal User:myuser
        </div>
        
        <h3>📊 Check ACLs for a specific resource</h3>
        <div class="code-block">
kafka-acls --bootstrap-server &lt;broker&gt; --list \\
  --topic my-topic
        </div>
        
        <h3>🧪 Test ACLs</h3>
        <div class="code-block">
# Test with specific user
kafka-console-producer --bootstrap-server &lt;broker&gt; \\
  --topic my-topic \\
  --producer-property security.protocol=SASL_PLAINTEXT \\
  --producer-property sasl.mechanism=PLAIN \\
  --producer-property sasl.jaas.config="org.apache.kafka.common.security.plain.PlainLoginModule required username=\\"myuser\\" password=\\"mypassword\\";"
        </div>
        
        <h2>📚 External Resources</h2>
        <ul>
            <li><a href="https://kafka.apache.org/documentation/#security_authz" class="resource-link">Kafka Security Documentation</a></li>
            <li><a href="https://kafka.apache.org/documentation/#security_authz_acl" class="resource-link">ACL Configuration Guide</a></li>
            <li><a href="https://kafka.apache.org/documentation/#security_sasl" class="resource-link">SASL Configuration</a></li>
            <li><a href="https://kafka.apache.org/documentation/#security_ssl" class="resource-link">SSL/TLS Configuration</a></li>
        </ul>
        
        <div class="highlight">
            <h3>📝 Notes</h3>
            <ul>
                <li>ACLs are stored in the <code>__consumer_offsets</code> topic</li>
                <li>Changes take effect immediately</li>
                <li>Use <code>--dry-run</code> to test ACL changes</li>
                <li>Consider using Kafka RBAC for enterprise environments</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
    }

    static getACLManagementMessage(): string {
        return `ACL management requires the kafka-acls command line tool.

To manage ACLs, use commands like:
• kafka-acls --bootstrap-server <broker> --list
• kafka-acls --bootstrap-server <broker> --add --allow-principal User:myuser --operation Read --topic my-topic
• kafka-acls --bootstrap-server <broker> --remove --allow-principal User:myuser --operation Read --topic my-topic

Use the ACL Help command for detailed guidance.`;
    }

    static getACLSearchMessage(): string {
        return `To search for ACLs, use the kafka-acls command line tool:

• List all ACLs: kafka-acls --bootstrap-server <broker> --list
• Search by principal: kafka-acls --bootstrap-server <broker> --list --principal User:myuser
• Search by resource: kafka-acls --bootstrap-server <broker> --list --topic my-topic
• Search by operation: kafka-acls --bootstrap-server <broker> --list --operation Read

Use the ACL Help command for more examples.`;
    }
}