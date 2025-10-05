#!/usr/bin/env node

const { Kafka } = require('kafkajs');

async function testKafka() {
    const kafka = new Kafka({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
        retry: {
            retries: 3,
            initialRetryTime: 300,
        }
    });

    console.log('Testing Kafka connection to localhost:9092...\n');

    try {
        const admin = kafka.admin();
        await admin.connect();
        console.log('✅ Connected to Kafka successfully!\n');

        // List existing topics
        const topics = await admin.listTopics();
        console.log(`📋 Existing topics (${topics.length}):`);
        topics.forEach(topic => console.log(`  - ${topic}`));
        console.log();

        // Get cluster info
        const cluster = await admin.describeCluster();
        console.log(`🖥️  Cluster info:`);
        console.log(`  Brokers: ${cluster.brokers.length}`);
        cluster.brokers.forEach(broker => {
            console.log(`    - ${broker.host}:${broker.port} (node ${broker.nodeId})`);
        });
        console.log();

        // Test topic creation
        const testTopicName = `test-topic-${Date.now()}`;
        console.log(`🧪 Testing topic creation: ${testTopicName}`);

        try {
            const result = await admin.createTopics({
                topics: [
                    {
                        topic: testTopicName,
                        numPartitions: 1,
                        replicationFactor: 1
                    }
                ],
                waitForLeaders: true,
                timeout: 5000
            });

            if (result) {
                console.log(`✅ Topic created successfully!`);

                // Delete the test topic
                await admin.deleteTopics({
                    topics: [testTopicName],
                    timeout: 5000
                });
                console.log(`🗑️  Test topic cleaned up\n`);
            } else {
                console.log(`❌ Topic creation returned false\n`);
            }
        } catch (createError) {
            console.error(`❌ Topic creation failed:`, createError.message);
            if (createError.errors) {
                console.error('   Errors:', JSON.stringify(createError.errors, null, 2));
            }
            console.log();
        }

        await admin.disconnect();
        console.log('✅ All tests completed!\n');

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('\nPossible issues:');
        console.error('  1. Kafka is not running on localhost:9092');
        console.error('  2. Kafka requires authentication (SASL)');
        console.error('  3. Firewall is blocking the connection');
        console.error('\nTo start a local Kafka instance, run:');
        console.error('  docker run -p 9092:9092 apache/kafka:latest\n');
        process.exit(1);
    }
}

testKafka().catch(console.error);
