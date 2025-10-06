import * as assert from 'assert';
import { validateBrokerAddress, validateBrokerList, sanitizeBrokerList } from '../../utils/validators';

suite('Validators Test Suite', () => {
    suite('validateBrokerAddress', () => {
        test('should accept valid hostname:port', () => {
            assert.strictEqual(validateBrokerAddress('localhost:9092'), undefined);
            assert.strictEqual(validateBrokerAddress('kafka.example.com:9092'), undefined);
            assert.strictEqual(validateBrokerAddress('my-kafka-broker:9092'), undefined);
        });

        test('should accept valid IPv4:port', () => {
            assert.strictEqual(validateBrokerAddress('127.0.0.1:9092'), undefined);
            assert.strictEqual(validateBrokerAddress('192.168.1.100:9092'), undefined);
            assert.strictEqual(validateBrokerAddress('10.0.0.1:9092'), undefined);
        });

        test('should accept valid IPv6:port', () => {
            assert.strictEqual(validateBrokerAddress('[::1]:9092'), undefined);
            assert.strictEqual(validateBrokerAddress('[2001:0db8:85a3:0000:0000:8a2e:0370:7334]:9092'), undefined);
        });

        test('should accept valid port range', () => {
            assert.strictEqual(validateBrokerAddress('localhost:1'), undefined);
            assert.strictEqual(validateBrokerAddress('localhost:9092'), undefined);
            assert.strictEqual(validateBrokerAddress('localhost:65535'), undefined);
        });

        test('should reject empty broker', () => {
            assert.ok(validateBrokerAddress(''));
            assert.ok(validateBrokerAddress('   '));
        });

        test('should reject broker without port', () => {
            const error = validateBrokerAddress('localhost');
            assert.ok(error);
            assert.ok(error.includes('host:port'));
        });

        test('should reject broker without host', () => {
            const error = validateBrokerAddress(':9092');
            assert.ok(error);
            assert.ok(error.includes('Host cannot be empty'));
        });

        test('should reject invalid port numbers', () => {
            assert.ok(validateBrokerAddress('localhost:0'));
            assert.ok(validateBrokerAddress('localhost:65536'));
            assert.ok(validateBrokerAddress('localhost:-1'));
            assert.ok(validateBrokerAddress('localhost:abc'));
            assert.ok(validateBrokerAddress('localhost:9092abc'));
        });

        test('should reject dangerous characters - CRLF injection', () => {
            assert.ok(validateBrokerAddress('localhost\r\n:9092'));
            assert.ok(validateBrokerAddress('localhost:9092\r\n'));
            assert.ok(validateBrokerAddress('\r\nlocalhost:9092'));
        });

        test('should reject dangerous characters - null bytes', () => {
            assert.ok(validateBrokerAddress('localhost\x00:9092'));
        });

        test('should reject dangerous characters - URL special chars', () => {
            assert.ok(validateBrokerAddress('evil.com@localhost:9092'));
            assert.ok(validateBrokerAddress('localhost:9092/path'));
            assert.ok(validateBrokerAddress('localhost:9092?query=value'));
            assert.ok(validateBrokerAddress('localhost:9092#fragment'));
        });

        test('should reject invalid hostnames', () => {
            assert.ok(validateBrokerAddress('-invalid:9092'));
            assert.ok(validateBrokerAddress('invalid-:9092'));
            assert.ok(validateBrokerAddress('inva..lid:9092'));
            assert.ok(validateBrokerAddress('inva lid:9092')); // space
        });

        test('should reject invalid IPv4', () => {
            assert.ok(validateBrokerAddress('256.0.0.1:9092'));
            assert.ok(validateBrokerAddress('1.2.3:9092'));
            assert.ok(validateBrokerAddress('1.2.3.4.5:9092'));
        });

        test('should reject multiple colons (except IPv6)', () => {
            assert.ok(validateBrokerAddress('localhost:9092:extra'));
        });
    });

    suite('validateBrokerList', () => {
        test('should accept valid broker list', () => {
            assert.strictEqual(validateBrokerList('localhost:9092'), undefined);
            assert.strictEqual(validateBrokerList('localhost:9092,localhost:9093'), undefined);
            assert.strictEqual(validateBrokerList('localhost:9092, localhost:9093, localhost:9094'), undefined);
        });

        test('should accept mixed valid brokers', () => {
            assert.strictEqual(validateBrokerList('localhost:9092,192.168.1.1:9092,[::1]:9092'), undefined);
        });

        test('should reject empty list', () => {
            assert.ok(validateBrokerList(''));
            assert.ok(validateBrokerList('   '));
            assert.ok(validateBrokerList(',,,'));
        });

        test('should reject list with invalid broker', () => {
            const error = validateBrokerList('localhost:9092,invalid,localhost:9093');
            assert.ok(error);
            assert.ok(error.includes('invalid'));
        });

        test('should reject list with malicious broker', () => {
            const error = validateBrokerList('localhost:9092,evil.com@localhost:9093');
            assert.ok(error);
            assert.ok(error.includes('@'));
        });
    });

    suite('sanitizeBrokerList', () => {
        test('should return array of valid brokers', () => {
            const brokers = sanitizeBrokerList('localhost:9092,localhost:9093');
            assert.deepStrictEqual(brokers, ['localhost:9092', 'localhost:9093']);
        });

        test('should trim whitespace', () => {
            const brokers = sanitizeBrokerList('  localhost:9092  ,  localhost:9093  ');
            assert.deepStrictEqual(brokers, ['localhost:9092', 'localhost:9093']);
        });

        test('should filter empty entries', () => {
            const brokers = sanitizeBrokerList('localhost:9092,,localhost:9093');
            assert.deepStrictEqual(brokers, ['localhost:9092', 'localhost:9093']);
        });

        test('should throw on invalid broker', () => {
            assert.throws(() => {
                sanitizeBrokerList('localhost:9092,invalid');
            }, /Invalid broker/);
        });

        test('should throw on malicious input', () => {
            assert.throws(() => {
                sanitizeBrokerList('evil.com@localhost:9092');
            }, /invalid characters/);
        });

        test('should throw on CRLF injection attempt', () => {
            assert.throws(() => {
                sanitizeBrokerList('localhost:9092\r\nmalicious:1234');
            }, /invalid characters/);
        });
    });

    suite('Security Tests - URL Injection', () => {
        test('should prevent URL injection with @ character', () => {
            // Attacker tries to connect to evil.com by putting it before @
            assert.ok(validateBrokerAddress('evil.com@localhost:9092'));
        });

        test('should prevent path traversal with /', () => {
            assert.ok(validateBrokerAddress('localhost:9092/../../etc/passwd'));
        });

        test('should prevent query string injection with ?', () => {
            assert.ok(validateBrokerAddress('localhost:9092?admin=true'));
        });

        test('should prevent fragment injection with #', () => {
            assert.ok(validateBrokerAddress('localhost:9092#admin'));
        });

        test('should prevent protocol-level attacks with CRLF', () => {
            // Attacker tries to inject protocol commands
            assert.ok(validateBrokerAddress('localhost:9092\r\nHost: evil.com'));
            assert.ok(validateBrokerAddress('localhost:9092\nmalicious-header: value'));
        });

        test('should prevent null byte injection', () => {
            // Attacker tries to truncate string processing
            assert.ok(validateBrokerAddress('localhost:9092\x00evil.com:1234'));
        });

        test('should prevent arbitrary hostname before legitimate one', () => {
            // As mentioned in the vulnerability report
            assert.ok(validateBrokerAddress('evil.com/localhost:9092'));
            assert.ok(validateBrokerAddress('evil.com?host=localhost:9092'));
        });

        test('should prevent arbitrary hostname after legitimate one', () => {
            // As mentioned in the vulnerability report
            assert.ok(validateBrokerAddress('localhost:9092/evil.com'));
            assert.ok(validateBrokerAddress('localhost:9092?redirect=evil.com'));
        });
    });
});
