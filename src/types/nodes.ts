/**
 * Type definitions for tree view nodes
 * Provides type safety for command parameters
 */

import { ACL } from './acl';

/**
 * Base node type
 */
export interface BaseNode {
    clusterName: string;
    label?: string;
    contextValue?: string;
}

/**
 * Cluster node
 */
export interface ClusterNode extends BaseNode {
    contextValue?: 'cluster';
}

/**
 * Topic node
 */
export interface TopicNode extends BaseNode {
    contextValue?: 'topic';
    topicName: string;
}

/**
 * Consumer group node
 */
export interface ConsumerGroupNode extends BaseNode {
    contextValue?: 'consumerGroup';
    groupId: string;
}

/**
 * Broker node
 */
export interface BrokerNode extends BaseNode {
    contextValue?: 'broker';
    brokerId: number;
    host: string;
    port: number;
}

/**
 * ACL node
 */
export interface ACLNode extends BaseNode {
    contextValue?: 'acl';
    acl: ACL;
}

/**
 * Topic ACL Container node (shows under topics)
 */
export interface TopicACLContainerNode extends BaseNode {
    contextValue?: 'topicACLContainer';
    topicName: string;
}

/**
 * Topic ACL node (individual ACL under a topic)
 */
export interface TopicACLNode extends BaseNode {
    contextValue?: 'topicACL';
    topicName: string;
    acl: ACL;
}

/**
 * Union type for all node types
 */
export type KafkaNode = ClusterNode | TopicNode | ConsumerGroupNode | BrokerNode | ACLNode | TopicACLContainerNode | TopicACLNode;

/**
 * Type guard for ClusterNode
 */
export function isClusterNode(node: any): node is ClusterNode {
    return node?.contextValue === 'cluster';
}

/**
 * Type guard for TopicNode
 */
export function isTopicNode(node: any): node is TopicNode {
    return node?.contextValue === 'topic';
}

/**
 * Type guard for ConsumerGroupNode
 */
export function isConsumerGroupNode(node: any): node is ConsumerGroupNode {
    return node?.contextValue === 'consumerGroup';
}

/**
 * Type guard for BrokerNode
 */
export function isBrokerNode(node: any): node is BrokerNode {
    return node?.contextValue === 'broker';
}

/**
 * Type guard for ACLNode
 */
export function isACLNode(node: any): node is ACLNode {
    return node?.contextValue === 'acl';
}

/**
 * Type guard for TopicACLContainerNode
 */
export function isTopicACLContainerNode(node: any): node is TopicACLContainerNode {
    return node?.contextValue === 'topicACLContainer';
}

/**
 * Type guard for TopicACLNode
 */
export function isTopicACLNode(node: any): node is TopicACLNode {
    return node?.contextValue === 'topicACL';
}
