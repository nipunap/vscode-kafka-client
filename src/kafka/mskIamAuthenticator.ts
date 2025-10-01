import { fromIni, fromEnv, fromProcess } from '@aws-sdk/credential-providers';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as ini from 'ini';

/**
 * AWS MSK IAM authentication provider for KafkaJS
 */
export class MSKIAMAuthenticator {
    private region: string;
    private profile?: string;
    private assumeRoleArn?: string;

    constructor(region: string, profile?: string, assumeRoleArn?: string) {
        this.region = region;
        this.profile = profile;
        this.assumeRoleArn = assumeRoleArn;
    }

    /**
     * Generate authentication token for AWS MSK IAM
     * NOTE: This is used for Kafka broker authentication (topics/consumer groups)
     * Role assumption is applied here if configured
     */
    async generateAuthToken(): Promise<{ username: string; password: string }> {
        try {
            // Get AWS credentials (with role assumption if configured)
            const credentials = await this.getAWSCredentials();

            // Create a fresh credential provider that explicitly uses our credentials
            const { fromTemporaryCredentials } = await import('@aws-sdk/credential-providers');

            // Create a credential provider that returns our exact credentials
            const credentialProvider = async () => ({
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                sessionToken: credentials.sessionToken,
                expiration: undefined
            });

            try {
                // Dynamically import the MSK IAM signer
                const { generateAuthToken } = await import('aws-msk-iam-sasl-signer-js');

                // Clear all AWS env vars to force library to fail and fallback
                const originalEnvVars = {
                    AWS_PROFILE: process.env.AWS_PROFILE,
                    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
                    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
                    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
                    AWS_SECURITY_TOKEN: process.env.AWS_SECURITY_TOKEN
                };

                // Clear all AWS environment variables
                delete process.env.AWS_PROFILE;
                delete process.env.AWS_ACCESS_KEY_ID;
                delete process.env.AWS_SECRET_ACCESS_KEY;
                delete process.env.AWS_SESSION_TOKEN;
                delete process.env.AWS_SECURITY_TOKEN;

                // Set only our credentials
                process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
                process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
                if (credentials.sessionToken) {
                    process.env.AWS_SESSION_TOKEN = credentials.sessionToken;
                }

                // Give the environment variables a moment to propagate
                await new Promise(resolve => setImmediate(resolve));

                // Generate the auth token
                const authTokenResponse = await generateAuthToken({
                    region: this.region
                });

                // Restore original environment variables
                for (const [key, value] of Object.entries(originalEnvVars)) {
                    if (value !== undefined) {
                        process.env[key] = value;
                    } else {
                        delete process.env[key];
                    }
                }

                // Return in the format KafkaJS expects for SASL/OAUTHBEARER
                return {
                    username: authTokenResponse.token,
                    password: authTokenResponse.token
                };
            } catch (error: any) {
                // Restore env vars even on error
                const originalEnvVars = {
                    AWS_PROFILE: process.env.AWS_PROFILE,
                    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
                    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
                    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN
                };
                throw error;
            }
        } catch (error: any) {
            const errorMsg = error?.message || error.toString();

            // Provide more specific error messages
            if (errorMsg.includes('expired') || errorMsg.includes('ExpiredToken')) {
                throw new Error(
                    `AWS credentials expired for profile "${this.profile}". ` +
                    `Please refresh your credentials (e.g., 'aws sso login --profile ${this.profile}') and reload VSCode.`
                );
            } else if (errorMsg.includes('AssumeRole')) {
                throw new Error(
                    `Failed to assume role "${this.assumeRoleArn}" using profile "${this.profile}". ` +
                    `Check: 1) You have sts:AssumeRole permission, 2) Role trust policy allows your account, 3) Credentials are valid.`
                );
            } else if (errorMsg.includes('not found') || errorMsg.includes('Profile')) {
                throw new Error(
                    `AWS profile "${this.profile}" not found in ~/.aws/credentials. ` +
                    `Available profiles can be checked with 'aws configure list-profiles'.`
                );
            } else {
                throw new Error(
                    `Failed to generate MSK IAM auth token: ${errorMsg}. ` +
                    `Profile: ${this.profile || 'default'}, Role: ${this.assumeRoleArn || 'none'}.`
                );
            }
        }
    }

    /**
     * Get AWS credentials from multiple sources
     * If assumeRoleArn is set, this will assume the role using base profile credentials
     * This is necessary for Kafka admin operations (topics/consumer groups)
     */
    private async getAWSCredentials(): Promise<{
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    }> {
        // If we need to assume a role for Kafka admin operations, do that first
        if (this.assumeRoleArn) {
            return await this.getAssumedRoleCredentials();
        }

        // 1. If a specific profile is specified, read credentials file directly
        // This bypasses AWS SDK's environment variable precedence
        if (this.profile) {
            const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');

            if (!fs.existsSync(credentialsPath)) {
                throw new Error(
                    `AWS credentials file not found at ${credentialsPath}. ` +
                    `Please run "aws configure" to set up credentials.`
                );
            }

            try {
                const credentialsContent = fs.readFileSync(credentialsPath, 'utf-8');
                const credentialsData = ini.parse(credentialsContent);

                if (!credentialsData[this.profile]) {
                    throw new Error(
                        `Profile "${this.profile}" not found in ${credentialsPath}. ` +
                        `Available profiles: ${Object.keys(credentialsData).join(', ')}`
                    );
                }

                const profileData = credentialsData[this.profile];

                if (!profileData.aws_access_key_id || !profileData.aws_secret_access_key) {
                    throw new Error(
                        `Profile "${this.profile}" exists but is missing credentials. ` +
                        `Please ensure it has aws_access_key_id and aws_secret_access_key.`
                    );
                }

                return {
                    accessKeyId: profileData.aws_access_key_id,
                    secretAccessKey: profileData.aws_secret_access_key,
                    sessionToken: profileData.aws_session_token || profileData.aws_security_token
                };
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    throw new Error(`Could not read ${credentialsPath}: File not found`);
                }
                throw error;
            }
        }

        // 2. If no profile specified, use AWS SDK credential chain
        const credentialProviders = [];
        {
            // 2. Environment variables
            try {
                const envCreds = await fromEnv()();
                if (envCreds && envCreds.accessKeyId && envCreds.secretAccessKey) {
                    return {
                        accessKeyId: envCreds.accessKeyId,
                        secretAccessKey: envCreds.secretAccessKey,
                        sessionToken: envCreds.sessionToken
                    };
                }
            } catch (error) {
                // Try next provider
            }

            // 3. Default profile from shared credentials file
            try {
                const iniCreds = await fromIni({
                    filepath: path.join(os.homedir(), '.aws', 'credentials'),
                    configFilepath: path.join(os.homedir(), '.aws', 'config')
                })();
                if (iniCreds && iniCreds.accessKeyId && iniCreds.secretAccessKey) {
                    return {
                        accessKeyId: iniCreds.accessKeyId,
                        secretAccessKey: iniCreds.secretAccessKey,
                        sessionToken: iniCreds.sessionToken
                    };
                }
            } catch (error) {
                // Try next provider
            }

            // 4. Process credentials (from credential_process in config)
            try {
                const processCreds = await fromProcess()();
                if (processCreds && processCreds.accessKeyId && processCreds.secretAccessKey) {
                    return {
                        accessKeyId: processCreds.accessKeyId,
                        secretAccessKey: processCreds.secretAccessKey,
                        sessionToken: processCreds.sessionToken
                    };
                }
            } catch (error) {
                // Try next provider
            }
        }

        // If all providers failed, throw a helpful error
        const profileInfo = this.profile ? ` for profile "${this.profile}"` : '';
        throw new Error(
            `Could not load AWS credentials${profileInfo}. Please configure credentials using one of:\n` +
            '1. Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY\n' +
            '2. Shared credentials file: ~/.aws/credentials\n' +
            '3. AWS CLI: run "aws configure"'
        );
    }

    /**
     * Assume an IAM role and get temporary credentials
     */
    private async getAssumedRoleCredentials(): Promise<{
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    }> {
        try {
            const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');

            // Get base credentials - read directly from file if profile is specified
            let baseCredentials;

            if (this.profile) {
                const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');

                if (!fs.existsSync(credentialsPath)) {
                    throw new Error(`AWS credentials file not found at ${credentialsPath}`);
                }

                const credentialsContent = fs.readFileSync(credentialsPath, 'utf-8');
                const credentialsData = ini.parse(credentialsContent);

                if (!credentialsData[this.profile]) {
                    throw new Error(`Profile "${this.profile}" not found in credentials file`);
                }

                const profileData = credentialsData[this.profile];

                if (!profileData.aws_access_key_id || !profileData.aws_secret_access_key) {
                    throw new Error(`Profile "${this.profile}" is missing credentials`);
                }

                baseCredentials = {
                    accessKeyId: profileData.aws_access_key_id,
                    secretAccessKey: profileData.aws_secret_access_key,
                    sessionToken: profileData.aws_session_token || profileData.aws_security_token
                };
            } else {
                // Fallback to environment variables
                const envProvider = fromEnv();
                baseCredentials = await envProvider();
            }

            // Create STS client with explicit credentials (ignore env vars)
            const stsClient = new STSClient({
                region: this.region,
                credentials: baseCredentials
            });

            // Assume the role
            const response = await stsClient.send(new AssumeRoleCommand({
                RoleArn: this.assumeRoleArn,
                RoleSessionName: 'vscode-kafka-msk-iam',
                DurationSeconds: 3600 // 1 hour
            }));

            if (!response.Credentials) {
                throw new Error('No credentials returned from AssumeRole');
            }

            return {
                accessKeyId: response.Credentials.AccessKeyId!,
                secretAccessKey: response.Credentials.SecretAccessKey!,
                sessionToken: response.Credentials.SessionToken
            };
        } catch (error: any) {
            const errorMsg = error?.message || error.toString();

            if (errorMsg.includes('expired') || errorMsg.includes('ExpiredToken')) {
                throw new Error(
                    `Credentials for profile "${this.profile}" have expired. ` +
                    `Please refresh: aws sso login --profile ${this.profile || 'default'}`
                );
            } else if (errorMsg.includes('AccessDenied')) {
                throw new Error(
                    `Access denied when assuming role ${this.assumeRoleArn}. ` +
                    `Check: 1) Profile "${this.profile}" has sts:AssumeRole permission, 2) Role trust policy allows your account.`
                );
            } else {
                throw new Error(
                    `Failed to assume role ${this.assumeRoleArn}: ${errorMsg}. ` +
                    `Profile: "${this.profile}". Check credentials and permissions.`
                );
            }
        }
    }

    /**
     * Create an async function that returns the auth token
     * This is used by KafkaJS SASL OAUTHBEARER mechanism
     */
    async authenticate(): Promise<{ username: string; password: string }> {
        return this.generateAuthToken();
    }
}

/**
 * Create a KafkaJS-compatible SASL mechanism for AWS MSK IAM
 */
export function createMSKIAMAuthMechanism(region: string, profile?: string, assumeRoleArn?: string) {
    const authenticator = new MSKIAMAuthenticator(region, profile, assumeRoleArn);

    return {
        mechanism: 'oauthbearer',
        oauthBearerProvider: async () => {
            const { username, password } = await authenticator.generateAuthToken();
            return {
                value: password // The token is used as the value in OAUTHBEARER
            };
        }
    };
}
