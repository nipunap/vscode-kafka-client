/**
 * ACL (Access Control List) interface representing a Kafka ACL entry
 */
export interface ACL {
    /** The principal (user or group) for this ACL */
    principal: string;
    /** The operation being allowed/denied */
    operation: string;
    /** The type of resource this ACL applies to */
    resourceType: 'topic' | 'group' | 'cluster' | 'transactional_id';
    /** The name of the resource */
    resourceName: string;
    /** Whether this ACL allows or denies the operation */
    permissionType: 'allow' | 'deny';
    /** Optional host restriction */
    host?: string;
    /** Optional resource pattern type */
    resourcePatternType?: string;
}

/**
 * Detailed ACL information with formatted description
 */
export interface ACLDetails {
    /** The principal (user or group) for this ACL */
    principal: string;
    /** The operation being allowed/denied */
    operation: string;
    /** The type of resource this ACL applies to */
    resourceType: string;
    /** The name of the resource */
    resourceName: string;
    /** Whether this ACL allows or denies the operation */
    permissionType: string;
    /** Host restriction */
    host: string;
    /** Resource pattern type */
    resourcePatternType: string;
    /** Human-readable description of the ACL */
    description: string;
}

/**
 * Configuration for creating a new ACL
 */
export interface ACLConfig {
    /** The principal (user or group) for this ACL */
    principal: string;
    /** The operation being allowed/denied */
    operation: string;
    /** The type of resource this ACL applies to */
    resourceType: string;
    /** The name of the resource */
    resourceName: string;
    /** Whether this ACL allows or denies the operation */
    permissionType: 'allow' | 'deny';
    /** Optional host restriction */
    host?: string;
    /** Optional resource pattern type */
    resourcePatternType?: string;
}
