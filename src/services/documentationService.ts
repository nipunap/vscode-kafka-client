export class DocumentationService {
    static getACLHelpContent(): string {
        return `# Kafka ACL Management

## Overview
Access Control Lists (ACLs) in Kafka control which users can perform which operations on which resources.

## ACL Components

### Principal
- **User**: \`User:username\` - Individual user
- **Group**: \`Group:groupname\` - User group
- **Anonymous**: \`User:*\` - Anonymous users

### Operations
- **Read**: Read data from topics
- **Write**: Write data to topics
- **Create**: Create topics/partitions
- **Delete**: Delete topics/partitions
- **Alter**: Modify topic configurations
- **Describe**: View topic metadata
- **ClusterAction**: Administrative operations
- **DescribeConfigs**: View configurations
- **AlterConfigs**: Modify configurations

### Resource Types
- **Topic**: Individual topics
- **Group**: Consumer groups
- **Cluster**: Cluster-wide operations
- **TransactionalId**: Transactional operations

### Permission Types
- **Allow**: Grant permission
- **Deny**: Explicitly deny permission

## Common ACL Examples

### Grant read access to a topic
\`\`\`bash
kafka-acls --bootstrap-server <broker> --add \\
  --allow-principal User:myuser \\
  --operation Read \\
  --topic my-topic
\`\`\`

### Grant write access to a topic
\`\`\`bash
kafka-acls --bootstrap-server <broker> --add \\
  --allow-principal User:myuser \\
  --operation Write \\
  --topic my-topic
\`\`\`

### Grant consumer group access
\`\`\`bash
kafka-acls --bootstrap-server <broker> --add \\
  --allow-principal User:myuser \\
  --operation Read \\
  --group my-group
\`\`\`

### Grant cluster-wide permissions
\`\`\`bash
kafka-acls --bootstrap-server <broker> --add \\
  --allow-principal User:admin \\
  --operation All \\
  --cluster
\`\`\`

## Best Practices

1. **Principle of Least Privilege**: Grant only necessary permissions
2. **Use Groups**: Group users with similar permissions
3. **Regular Audits**: Review ACLs periodically
4. **Documentation**: Document ACL purposes
5. **Testing**: Test ACLs in non-production first

## Troubleshooting

### Common Issues
- **Authorization Failed**: Check ACL permissions
- **Principal Not Found**: Verify user/group exists
- **Resource Not Found**: Check resource names
- **Operation Not Allowed**: Verify operation permissions

### Debugging Commands
\`\`\`bash
# List all ACLs
kafka-acls --bootstrap-server <broker> --list

# Test specific operation
kafka-console-producer --bootstrap-server <broker> --topic my-topic
kafka-console-consumer --bootstrap-server <broker> --topic my-topic --group my-group
\`\`\`

## Security Considerations

- **Network Security**: Use TLS for ACL communication
- **Authentication**: Ensure proper user authentication
- **Regular Updates**: Keep ACLs up to date
- **Monitoring**: Monitor ACL changes and violations
- **Backup**: Backup ACL configurations

For more information, see the [Kafka Security Documentation](https://kafka.apache.org/documentation/#security).`;
    }

    static getACLManagementMessage(): string {
        return `ACL management requires direct Kafka admin API access, which is not available through KafkaJS.

To manage ACLs, use the kafka-acls command line tool:

# List all ACLs
kafka-acls --bootstrap-server <broker> --list

# Add an ACL
kafka-acls --bootstrap-server <broker> --add \\
  --allow-principal User:myuser \\
  --operation Read \\
  --topic my-topic

# Remove an ACL
kafka-acls --bootstrap-server <broker> --remove \\
  --allow-principal User:myuser \\
  --operation Read \\
  --topic my-topic

For more information, see the Kafka ACL documentation.`;
    }

    static getACLSearchMessage(): string {
        return `To search for ACLs, use the kafka-acls command line tool:

# List all ACLs
kafka-acls --bootstrap-server <broker> --list

# List ACLs for a specific principal
kafka-acls --bootstrap-server <broker> --list --principal User:myuser

# List ACLs for a specific resource
kafka-acls --bootstrap-server <broker> --list --topic my-topic

# List ACLs for a specific operation
kafka-acls --bootstrap-server <broker> --list --operation Read`;
    }
}
