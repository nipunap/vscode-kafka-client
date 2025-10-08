import * as assert from 'assert';
import { ConnectionPool } from '../../infrastructure/ConnectionPool';
import { Kafka, Admin, Producer } from 'kafkajs';
import * as sinon from 'sinon';

suite('ConnectionPool Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let connectionPool: ConnectionPool;

    setup(() => {
        sandbox = sinon.createSandbox();
        connectionPool = new ConnectionPool();
    });

    teardown(async () => {
        await connectionPool.dispose();
        sandbox.restore();
    });

    test('should create new connection on first get', async () => {
        const mockAdmin = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().resolves()
        } as unknown as Admin;

        const mockProducer = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().resolves()
        } as unknown as Producer;

        const mockKafka = {
            admin: () => mockAdmin,
            producer: () => mockProducer,
            disconnect: sandbox.stub().resolves()
        } as unknown as Kafka;

        const kafkaFactory = () => mockKafka;

        const { admin, producer } = await connectionPool.get('test-cluster', kafkaFactory);

        assert.strictEqual(admin, mockAdmin);
        assert.strictEqual(producer, mockProducer);
        assert.ok((mockAdmin.connect as sinon.SinonStub).calledOnce);
        assert.ok((mockProducer.connect as sinon.SinonStub).calledOnce);
    });

    test('should reuse existing connection', async () => {
        const mockAdmin = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().resolves()
        } as unknown as Admin;

        const mockProducer = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().resolves()
        } as unknown as Producer;

        const mockKafka = {
            admin: () => mockAdmin,
            producer: () => mockProducer,
            disconnect: sandbox.stub().resolves()
        } as unknown as Kafka;

        const kafkaFactory = sandbox.stub().returns(mockKafka);

        // First call
        await connectionPool.get('test-cluster', kafkaFactory);
        
        // Second call
        const { admin, producer } = await connectionPool.get('test-cluster', kafkaFactory);

        assert.strictEqual(admin, mockAdmin);
        assert.strictEqual(producer, mockProducer);
        // Factory should only be called once
        assert.ok(kafkaFactory.calledOnce);
        // Connect should only be called once
        assert.ok((mockAdmin.connect as sinon.SinonStub).calledOnce);
    });

    test('should handle connection errors', async () => {
        const mockAdmin = {
            connect: sandbox.stub().rejects(new Error('Connection failed')),
            disconnect: sandbox.stub().resolves()
        } as unknown as Admin;

        const mockProducer = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().resolves()
        } as unknown as Producer;

        const mockKafka = {
            admin: () => mockAdmin,
            producer: () => mockProducer,
            disconnect: sandbox.stub().resolves()
        } as unknown as Kafka;

        const kafkaFactory = () => mockKafka;

        try {
            await connectionPool.get('test-cluster', kafkaFactory);
            assert.fail('Should have thrown an error');
        } catch (error: any) {
            assert.ok(error.message.includes('Connection failed'));
        }
    });

    test('should disconnect specific connection', async () => {
        const mockAdmin = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().resolves()
        } as unknown as Admin;

        const mockProducer = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().resolves()
        } as unknown as Producer;

        const mockKafka = {
            admin: () => mockAdmin,
            producer: () => mockProducer,
            disconnect: sandbox.stub().resolves()
        } as unknown as Kafka;

        const kafkaFactory = () => mockKafka;

        await connectionPool.get('test-cluster', kafkaFactory);
        await connectionPool.disconnect('test-cluster');

        assert.ok((mockAdmin.disconnect as sinon.SinonStub).calledOnce);
        assert.ok((mockProducer.disconnect as sinon.SinonStub).calledOnce);
    });

    test('should handle disconnect errors gracefully', async () => {
        const mockAdmin = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().rejects(new Error('Disconnect failed'))
        } as unknown as Admin;

        const mockProducer = {
            connect: sandbox.stub().resolves(),
            disconnect: sandbox.stub().resolves()
        } as unknown as Producer;

        const mockKafka = {
            admin: () => mockAdmin,
            producer: () => mockProducer,
            disconnect: sandbox.stub().resolves()
        } as unknown as Kafka;

        const kafkaFactory = () => mockKafka;

        await connectionPool.get('test-cluster', kafkaFactory);
        
        // Should not throw
        await connectionPool.disconnect('test-cluster');
    });

    test('should dispose all connections', async () => {
        const createMockConnection = () => {
            const mockAdmin = {
                connect: sandbox.stub().resolves(),
                disconnect: sandbox.stub().resolves()
            } as unknown as Admin;

            const mockProducer = {
                connect: sandbox.stub().resolves(),
                disconnect: sandbox.stub().resolves()
            } as unknown as Producer;

            const mockKafka = {
                admin: () => mockAdmin,
                producer: () => mockProducer,
                disconnect: sandbox.stub().resolves()
            } as unknown as Kafka;

            return { mockKafka, mockAdmin, mockProducer };
        };

        const conn1 = createMockConnection();
        const conn2 = createMockConnection();

        await connectionPool.get('cluster1', () => conn1.mockKafka);
        await connectionPool.get('cluster2', () => conn2.mockKafka);

        await connectionPool.dispose();

        assert.ok((conn1.mockAdmin.disconnect as sinon.SinonStub).calledOnce);
        assert.ok((conn2.mockAdmin.disconnect as sinon.SinonStub).calledOnce);
    });

    test('should handle non-existent cluster disconnect', async () => {
        // Should not throw
        await connectionPool.disconnect('non-existent-cluster');
    });

    test('should create separate connections for different clusters', async () => {
        const createMockConnection = () => {
            const mockAdmin = {
                connect: sandbox.stub().resolves(),
                disconnect: sandbox.stub().resolves()
            } as unknown as Admin;

            const mockProducer = {
                connect: sandbox.stub().resolves(),
                disconnect: sandbox.stub().resolves()
            } as unknown as Producer;

            const mockKafka = {
                admin: () => mockAdmin,
                producer: () => mockProducer,
                disconnect: sandbox.stub().resolves()
            } as unknown as Kafka;

            return { mockKafka, mockAdmin, mockProducer };
        };

        const conn1 = createMockConnection();
        const conn2 = createMockConnection();

        const result1 = await connectionPool.get('cluster1', () => conn1.mockKafka);
        const result2 = await connectionPool.get('cluster2', () => conn2.mockKafka);

        assert.notStrictEqual(result1.admin, result2.admin);
        assert.notStrictEqual(result1.producer, result2.producer);
    });
});

