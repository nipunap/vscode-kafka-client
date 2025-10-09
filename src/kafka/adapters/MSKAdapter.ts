import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ini from 'ini';
import { fromIni, fromEnv } from '@aws-sdk/credential-providers';
import { Logger } from '../../infrastructure/Logger';

/**
 * Adapter for AWS MSK-specific operations
 * Handles fetching bootstrap brokers from AWS MSK
 */
export class MSKAdapter {
    private logger = Logger.getLogger('MSKAdapter');

    /**
     * Get bootstrap brokers from AWS MSK cluster
     */
    async getBootstrapBrokers(
        region: string,
        clusterArn: string,
        authMethod?: string,
        awsProfile?: string
    ): Promise<string[]> {
        try {
            const { KafkaClient, GetBootstrapBrokersCommand } = require('@aws-sdk/client-kafka');

            const credentials = await this.getCredentials(awsProfile);

            if (!credentials || !credentials.accessKeyId) {
                throw new Error(
                    'Failed to load AWS credentials. Please ensure credentials are configured in ~/.aws/credentials'
                );
            }

            const client = new KafkaClient({
                region,
                credentials
            });

            const response: any = await client.send(new GetBootstrapBrokersCommand({
                ClusterArn: clusterArn
            }));

            const brokerString = this.selectBrokerString(response, authMethod);

            if (!brokerString) {
                throw new Error('No bootstrap brokers available for this authentication method');
            }

            const brokers = brokerString.split(',');
            this.logger.info(`Retrieved ${brokers.length} MSK brokers for cluster ${clusterArn}`);
            
            return brokers;
        } catch (error: any) {
            this.logger.error('Failed to get MSK bootstrap brokers', error);
            
            const errorMsg = error?.message || error.toString();

            if (errorMsg.includes('expired') || errorMsg.includes('ExpiredToken')) {
                throw new Error(
                    'AWS credentials expired. Please refresh your credentials and try again.'
                );
            } else if (errorMsg.includes('AccessDenied')) {
                throw new Error(
                    'Access denied when fetching MSK brokers. Check that your AWS profile has kafka:GetBootstrapBrokers permission.'
                );
            } else {
                throw new Error('Failed to get MSK brokers. Please verify your AWS credentials and cluster ARN.');
            }
        }
    }

    /**
     * Get AWS credentials from profile or environment
     */
    private async getCredentials(awsProfile?: string): Promise<any> {
        // If a specific profile is provided, read directly from credentials file
        if (awsProfile) {
            const credentials = await this.getCredentialsFromProfile(awsProfile);
            if (credentials) {
                return credentials;
            }
        }

        // Fallback to environment variables or default profile
        return await this.getCredentialsFromEnvironment();
    }

    /**
     * Read credentials from AWS credentials file
     */
    private async getCredentialsFromProfile(profileName: string): Promise<any | undefined> {
        try {
            const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');
            const credentialsContent = await fs.readFile(credentialsPath, 'utf-8');
            const credentialsData = ini.parse(credentialsContent);

            if (credentialsData[profileName]) {
                const profileData = credentialsData[profileName];
                return {
                    accessKeyId: profileData.aws_access_key_id,
                    secretAccessKey: profileData.aws_secret_access_key,
                    sessionToken: profileData.aws_session_token || profileData.aws_security_token
                };
            } else {
                throw new Error('Profile not found in credentials file');
            }
        } catch (error: any) {
            this.logger.error(`Failed to read AWS credentials file for profile ${profileName}`, error);
            return undefined;
        }
    }

    /**
     * Get credentials from environment or default profile
     */
    private async getCredentialsFromEnvironment(): Promise<any> {
        const credentialProviders = [];
        credentialProviders.push(fromEnv());
        credentialProviders.push(
            fromIni({
                filepath: path.join(os.homedir(), '.aws', 'credentials'),
                configFilepath: path.join(os.homedir(), '.aws', 'config')
            })
        );

        for (const provider of credentialProviders) {
            try {
                const credentials = await provider();
                if (credentials && credentials.accessKeyId) {
                    return credentials;
                }
            } catch (_error) {
                continue;
            }
        }

        return undefined;
    }

    /**
     * Select appropriate broker string based on auth method
     */
    private selectBrokerString(response: any, authMethod?: string): string | undefined {
        if (authMethod === 'AWS_MSK_IAM' && response.BootstrapBrokerStringSaslIam) {
            return response.BootstrapBrokerStringSaslIam;
        } else if (authMethod?.includes('SCRAM') && response.BootstrapBrokerStringSaslScram) {
            return response.BootstrapBrokerStringSaslScram;
        } else if (response.BootstrapBrokerStringTls) {
            return response.BootstrapBrokerStringTls;
        } else if (response.BootstrapBrokerString) {
            return response.BootstrapBrokerString;
        }
        return undefined;
    }
}

