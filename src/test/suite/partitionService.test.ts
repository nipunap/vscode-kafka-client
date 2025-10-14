import * as assert from 'assert';
import { PartitionService } from '../../services/PartitionService';

suite('PartitionService Test Suite', () => {
    let service: PartitionService;

    setup(() => {
        service = new PartitionService();
    });

    suite('validatePartitionCount', () => {
        test('should throw error if new count is less than current count', () => {
            assert.throws(
                () => service.validatePartitionCount(5, 3),
                /must be greater than current count/
            );
        });

        test('should throw error if new count equals current count', () => {
            assert.throws(
                () => service.validatePartitionCount(5, 5),
                /must be greater than current count/
            );
        });

        test('should throw error if new count exceeds maximum', () => {
            assert.throws(
                () => service.validatePartitionCount(5, 10001),
                /exceeds recommended maximum/
            );
        });

        test('should not throw error for valid partition count', () => {
            assert.doesNotThrow(() => service.validatePartitionCount(5, 10));
        });

        test('should allow partition count up to 10000', () => {
            assert.doesNotThrow(() => service.validatePartitionCount(5, 10000));
        });
    });
});
