# Kafka Client for VSCode

[![CI](https://github.com/nipunap/vscode-kafka-client/actions/workflows/ci.yml/badge.svg)](https://github.com/nipunap/vscode-kafka-client/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/nipunap/vscode-kafka-client?label=version)](https://github.com/nipunap/vscode-kafka-client/releases/latest)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/NipunaPerera.vscode-kafka-client?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=NipunaPerera.vscode-kafka-client)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/NipunaPerera.vscode-kafka-client)](https://marketplace.visualstudio.com/items?itemName=NipunaPerera.vscode-kafka-client)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

A comprehensive Kafka client extension for Visual Studio Code with full AWS MSK support, including IAM authentication and role assumption.

## ✨ Features

- 🔌 **Multiple Kafka Clusters** - Connect to Apache Kafka and AWS MSK clusters
- ☁️ **AWS MSK with IAM** - Full AWS MSK IAM authentication with automatic role assumption
- 🔐 **AWS Profile Management** - Select profiles with credential expiration tracking
- 🔍 **Auto-Discovery** - Automatically discover MSK clusters in your AWS account
- 📋 **Topic Management** - Create, delete, and browse topics
- 👥 **Consumer Groups** - View consumer groups with lag and offset information
- 📊 **Detailed Views** - Click resources to see comprehensive metadata in YAML format
- 🔒 **Enterprise Security** - Support for SSL/TLS, SASL (PLAIN, SCRAM-SHA-256/512), and AWS IAM
- 📨 **Produce & Consume** - Send and receive messages with custom keys and values

## 📦 Installation

### From VSIX (Recommended)

1. Download the `.vsix` file from releases
2. In VSCode: `Extensions` → `⋯` → `Install from VSIX...`
3. Select the downloaded file

### From Source

```bash
git clone https://github.com/nipunap/vscode-kafka-client.git
cd vscode-kafka
npm install
npm run compile
```

Press `F5` in VSCode to launch the Extension Development Host.

## 🚀 Quick Start

### Adding an Apache Kafka Cluster

1. Click the Kafka icon in the Activity Bar (sidebar)
2. Click the **"+"** button
3. Fill in the connection form:
   - **Cluster Type**: Apache Kafka
   - **Connection Name**: my-kafka-cluster
   - **Bootstrap Servers**: `localhost:9092` (comma-separated)
   - **Security Protocol**: Choose PLAINTEXT, SSL, SASL_PLAINTEXT, or SASL_SSL
   - Configure SSL/SASL if needed (certificates, username/password)
4. Click **Connect**

### Adding an AWS MSK Cluster

#### Prerequisites
- AWS credentials configured in `~/.aws/credentials`
- IAM permissions: `kafka:ListClusters`, `kafka:GetBootstrapBrokers`
- For Kafka operations: Role with Kafka admin permissions

#### Steps

1. Click the **"+"** button in the Clusters view
2. Fill in the form that opens in a new tab:
   - **Cluster Type**: AWS MSK
   - **Connection Name**: production-kafka
   - **Authentication Method**: IAM (recommended)

3. **Select AWS Profile**:
   - Choose from your `~/.aws/credentials` profiles
   - View credential status:
     - 🟢 **Active** - Permanent or valid credentials
     - 🟡 **42h 15m left** - Temporary credentials expiring soon
     - 🔴 **15m left** - About to expire
     - 🔴 **Expired** - Need to refresh

4. **Role Assumption** (optional):
   - Enable "Assume IAM Role" if you need elevated permissions
   - Enter role ARN: `arn:aws:iam::123456789012:role/KafkaAdminRole`
   - This is common when your base profile can list clusters but needs a different role for Kafka operations

5. **Select Region**: Choose your AWS region (e.g., us-east-1)

6. **Discover Clusters**:
   - Click **"Discover Clusters"** button
   - Extension scans AWS and shows all MSK clusters
   - Select your cluster from the list (or enter ARN manually)

7. Click **Connect** - Done! 🎉

## 🔐 AWS MSK IAM Authentication

### How It Works

AWS MSK with IAM uses a two-level authentication model:

1. **AWS API Access** (Listing clusters, getting brokers)
   - Uses your **base AWS profile** credentials
   - No role assumption needed
   - Requires: `kafka:ListClusters`, `kafka:GetBootstrapBrokers`

2. **Kafka Broker Access** (Topics, consumer groups, messages)
   - Uses **assumed role** credentials (if configured)
   - Required for actual Kafka operations
   - Requires: Kafka admin permissions on the cluster

### AWS Credentials Setup

The extension reads directly from `~/.aws/credentials` and ignores environment variables to avoid conflicts:

```ini
# ~/.aws/credentials

[default]
aws_access_key_id = AKIA...
aws_secret_access_key = ...

[production]
aws_access_key_id = ASIA...
aws_secret_access_key = ...
aws_session_token = ...
x_security_token_expires = 2025-10-01T15:30:00Z

[dev]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
```

### Role Assumption Example

Common scenario: Your user account can list MSK clusters but needs to assume a role for Kafka operations:

```
1. Base Profile: "my-account"
   ├─ Can: kafka:ListClusters
   ├─ Can: kafka:GetBootstrapBrokers
   └─ Cannot: Kafka admin operations

2. Assume Role: "arn:aws:iam::123456789012:role/KafkaAdmin"
   ├─ Gets: Temporary credentials
   └─ Can: All Kafka operations (topics, consumer groups, produce/consume)
```

The extension handles this automatically:
- Lists clusters with your base profile
- Assumes the role for Kafka operations
- Manages credential lifecycle and token refresh

### IAM Policy Requirements

**For AWS API access** (base profile):
```json
{
  "Effect": "Allow",
  "Action": [
    "kafka:ListClusters",
    "kafka:ListClustersV2",
    "kafka:GetBootstrapBrokers"
  ],
  "Resource": "*"
}
```

**For Kafka operations** (assumed role or base profile):
```json
{
  "Effect": "Allow",
  "Action": [
    "kafka-cluster:Connect",
    "kafka-cluster:DescribeCluster",
    "kafka-cluster:*Topic*",
    "kafka-cluster:*Group*",
    "kafka-cluster:ReadData",
    "kafka-cluster:WriteData"
  ],
  "Resource": [
    "arn:aws:kafka:region:account:cluster/*",
    "arn:aws:kafka:region:account:topic/*/*",
    "arn:aws:kafka:region:account:group/*/*"
  ]
}
```

**For role assumption** (base profile):
```json
{
  "Effect": "Allow",
  "Action": "sts:AssumeRole",
  "Resource": "arn:aws:iam::account:role/KafkaAdminRole"
}
```

## 📚 Usage

### Working with Topics

- **Create Topic**: Right-click cluster → "Create Topic"
- **Delete Topic**: Right-click topic → "Delete Topic" (⚠️ requires confirmation)
- **View Details**: Double-click a topic to see:
  - Partition count and replication factor
  - Per-partition offsets (earliest, latest, message count)
  - Topic configuration (compression, retention, etc.)

### Working with Consumer Groups

- **View Groups**: Expand cluster in "Consumer Groups" view
- **View Details**: Double-click a group to see:
  - Group state (Stable, Empty, Dead)
  - Member count and assignments
  - Per-partition offsets and lag
- **Delete Group**: Right-click → "Delete Consumer Group"
- **Reset Offsets**: Right-click → "Reset Offsets" (⚠️ group must be empty)

### Producing Messages

1. Right-click topic → "Produce Message"
2. Enter optional key (for partitioning)
3. Enter message value (JSON, text, etc.)
4. Message is sent to the topic

### Consuming Messages

1. Right-click topic → "Consume Messages"
2. Choose:
   - **From Beginning**: Read from earliest offset
   - **From Latest**: Read from latest offset
3. Specify message count (default: 10)
4. Messages appear in a new editor tab

### Context Menu Actions

**Clusters:**
- Create Topic
- Refresh

**Topics:**
- Produce Message
- Consume Messages
- View Details (double-click)
- Delete Topic

**Consumer Groups:**
- View Details (double-click)
- Delete Consumer Group
- Reset Offsets

## 🔧 Configuration

Clusters are saved in VSCode settings (`kafka.clusters`). You can view/edit them:

```json
{
  "kafka.clusters": [
    {
      "name": "local-kafka",
      "type": "kafka",
      "brokers": ["localhost:9092"],
      "securityProtocol": "PLAINTEXT"
    },
    {
      "name": "production-msk",
      "type": "msk",
      "region": "us-east-1",
      "clusterArn": "arn:aws:kafka:us-east-1:...",
      "awsProfile": "production",
      "assumeRoleArn": "arn:aws:iam::123456789012:role/KafkaAdmin",
      "securityProtocol": "SASL_SSL",
      "saslMechanism": "AWS_MSK_IAM"
    }
  ]
}
```

**Note**: Passwords and temporary credentials are **never saved** for security.

## 🐛 Troubleshooting

### MSK IAM Authentication Fails

**Symptom**: "Could not load credentials from any providers"

**Solutions**:
1. Check `~/.aws/credentials` file exists and has the profile you selected
2. Verify credentials haven't expired (check `x_security_token_expires`)
3. Refresh credentials: `aws sso login --profile your-profile`
4. Check environment variables aren't conflicting (extension ignores them, but might cause confusion)

### Empty Brokers Array

**Symptom**: "Failed to connect: brokers array is empty"

**Causes**:
- AWS profile doesn't have `kafka:GetBootstrapBrokers` permission
- Cluster ARN is incorrect
- Credentials expired

**Solution**: Verify IAM permissions and cluster ARN

### Consumer Group Operations Fail

**Symptom**: Can see consumer groups but can't delete/reset offsets

**Cause**: Base profile has read-only access, needs admin role

**Solution**: Configure role assumption with appropriate Kafka admin permissions

### Temporary Credentials Expired

**Symptom**: Extension worked before but now fails

**Solution**: Refresh your AWS credentials
```bash
# For AWS SSO
aws sso login --profile your-profile

# For assumed roles
# Re-run your credential fetching process

# Reload VSCode after refreshing
```

## 💻 Development

### Project Structure

```
vscode-kafka/
├── src/
│   ├── extension.ts                    # Extension entry point
│   ├── kafka/
│   │   ├── kafkaClientManager.ts       # Kafka client wrapper
│   │   └── mskIamAuthenticator.ts      # AWS MSK IAM auth
│   ├── providers/
│   │   ├── kafkaExplorerProvider.ts    # Topics tree view
│   │   └── consumerGroupProvider.ts    # Consumer groups tree view
│   ├── forms/
│   │   ├── clusterConnectionForm.ts    # Legacy input boxes
│   │   └── clusterConnectionWebview.ts # New webview form
│   └── ...
├── resources/
│   └── kafka-icon.svg                  # Extension icon
├── package.json                        # Extension manifest
└── tsconfig.json                       # TypeScript config
```

### Build Commands

```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run lint         # Run ESLint
npm run package      # Package extension (creates .vsix)
npm run publish      # Publish to VS Code Marketplace
```

### Publishing

The project includes automated scripts for packaging and publishing:

```bash
# Package extension
npm run package      # Creates .vsix with validation

# Publish to marketplace
npm run publish      # Interactive publishing wizard
```

See `scripts/README.md` for detailed publishing instructions.

### Key Dependencies

- **kafkajs** - Kafka client library
- **@aws-sdk/client-kafka** - AWS MSK API
- **@aws-sdk/client-sts** - AWS role assumption
- **@aws-sdk/credential-providers** - AWS credential loading
- **aws-msk-iam-sasl-signer-js** - MSK IAM token generation
- **ini** - Parse AWS credentials files

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure all tests pass (`npm run lint` and `npm run compile`)
5. **Use conventional commits** (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation:

- `feat:` - New feature (minor version bump)
- `fix:` - Bug fix (patch version bump)  
- `feat!:` or `BREAKING CHANGE:` - Breaking change (major version bump)
- `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:` - Other changes

**Examples:**
```bash
git commit -m "feat: add SASL authentication support"
git commit -m "fix: resolve connection timeout issue"
git commit -m "feat!: redesign configuration API"
```

### CI/CD

All pull requests must pass automated checks before merging:
- ✅ Linting (ESLint)
- ✅ TypeScript compilation
- ✅ Package validation
- ✅ Multi-OS testing (Ubuntu, Windows, macOS)
- ✅ Multi-Node testing (Node 18.x, 20.x)

### Automated Releases

When your PR is merged to `main`:
- 🤖 Version is automatically bumped based on commit types
- 📝 CHANGELOG.md is automatically generated
- 🏷️ Git tag is created
- 📦 GitHub Release is published
- 🚀 (Optional) Extension is published to marketplace

## 📄 License

See LICENSE file for details

## 🔗 Related Projects

- [kafkajs](https://kafka.js.org/) - Kafka client library
- [AWS MSK](https://aws.amazon.com/msk/) - Managed Kafka service

---

**Made with ❤️ for Kafka developers**
