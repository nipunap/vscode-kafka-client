import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { Logger } from '../../infrastructure/Logger';

// Set test environment flag
process.env.NODE_ENV = 'test';

// Global test flag for Logger
(global as any).IS_TEST = true;

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        glob('**/*.test.js', { cwd: testsRoot }).then((files: string[]) => {
            // Add files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    // Global cleanup
                    Logger.clearLoggers();
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                // Cleanup even on error
                Logger.clearLoggers();
                console.error(err);
                reject(err);
            }
        }).catch((err: Error) => {
            return reject(err);
        });
    });
}
