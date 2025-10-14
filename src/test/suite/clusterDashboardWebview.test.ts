/**
 * Test suite for ClusterDashboardWebview
 * Tests the new consumer groups dashboard feature
 */

import * as assert from 'assert';
import { ClusterDashboardWebview } from '../../views/clusterDashboardWebview';
import { KafkaClientManager } from '../../kafka/kafkaClientManager';

suite('ClusterDashboardWebview Test Suite', () => {
    let clientManager: KafkaClientManager;
    let dashboardWebview: ClusterDashboardWebview;

    setup(() => {
        clientManager = new KafkaClientManager();
        dashboardWebview = new ClusterDashboardWebview(clientManager);
    });

    teardown(() => {
        clientManager.dispose();
    });

    suite('Consumer Groups Dashboard Feature', () => {
        test('should create ClusterDashboardWebview instance', () => {
            assert.ok(dashboardWebview);
            assert.strictEqual(typeof dashboardWebview, 'object');
        });

        test('should have getTopConsumerGroupsParallel method', () => {
            // Access private method through any cast for testing
            const privateWebview = dashboardWebview as any;
            assert.strictEqual(typeof privateWebview.getTopConsumerGroupsParallel, 'function');
        });

        test('getTopConsumerGroupsParallel should include all groups with topic offsets', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [], state: 'Empty' },
                { groupId: 'group2', members: [{ memberId: 'm1' }], state: 'Stable' },
                { groupId: 'group3', members: [], state: 'Dead' }
            ];

            // Mock getConsumerGroupDetails
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: [
                        { topic: 'test-topic', partition: 0, offset: '100' }
                    ]
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should return all groups that have topics (regardless of member count)
            assert.strictEqual(result.length, 3);
        });

        test('getTopConsumerGroupsParallel should sort by member count then topic count', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }], state: 'Stable' },
                { groupId: 'group2', members: [{ memberId: 'm1' }, { memberId: 'm2' }, { memberId: 'm3' }], state: 'Stable' },
                { groupId: 'group3', members: [{ memberId: 'm1' }, { memberId: 'm2' }], state: 'Stable' }
            ];

            // Mock getConsumerGroupDetails - all have 1 topic to test member count sorting
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: [
                        { topic: 'topic1', partition: 0, offset: '100' }
                    ]
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should be sorted by member count (highest first)
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].groupId, 'group2'); // 3 members
            assert.strictEqual(result[0].memberCount, 3);
            assert.strictEqual(result[1].groupId, 'group3'); // 2 members
            assert.strictEqual(result[1].memberCount, 2);
            assert.strictEqual(result[2].groupId, 'group1'); // 1 member
            assert.strictEqual(result[2].memberCount, 1);
        });

        test('getTopConsumerGroupsParallel should limit to top 10 groups', async () => {
            const mockConsumerGroups = Array.from({ length: 15 }, (_, i) => ({
                groupId: `group${i}`,
                members: Array.from({ length: 15 - i }, (_, j) => ({ memberId: `m${j}` })),
                state: 'Stable'
            }));

            // Mock getConsumerGroupDetails
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: [
                        { topic: 'test-topic', partition: 0, offset: '100' }
                    ]
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should limit to 10 groups
            assert.strictEqual(result.length, 10);
        });

        test('getTopConsumerGroupsParallel should extract unique topics from offsets', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }], state: 'Stable' }
            ];

            // Mock getConsumerGroupDetails with multiple topics
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: [
                        { topic: 'topic1', partition: 0, offset: '100' },
                        { topic: 'topic1', partition: 1, offset: '200' },
                        { topic: 'topic2', partition: 0, offset: '300' },
                        { topic: 'topic3', partition: 0, offset: '400' }
                    ]
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should have 3 unique topics
            assert.strictEqual(result[0].topics.length, 3);

            // Check topic1 has 2 partitions
            const topic1 = result[0].topics.find((t: any) => t.name === 'topic1');
            assert.ok(topic1);
            assert.strictEqual(topic1.partitions, 2);

            // Check topic2 has 1 partition
            const topic2 = result[0].topics.find((t: any) => t.name === 'topic2');
            assert.ok(topic2);
            assert.strictEqual(topic2.partitions, 1);

            // Check topic3 has 1 partition
            const topic3 = result[0].topics.find((t: any) => t.name === 'topic3');
            assert.ok(topic3);
            assert.strictEqual(topic3.partitions, 1);
        });

        test('getTopConsumerGroupsParallel should filter out groups with no offsets', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }], state: 'Stable' }
            ];

            // Mock getConsumerGroupDetails with no offsets
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: []
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should filter out groups without topics
            assert.strictEqual(result.length, 0);
        });

        test('getTopConsumerGroupsParallel should handle errors gracefully', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }], state: 'Stable' },
                { groupId: 'group2', members: [{ memberId: 'm1' }], state: 'Stable' }
            ];

            // Mock getConsumerGroupDetails to throw error for group1
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, groupId: string) => {
                if (groupId === 'group1') {
                    throw new Error('Failed to fetch group details');
                }
                return {
                    offsets: [
                        { topic: 'test-topic', partition: 0, offset: '100' }
                    ]
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should only return group2 (group1 filtered out due to no topics)
            assert.strictEqual(result.length, 1);

            const group2Result = result.find((g: any) => g.groupId === 'group2');
            assert.ok(group2Result);
            assert.strictEqual(group2Result.topics.length, 1);
        });

        test('getTopConsumerGroupsParallel should preserve state information', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }], state: 'Stable' },
                { groupId: 'group2', members: [{ memberId: 'm1' }], state: 'Empty' },
                { groupId: 'group3', members: [{ memberId: 'm1' }], state: 'Dead' }
            ];

            // Mock getConsumerGroupDetails
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: [
                        { topic: 'test-topic', partition: 0, offset: '100' }
                    ]
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should preserve all states
            assert.strictEqual(result[0].state, 'Stable');
            assert.strictEqual(result[1].state, 'Empty');
            assert.strictEqual(result[2].state, 'Dead');
        });

        test('getTopConsumerGroupsParallel should filter groups with undefined offsets', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }], state: 'Stable' }
            ];

            // Mock getConsumerGroupDetails with undefined offsets
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: undefined as any
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should filter out groups with undefined offsets
            assert.strictEqual(result.length, 0);
        });

        test('getTopConsumerGroupsParallel should handle offsets without topic field', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }], state: 'Stable' }
            ];

            // Mock getConsumerGroupDetails with offsets missing topic field
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: [
                        { partition: 0, offset: '100' },
                        { topic: 'valid-topic', partition: 0, offset: '200' }
                    ] as any
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should only count valid topics
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].topics.length, 1);
            assert.strictEqual(result[0].topics[0].name, 'valid-topic');
        });

        test('getTopConsumerGroupsParallel should handle groups without state', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }] } as any
            ];

            // Mock getConsumerGroupDetails
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: [
                        { topic: 'test-topic', partition: 0, offset: '100' }
                    ]
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Should default to 'Unknown' state
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].state, 'Unknown');
        });

        test('getTopConsumerGroupsParallel should process groups in parallel', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: [{ memberId: 'm1' }], state: 'Stable' },
                { groupId: 'group2', members: [{ memberId: 'm1' }], state: 'Stable' },
                { groupId: 'group3', members: [{ memberId: 'm1' }], state: 'Stable' }
            ];

            let callCount = 0;
            const callTimestamps: number[] = [];

            // Mock getConsumerGroupDetails to track parallel execution
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                callTimestamps.push(Date.now());
                callCount++;
                // Simulate async delay
                await new Promise(resolve => setTimeout(resolve, 10));
                return {
                    offsets: [
                        { topic: 'test-topic', partition: 0, offset: '100' }
                    ]
                };
            };

            const startTime = Date.now();
            const privateWebview = dashboardWebview as any;
            await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);
            const totalTime = Date.now() - startTime;

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // All calls should happen in parallel (within a small time window)
            assert.strictEqual(callCount, 3);

            // Check that calls started nearly simultaneously (within 5ms of each other)
            const timeDiff = callTimestamps[callTimestamps.length - 1] - callTimestamps[0];
            assert.ok(timeDiff < 20, `Calls should be parallel, but took ${timeDiff}ms between first and last`);

            // Total time should be close to single delay (10ms), not sum of all (30ms)
            assert.ok(totalTime < 50, `Parallel execution should take <50ms, took ${totalTime}ms`);
        });
    });

    suite('Consumer Groups Data Structure', () => {
        test('should return consumer group with correct structure', async () => {
            const mockConsumerGroups = [
                { groupId: 'test-group', members: [{ memberId: 'm1' }], state: 'Stable' }
            ];

            // Mock getConsumerGroupDetails
            const originalMethod = clientManager.getConsumerGroupDetails;
            clientManager.getConsumerGroupDetails = async (_clusterName: string, _groupId: string) => {
                return {
                    offsets: [
                        { topic: 'topic1', partition: 0, offset: '100' },
                        { topic: 'topic1', partition: 1, offset: '200' }
                    ]
                };
            };

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Restore original method
            clientManager.getConsumerGroupDetails = originalMethod;

            // Verify structure
            assert.strictEqual(result.length, 1);
            const group = result[0];

            assert.ok(group.hasOwnProperty('groupId'));
            assert.ok(group.hasOwnProperty('memberCount'));
            assert.ok(group.hasOwnProperty('state'));
            assert.ok(group.hasOwnProperty('topics'));

            assert.strictEqual(typeof group.groupId, 'string');
            assert.strictEqual(typeof group.memberCount, 'number');
            assert.strictEqual(typeof group.state, 'string');
            assert.ok(Array.isArray(group.topics));

            // Verify topic structure
            const topic = group.topics[0];
            assert.ok(topic.hasOwnProperty('name'));
            assert.ok(topic.hasOwnProperty('partitions'));
            assert.strictEqual(typeof topic.name, 'string');
            assert.strictEqual(typeof topic.partitions, 'number');
        });
    });

    suite('Edge Cases', () => {
        test('should handle empty consumer groups array', async () => {
            const mockConsumerGroups: any[] = [];

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            assert.strictEqual(result.length, 0);
        });

        test('should handle consumer groups with null members', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', members: null as any, state: 'Empty' }
            ];

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Should filter out groups with null members (treated as 0 members)
            assert.strictEqual(result.length, 0);
        });

        test('should handle consumer groups with undefined members', async () => {
            const mockConsumerGroups = [
                { groupId: 'group1', state: 'Empty' } as any
            ];

            const privateWebview = dashboardWebview as any;
            const result = await privateWebview.getTopConsumerGroupsParallel('test-cluster', mockConsumerGroups);

            // Should filter out groups with undefined members (treated as 0 members)
            assert.strictEqual(result.length, 0);
        });
    });
});
