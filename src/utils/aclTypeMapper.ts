/**
 * ACL Type Mapper - Handles conversion between extension ACL types and KafkaJS types
 * Extracted from KafkaClientManager to follow Single Responsibility Principle
 */

import {
    AclResourceTypes,
    AclOperationTypes,
    AclPermissionTypes,
    ResourcePatternTypes
} from 'kafkajs';

export class ACLTypeMapper {
    /**
     * Map extension resource type string to KafkaJS AclResourceTypes
     */
    static toKafkaJSResourceType(resourceType: string): AclResourceTypes {
        const typeMap: { [key: string]: AclResourceTypes } = {
            'any': AclResourceTypes.ANY,
            'topic': AclResourceTypes.TOPIC,
            'group': AclResourceTypes.GROUP,
            'cluster': AclResourceTypes.CLUSTER,
            'transactional_id': AclResourceTypes.TRANSACTIONAL_ID,
            'delegation_token': AclResourceTypes.DELEGATION_TOKEN
        };

        const normalized = resourceType.toLowerCase().replace(/-/g, '_');
        return typeMap[normalized] || AclResourceTypes.UNKNOWN;
    }

    /**
     * Map KafkaJS AclResourceTypes to extension resource type string
     */
    static fromKafkaJSResourceType(resourceType: AclResourceTypes): string {
        const typeMap: { [key: number]: string } = {
            [AclResourceTypes.UNKNOWN]: 'unknown',
            [AclResourceTypes.ANY]: 'any',
            [AclResourceTypes.TOPIC]: 'topic',
            [AclResourceTypes.GROUP]: 'group',
            [AclResourceTypes.CLUSTER]: 'cluster',
            [AclResourceTypes.TRANSACTIONAL_ID]: 'transactional_id',
            [AclResourceTypes.DELEGATION_TOKEN]: 'delegation_token'
        };

        return typeMap[resourceType] || 'unknown';
    }

    /**
     * Map extension operation string to KafkaJS AclOperationTypes
     */
    static toKafkaJSOperation(operation: string): AclOperationTypes {
        const operationMap: { [key: string]: AclOperationTypes } = {
            'any': AclOperationTypes.ANY,
            'all': AclOperationTypes.ALL,
            'read': AclOperationTypes.READ,
            'write': AclOperationTypes.WRITE,
            'create': AclOperationTypes.CREATE,
            'delete': AclOperationTypes.DELETE,
            'alter': AclOperationTypes.ALTER,
            'describe': AclOperationTypes.DESCRIBE,
            'cluster_action': AclOperationTypes.CLUSTER_ACTION,
            'describe_configs': AclOperationTypes.DESCRIBE_CONFIGS,
            'alter_configs': AclOperationTypes.ALTER_CONFIGS,
            'idempotent_write': AclOperationTypes.IDEMPOTENT_WRITE
        };

        const normalized = operation.toLowerCase().replace(/-/g, '_');
        return operationMap[normalized] || AclOperationTypes.UNKNOWN;
    }

    /**
     * Map KafkaJS AclOperationTypes to extension operation string
     */
    static fromKafkaJSOperation(operation: AclOperationTypes): string {
        const operationMap: { [key: number]: string } = {
            [AclOperationTypes.UNKNOWN]: 'Unknown',
            [AclOperationTypes.ANY]: 'Any',
            [AclOperationTypes.ALL]: 'All',
            [AclOperationTypes.READ]: 'Read',
            [AclOperationTypes.WRITE]: 'Write',
            [AclOperationTypes.CREATE]: 'Create',
            [AclOperationTypes.DELETE]: 'Delete',
            [AclOperationTypes.ALTER]: 'Alter',
            [AclOperationTypes.DESCRIBE]: 'Describe',
            [AclOperationTypes.CLUSTER_ACTION]: 'ClusterAction',
            [AclOperationTypes.DESCRIBE_CONFIGS]: 'DescribeConfigs',
            [AclOperationTypes.ALTER_CONFIGS]: 'AlterConfigs',
            [AclOperationTypes.IDEMPOTENT_WRITE]: 'IdempotentWrite'
        };

        return operationMap[operation] || 'Unknown';
    }

    /**
     * Map extension permission string to KafkaJS AclPermissionTypes
     */
    static toKafkaJSPermission(permissionType: string): AclPermissionTypes {
        const permissionMap: { [key: string]: AclPermissionTypes } = {
            'any': AclPermissionTypes.ANY,
            'deny': AclPermissionTypes.DENY,
            'allow': AclPermissionTypes.ALLOW
        };

        const normalized = permissionType.toLowerCase();
        return permissionMap[normalized] || AclPermissionTypes.UNKNOWN;
    }

    /**
     * Map KafkaJS AclPermissionTypes to extension permission string
     */
    static fromKafkaJSPermission(permissionType: AclPermissionTypes): string {
        const permissionMap: { [key: number]: string } = {
            [AclPermissionTypes.UNKNOWN]: 'unknown',
            [AclPermissionTypes.ANY]: 'any',
            [AclPermissionTypes.DENY]: 'deny',
            [AclPermissionTypes.ALLOW]: 'allow'
        };

        return permissionMap[permissionType] || 'unknown';
    }

    /**
     * Map extension pattern type string to KafkaJS ResourcePatternTypes
     */
    static toKafkaJSPatternType(patternType: string): ResourcePatternTypes {
        const patternMap: { [key: string]: ResourcePatternTypes } = {
            'any': ResourcePatternTypes.ANY,
            'match': ResourcePatternTypes.MATCH,
            'literal': ResourcePatternTypes.LITERAL,
            'prefixed': ResourcePatternTypes.PREFIXED
        };

        const normalized = patternType.toLowerCase();
        return patternMap[normalized] || ResourcePatternTypes.UNKNOWN;
    }

    /**
     * Map KafkaJS ResourcePatternTypes to extension pattern type string
     */
    static fromKafkaJSPatternType(patternType: ResourcePatternTypes): string {
        const patternMap: { [key: number]: string } = {
            [ResourcePatternTypes.UNKNOWN]: 'unknown',
            [ResourcePatternTypes.ANY]: 'any',
            [ResourcePatternTypes.MATCH]: 'match',
            [ResourcePatternTypes.LITERAL]: 'literal',
            [ResourcePatternTypes.PREFIXED]: 'prefixed'
        };

        return patternMap[patternType] || 'unknown';
    }
}
