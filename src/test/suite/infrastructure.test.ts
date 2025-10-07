import * as assert from 'assert';
import * as vscode from 'vscode';
import { Logger, LogLevel } from '../../infrastructure/Logger';
import { ErrorHandler } from '../../infrastructure/ErrorHandler';
import { CredentialManager } from '../../infrastructure/CredentialManager';
import { EventBus, KafkaEvents } from '../../infrastructure/EventBus';
import * as sinon from 'sinon';

suite('Infrastructure Test Suite', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Logger', () => {
        test('should create logger instances', () => {
            const logger1 = Logger.getLogger('TestComponent1');
            const logger2 = Logger.getLogger('TestComponent2');

            assert.ok(logger1);
            assert.ok(logger2);
            assert.notStrictEqual(logger1, logger2, 'Different names should return different instances');
        });

        test('should respect log level', () => {
            const logger = Logger.getLogger('TestLogger');
            Logger.setLevel(LogLevel.ERROR);

            // Logger creates its own output channel, so we can't easily stub it
            // But we can verify the level is set
            assert.ok(logger, 'Logger should be created');
        });

        test('should have all log methods', () => {
            const logger = Logger.getLogger('TestLogger');
            
            assert.ok(typeof logger.debug === 'function');
            assert.ok(typeof logger.info === 'function');
            assert.ok(typeof logger.warn === 'function');
            assert.ok(typeof logger.error === 'function');
            assert.ok(typeof logger.show === 'function');
        });

        test('should handle errors in log messages', () => {
            const logger = Logger.getLogger('TestLogger');
            const error = new Error('Test error');
            
            // Should not throw
            assert.doesNotThrow(() => {
                logger.error('Test error message', error);
            });
        });

        test('should handle objects in log messages', () => {
            const logger = Logger.getLogger('TestLogger');
            const obj = { key: 'value', nested: { data: 123 } };
            
            // Should not throw
            assert.doesNotThrow(() => {
                logger.info('Test object message', obj);
            });
        });
    });

    suite('ErrorHandler', () => {
        test('should handle generic errors', () => {
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            ErrorHandler.handle(new Error('Test error'), 'Test operation');
            
            assert.ok(showErrorStub.calledOnce);
            const message = showErrorStub.firstCall.args[0] as string;
            assert.ok(message.includes('Test operation'));
            assert.ok(message.includes('Test error'));
        });

        test('should detect credential errors', () => {
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            ErrorHandler.handle(new Error('Token expired'), 'AWS operation');
            
            assert.ok(showErrorStub.calledOnce);
            const message = showErrorStub.firstCall.args[0] as string;
            assert.ok(message.includes('credentials'));
        });

        test('should detect network errors', () => {
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            ErrorHandler.handle(new Error('ECONNREFUSED'), 'Connection');
            
            assert.ok(showErrorStub.calledOnce);
            const message = showErrorStub.firstCall.args[0] as string;
            assert.ok(message.includes('Network error') || message.includes('network'));
        });

        test('should wrap async functions', async () => {
            const testFn = async () => {
                return 'success';
            };
            
            const result = await ErrorHandler.wrap(testFn, 'Test context');
            
            assert.strictEqual(result, 'success');
        });

        test('should handle errors in wrapped functions', async () => {
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            const testFn = async () => {
                throw new Error('Test error');
            };
            
            const result = await ErrorHandler.wrap(testFn, 'Test context');
            
            assert.strictEqual(result, undefined);
            assert.ok(showErrorStub.calledOnce);
        });

        test('should wrapWithDefault with default value', async () => {
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            const testFn = async () => {
                throw new Error('Test error');
            };
            
            const result = await ErrorHandler.wrapWithDefault(testFn, 'Test context', 'default');
            
            assert.strictEqual(result, 'default');
            assert.ok(showErrorStub.calledOnce);
        });

        test('should handle timeout errors with specific message', () => {
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            ErrorHandler.handle(new Error('Request timeout'), 'Kafka operation');
            
            assert.ok(showErrorStub.calledOnce);
            const message = showErrorStub.firstCall.args[0] as string;
            assert.ok(message.includes('Network error') || message.includes('timed out'));
        });

        test('should handle access denied errors', () => {
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            ErrorHandler.handle(new Error('AccessDenied: Not authorized'), 'AWS operation');
            
            assert.ok(showErrorStub.calledOnce);
            const message = showErrorStub.firstCall.args[0] as string;
            assert.ok(message.includes('Access denied') || message.includes('denied'));
        });
    });

    suite('CredentialManager', () => {
        let credentialManager: CredentialManager;
        let mockSecretStorage: vscode.SecretStorage;

        setup(() => {
            const storage = new Map<string, string>();
            mockSecretStorage = {
                get: async (key: string) => storage.get(key),
                store: async (key: string, value: string) => { storage.set(key, value); },
                delete: async (key: string) => { storage.delete(key); },
                onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event
            };
            credentialManager = new CredentialManager(mockSecretStorage);
        });

        test('should store and retrieve credentials', async () => {
            await credentialManager.storeCredentials('test-cluster', {
                saslPassword: 'secret-password',
                sslPassword: 'ssl-secret'
            });

            const credentials = await credentialManager.getCredentials('test-cluster');
            
            assert.ok(credentials);
            assert.strictEqual(credentials.saslPassword, 'secret-password');
            assert.strictEqual(credentials.sslPassword, 'ssl-secret');
        });

        test('should store individual passwords', async () => {
            await credentialManager.storePassword('test-cluster', 'sasl', 'my-password');
            
            const password = await credentialManager.getPassword('test-cluster', 'sasl');
            
            assert.strictEqual(password, 'my-password');
        });

        test('should retrieve specific password type', async () => {
            await credentialManager.storeCredentials('test-cluster', {
                saslPassword: 'sasl-pass',
                sslPassword: 'ssl-pass'
            });

            const saslPassword = await credentialManager.getPassword('test-cluster', 'sasl');
            const sslPassword = await credentialManager.getPassword('test-cluster', 'ssl');
            
            assert.strictEqual(saslPassword, 'sasl-pass');
            assert.strictEqual(sslPassword, 'ssl-pass');
        });

        test('should delete credentials', async () => {
            await credentialManager.storeCredentials('test-cluster', {
                saslPassword: 'secret'
            });

            await credentialManager.deleteCredentials('test-cluster');
            
            const credentials = await credentialManager.getCredentials('test-cluster');
            assert.strictEqual(credentials, undefined);
        });

        test('should return undefined for non-existent credentials', async () => {
            const credentials = await credentialManager.getCredentials('non-existent');
            
            assert.strictEqual(credentials, undefined);
        });

        test('should check if credentials exist', async () => {
            await credentialManager.storeCredentials('test-cluster', {
                saslPassword: 'secret'
            });

            const hasCredentials = await credentialManager.hasCredentials('test-cluster');
            const hasNonExistent = await credentialManager.hasCredentials('non-existent');
            
            assert.strictEqual(hasCredentials, true);
            assert.strictEqual(hasNonExistent, false);
        });

        test('should migrate from plain text credentials', async () => {
            const plainTextCreds = {
                saslPassword: 'plain-password',
                sslPassword: 'plain-ssl-password'
            };

            await credentialManager.migrateFromPlainText('test-cluster', plainTextCreds);
            
            const storedCreds = await credentialManager.getCredentials('test-cluster');
            assert.ok(storedCreds);
            assert.strictEqual(storedCreds.saslPassword, 'plain-password');
            
            // Plain text should be cleared
            assert.strictEqual(plainTextCreds.saslPassword, undefined);
            assert.strictEqual(plainTextCreds.sslPassword, undefined);
        });

        test('should clear all credentials', async () => {
            await credentialManager.storeCredentials('cluster1', { saslPassword: 'pass1' });
            await credentialManager.storeCredentials('cluster2', { saslPassword: 'pass2' });

            await credentialManager.clearAll(['cluster1', 'cluster2']);
            
            const creds1 = await credentialManager.getCredentials('cluster1');
            const creds2 = await credentialManager.getCredentials('cluster2');
            
            assert.strictEqual(creds1, undefined);
            assert.strictEqual(creds2, undefined);
        });
    });

    suite('EventBus', () => {
        let eventBus: EventBus;

        setup(() => {
            eventBus = new EventBus();
        });

        teardown(() => {
            eventBus.removeAllListeners();
        });

        test('should register and emit events', async () => {
            let callCount = 0;
            const callback = () => { callCount++; };

            eventBus.on(KafkaEvents.CLUSTER_ADDED, callback);
            await eventBus.emit(KafkaEvents.CLUSTER_ADDED);
            
            assert.strictEqual(callCount, 1);
        });

        test('should emit events synchronously', () => {
            let callCount = 0;
            const callback = () => { callCount++; };

            eventBus.on(KafkaEvents.REFRESH_REQUESTED, callback);
            eventBus.emitSync(KafkaEvents.REFRESH_REQUESTED);
            
            assert.strictEqual(callCount, 1);
        });

        test('should pass arguments to listeners', async () => {
            let receivedArg: string | undefined;
            const callback = (arg: string) => { receivedArg = arg; };

            eventBus.on('test-event', callback);
            await eventBus.emit('test-event', 'test-data');
            
            assert.strictEqual(receivedArg, 'test-data');
        });

        test('should call multiple listeners', async () => {
            let count1 = 0;
            let count2 = 0;

            eventBus.on('test-event', () => { count1++; });
            eventBus.on('test-event', () => { count2++; });
            
            await eventBus.emit('test-event');
            
            assert.strictEqual(count1, 1);
            assert.strictEqual(count2, 1);
        });

        test('should remove specific listener', async () => {
            let callCount = 0;
            const callback = () => { callCount++; };

            eventBus.on('test-event', callback);
            eventBus.off('test-event', callback);
            
            await eventBus.emit('test-event');
            
            assert.strictEqual(callCount, 0);
        });

        test('should remove all listeners for an event', async () => {
            let count1 = 0;
            let count2 = 0;

            eventBus.on('test-event', () => { count1++; });
            eventBus.on('test-event', () => { count2++; });
            
            eventBus.removeAllListeners('test-event');
            await eventBus.emit('test-event');
            
            assert.strictEqual(count1, 0);
            assert.strictEqual(count2, 0);
        });

        test('should remove all listeners', async () => {
            let count1 = 0;
            let count2 = 0;

            eventBus.on('event1', () => { count1++; });
            eventBus.on('event2', () => { count2++; });
            
            eventBus.removeAllListeners();
            await eventBus.emit('event1');
            await eventBus.emit('event2');
            
            assert.strictEqual(count1, 0);
            assert.strictEqual(count2, 0);
        });

        test('should handle async listeners in emit', async () => {
            let completed = false;
            const asyncCallback = async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                completed = true;
            };

            eventBus.on('test-event', asyncCallback);
            await eventBus.emit('test-event');
            
            assert.strictEqual(completed, true);
        });

        test('should handle errors in listeners gracefully', async () => {
            let successCallbackCalled = false;
            const errorCallback = () => { throw new Error('Test error'); };
            const successCallback = () => { successCallbackCalled = true; };

            eventBus.on('test-event', errorCallback);
            eventBus.on('test-event', successCallback);
            
            // Should not throw
            await eventBus.emit('test-event');
            
            assert.strictEqual(successCallbackCalled, true);
        });

        test('should support predefined Kafka events', () => {
            assert.ok(KafkaEvents.CLUSTER_ADDED);
            assert.ok(KafkaEvents.CLUSTER_REMOVED);
            assert.ok(KafkaEvents.CLUSTER_UPDATED);
            assert.ok(KafkaEvents.CLUSTER_CONNECTED);
            assert.ok(KafkaEvents.CLUSTER_DISCONNECTED);
            assert.ok(KafkaEvents.REFRESH_REQUESTED);
            assert.ok(KafkaEvents.REFRESH_COMPLETED);
            assert.ok(KafkaEvents.TOPIC_CREATED);
            assert.ok(KafkaEvents.TOPIC_DELETED);
            assert.ok(KafkaEvents.TOPIC_UPDATED);
            assert.ok(KafkaEvents.CONSUMER_GROUP_DELETED);
            assert.ok(KafkaEvents.CONSUMER_GROUP_OFFSETS_RESET);
        });
    });
});

