# Kafka Client for VSCode

[![CI](https://github.com/nipunap/vscode-kafka-client/actions/workflows/ci.yml/badge.svg)](https://github.com/nipunap/vscode-kafka-client/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/nipunap/vscode-kafka-client?label=version)](https://github.com/nipunap/vscode-kafka-client/releases/latest)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/NipunaPerera.vscode-kafka-client?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=NipunaPerera.vscode-kafka-client)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/NipunaPerera.vscode-kafka-client)](https://marketplace.visualstudio.com/items?itemName=NipunaPerera.vscode-kafka-client)
[![Coverage](https://img.shields.io/badge/coverage-32.75%25-yellow.svg)](./coverage)
[![Tests](https://img.shields.io/badge/tests-187%20passing-brightgreen.svg)](./src/test)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

A comprehensive Kafka client extension for Visual Studio Code with full AWS MSK support, including IAM authentication and role assumption. View and manage Kafka clusters with enterprise-grade features including detailed configuration inspection, color-coded health monitoring, and complete broker visibility.

## ✨ Features

- 🔌 **Multiple Kafka Clusters** - Connect to Apache Kafka and AWS MSK clusters
- ☁️ **AWS MSK with IAM** - Full AWS MSK IAM authentication with automatic role assumption
- 🔐 **AWS Profile Management** - Select profiles with credential expiration tracking
- 🔍 **Auto-Discovery** - Automatically discover MSK clusters in your AWS account
- 📋 **Topic Management** - Create, delete, and browse topics with full configuration details
- 🖥️ **Broker Management** - View all brokers with detailed configuration settings
- 👥 **Consumer Groups** - View consumer groups with color-coded health status and lag information
- 📊 **Cluster Dashboard** - Interactive dashboard with metrics, statistics, and visual charts
- 📊 **Comprehensive Configuration Views** - See all settings like `kafka-configs.sh --describe`
- 🎨 **Visual Health Indicators** - Color-coded consumer group states (🟢 Active, 🟠 Empty, 🔴 Dead/Zombie)
- 🔒 **Enterprise Security** - Secure credential storage with VSCode SecretStorage
- 🔐 **Multiple Auth Methods** - SSL/TLS, SASL (PLAIN, SCRAM-SHA-256/512), and AWS IAM
- 📨 **Produce & Consume** - Send and receive messages with custom keys and values
- 🔍 **Smart Search** - Find topics, consumer groups, and brokers across clusters
- ⚡ **Performance** - Connection pooling and optimized data fetching
- 📝 **Structured Logging** - Configurable log levels with detailed diagnostic output

## 🎯 What's New

### Broker Management
View all brokers in your cluster with detailed configuration, similar to running `kafka-configs.sh --describe --entity-type brokers`. See dynamic configs, static configs, and defaults all in one place.

### Enhanced Configuration Views
Click any topic or broker to see comprehensive configuration details including:
- All settings grouped by configuration source
- Sensitive value indicators
- Read-only flags
- Default value indicators
- Configuration synonyms and inheritance

### Color-Coded Consumer Groups
Instantly see consumer group health:
- 🟢 **Green** icons for active groups with running consumers
- 🟠 **Orange** icons for empty groups (no active consumers)
- 🔴 **Red** icons for dead/zombie groups or groups in rebalancing

### Cluster Dashboard
Click any cluster to open an interactive dashboard with:
- 📊 **Real-time Metrics** - Cluster ID, controller, broker count, topic count, partition count
- 📈 **Visual Charts** - Partition distribution across brokers
- 📋 **Top Topics** - Ranked by partition count
- 🖥️ **Broker Details** - Host, port, rack information
- 🎯 **Consumer Groups** - Summary with state indicators
- ⚡ **Fast Loading** - Background data fetching with progress indicators

### Smart Search
Find any resource across all clusters with fuzzy matching and instant navigation.

### Enterprise Architecture
Built with production-grade patterns:
- **Structured Logging** - Configurable log levels (DEBUG, INFO, WARN, ERROR) with context-aware output
- **Centralized Error Handling** - Consistent error messages with actionable suggestions
- **Secure Credentials** - VSCode SecretStorage for sensitive data (passwords, tokens)
- **Connection Pooling** - Reuse connections for better performance
- **Event-Driven** - Decoupled components communicating via EventBus
- **Base Provider Pattern** - Consistent tree view behavior across all resources

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
- **View Details**: Click a topic to see comprehensive configuration:
  - Partition count, replication factor, and total messages
  - Per-partition offsets (earliest, latest, message count)
  - Per-partition leaders, replicas, and in-sync replicas (ISR)
  - **All topic configurations** grouped by source:
    - Dynamic Topic Config (set via kafka-configs.sh)
    - Dynamic Broker Config
    - Static Broker Config
    - Default Config
  - Configuration metadata (sensitive, read-only, source)
  - Similar to: `kafka-configs.sh --describe --entity-type topics --entity-name <topic>`
- **Search Topics**: Click search icon to find topics across clusters

### Working with Brokers

- **View Brokers**: Expand cluster in "Brokers" view
- **View Details**: Click a broker to see:
  - Node ID, host, port, and rack information
  - **All broker configurations** grouped by source:
    - Dynamic Broker Config
    - Dynamic Default Broker Config
    - Static Broker Config
    - Default Config
  - Configuration metadata (sensitive, read-only, default values)
  - Similar to: `kafka-configs.sh --describe --entity-type brokers --entity-name <broker-id>`
- **Search Brokers**: Click search icon to find brokers across clusters

### Working with Consumer Groups

- **View Groups**: Expand cluster in "Consumer Groups" view
- **Visual Health Status**: Consumer groups are color-coded:
  - 🟢 **Green** - Active/Stable groups with running consumers
  - 🟠 **Orange** - Empty groups with no active consumers
  - 🔴 **Red** - Dead/Zombie groups or groups rebalancing
- **View Details**: Click a group to see:
  - Group state (Stable, Empty, Dead, PreparingRebalance, etc.)
  - Member count and client assignments
  - Per-topic and per-partition offsets and lag
  - Lag status indicators (ok, minor, warning, critical)
  - Total lag across all partitions
- **Delete Group**: Right-click → "Delete Consumer Group"
- **Reset Offsets**: Right-click → "Reset Offsets" (⚠️ group must be empty)
- **Search Groups**: Click search icon to find consumer groups across clusters

### Cluster Dashboard

- **Open Dashboard**: Right-click cluster → "Show Cluster Dashboard" (or click cluster)
- **View Real-time Metrics**:
  - Cluster ID and controller information
  - Total broker, topic, and partition counts
- **Interactive Charts**:
  - Partition distribution visualization across brokers
- **Resource Tables**:
  - Top 10 topics by partition count
  - All brokers with host and port information
  - Consumer groups with state indicators
- **Background Loading**: Dashboard loads in the background with progress indicators
- **Refresh**: Click refresh icon to update all metrics

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
- Show Cluster Dashboard
- Create Topic
- Remove Cluster
- Refresh

**Topics:**
- Produce Message
- Consume Messages
- View Configuration Details (click)
- Delete Topic

**Brokers:**
- View Configuration Details (click)

**Consumer Groups:**
- View Details (click)
- Delete Consumer Group
- Reset Offsets

### Search & Find

All views include a search icon in the toolbar:
- **Find Topic** - Search topics across all clusters with fuzzy matching
- **Find Consumer Group** - Search consumer groups with state filtering
- **Find Broker** - Search brokers by ID or host

## 🔧 Configuration

### Cluster Configuration

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

**Note**: Passwords and other sensitive credentials are securely stored using VSCode's `SecretStorage` API and are never saved in plain text.

### Extension Settings

Customize the extension behavior in VSCode settings:

```json
{
  "kafka.logLevel": "info",                    // Logging level: debug, info, warn, error
  "kafka.connectionTimeout": 30000,            // Connection timeout in milliseconds (default: 30s)
  "kafka.requestTimeout": 30000,               // Request timeout in milliseconds (default: 30s)
  "kafka.connectionPoolMaxIdleTime": 300000    // Max idle time for pooled connections (default: 5min)
}
```

**Log Levels:**
- `debug` - Verbose logging for troubleshooting
- `info` - Normal operational messages (default)
- `warn` - Warnings and potential issues
- `error` - Error messages only

**Performance Tuning:**
- Increase `connectionTimeout` for slow networks
- Adjust `connectionPoolMaxIdleTime` to control connection lifecycle
- Use `debug` log level when troubleshooting connection issues

## 🐛 Troubleshooting

### Viewing Logs

The extension provides detailed logging to help diagnose issues:

1. **Open Output Panel**: View → Output (Ctrl+Shift+U / Cmd+Shift+U)
2. **Select Logger**: Choose "Kafka: [Component]" from the dropdown
   - `Kafka: KafkaClientManager` - Connection and data fetching
   - `Kafka: BrokerProvider` - Broker tree view
   - `Kafka: ConsumerGroupProvider` - Consumer group tree view
   - `Kafka: KafkaExplorerProvider` - Topic tree view
   - `Kafka: ErrorHandler` - Error handling and user notifications
   - `Kafka: ConnectionPool` - Connection lifecycle
   - `Kafka: CredentialManager` - Credential storage
   - `Kafka: EventBus` - Event dispatching
3. **Adjust Log Level**: Set `kafka.logLevel` to `debug` for verbose output
4. **View Errors**: Error messages include "Show Logs" button for quick access

### MSK IAM Authentication Fails

**Symptom**: "Could not load credentials from any providers"

**Solutions**:
1. Check `~/.aws/credentials` file exists and has the profile you selected
2. Verify credentials haven't expired (check `x_security_token_expires`)
3. Refresh credentials: `aws sso login --profile your-profile`
4. Check environment variables aren't conflicting (extension ignores them, but might cause confusion)
5. **Enable debug logging** to see credential loading details

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
vscode-kafka-client/
├── src/
│   ├── extension.ts                        # Extension entry point
│   ├── infrastructure/                     # Core infrastructure
│   │   ├── Logger.ts                       # Structured logging
│   │   ├── ErrorHandler.ts                 # Centralized error handling
│   │   ├── CredentialManager.ts            # Secure credential storage
│   │   ├── ConnectionPool.ts               # Connection pooling
│   │   └── EventBus.ts                     # Event-driven communication
│   ├── kafka/
│   │   ├── kafkaClientManager.ts           # Kafka client wrapper
│   │   └── mskIamAuthenticator.ts          # AWS MSK IAM auth
│   ├── providers/
│   │   ├── BaseProvider.ts                 # Base tree data provider
│   │   ├── kafkaExplorerProvider.ts        # Topics tree view
│   │   ├── consumerGroupProvider.ts        # Consumer groups tree view (color-coded)
│   │   └── brokerProvider.ts               # Brokers tree view
│   ├── commands/
│   │   ├── clusterCommands.ts              # Cluster operations
│   │   ├── topicCommands.ts                # Topic operations
│   │   ├── consumerGroupCommands.ts        # Consumer group operations
│   │   ├── brokerCommands.ts               # Broker operations
│   │   └── clusterDashboardCommands.ts     # Dashboard operations
│   ├── views/
│   │   └── clusterDashboardWebview.ts      # Interactive dashboard
│   ├── forms/
│   │   ├── clusterConnectionForm.ts        # Legacy input boxes
│   │   └── clusterConnectionWebview.ts     # New webview form
│   ├── utils/
│   │   ├── formatters.ts                   # YAML formatters for details views
│   │   └── validators.ts                   # Input validation and sanitization
│   └── test/                               # Unit and integration tests
├── resources/
│   ├── kafka-icon.svg                      # Extension icon
│   └── kafka-icon.png                      # Extension icon (PNG)
├── package.json                            # Extension manifest
└── tsconfig.json                           # TypeScript config
```

### Build Commands

```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run lint         # Run ESLint
npm test             # Run unit tests
npm run package      # Package extension (creates .vsix)
npm run publish      # Publish to VS Code Marketplace
```

### Testing

The extension includes comprehensive test coverage with **187 tests**:

```bash
npm test                    # Run all tests
npm run test:coverage       # Run tests with coverage
npm run test:coverage:report # Generate coverage report
```

**Test Structure:**
- `infrastructure.test.ts` - Logger, ErrorHandler, CredentialManager, EventBus
- `connectionPool.test.ts` - Connection pooling and lifecycle
- `baseProvider.test.ts` - Base tree data provider
- `kafkaClientManager.test.ts` - Core client operations
- `providers.test.ts` - Tree view providers
- `commands.test.ts` - Command handlers
- `formatters.test.ts` - YAML formatting utilities
- `validators.test.ts` - Input validation and security (32 security tests)
- `topicCommands.test.ts` - Topic-specific operations
- `consumerGroupCommands.test.ts` - Consumer group operations
- `brokerProvider.test.ts` - Broker provider functionality
- `brokerCommands.test.ts` - Broker commands

**Test Coverage (187 tests passing):**
| Category | Coverage |
|----------|----------|
| **Overall** | 32.75% |
| **Infrastructure** | 85.55% ⭐ |
| **Utilities** | 98.19% ⭐ |
| **Providers** | 60.27% |
| **Commands** | 55.95% |

**High Coverage Areas:**
- ✅ Kafka client integration
- ✅ AWS MSK IAM authentication
- ✅ Infrastructure components (Logger, ErrorHandler, CredentialManager, EventBus, ConnectionPool)
- ✅ Tree view providers (BaseProvider pattern)
- ✅ Command execution and error handling
- ✅ Data formatting and sanitization (98% coverage)
- ✅ Input validation and security checks (97% coverage, 32 security tests)
- ✅ Connection pooling and lifecycle (82% coverage)
- ✅ Event-driven architecture (89% coverage)

**Coverage Reports:**
- Text summary in console
- HTML report: `./coverage/index.html`
- LCOV format: `./coverage/lcov.info`

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
- **chart.js** - Interactive charts for dashboard

### Architecture Patterns

The extension is built using production-grade patterns:

- **Singleton Pattern** - Logger instances are singletons per component
- **Factory Pattern** - ConnectionPool creates and manages Kafka instances
- **Observer Pattern** - EventBus for decoupled event handling
- **Strategy Pattern** - Multiple authentication strategies (SASL, SSL, IAM)
- **Template Method** - BaseProvider defines common provider behavior
- **Dependency Injection** - Components receive dependencies via constructors
- **Secure by Default** - Credentials stored in VSCode SecretStorage
- **Structured Logging** - Context-aware logging with log levels

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

## 📋 Quick Reference

### Supported Operations

| Resource | View | Create | Delete | Configure | Search |
|----------|------|--------|--------|-----------|--------|
| **Clusters** | ✅ | ✅ | ✅ | ✅ | - |
| **Topics** | ✅ | ✅ | ✅ | ✅ (view only) | ✅ |
| **Brokers** | ✅ | - | - | ✅ (view only) | ✅ |
| **Consumer Groups** | ✅ | - | ✅ | ✅ (reset offsets) | ✅ |
| **Messages** | ✅ (consume) | ✅ (produce) | - | - | - |

### Supported Authentication Methods

| Method | Apache Kafka | AWS MSK |
|--------|--------------|---------|
| **PLAINTEXT** | ✅ | ✅ |
| **SSL/TLS** | ✅ | ✅ |
| **SASL/PLAIN** | ✅ | ✅ |
| **SASL/SCRAM-SHA-256** | ✅ | ✅ |
| **SASL/SCRAM-SHA-512** | ✅ | ✅ |
| **AWS IAM** | - | ✅ |
| **AWS Role Assumption** | - | ✅ |

### Configuration Sources Displayed

When viewing topic or broker configurations, you'll see settings from:
- **Dynamic Topic Config** - Topic-specific overrides set via kafka-configs.sh
- **Dynamic Broker Config** - Broker-level dynamic configs
- **Dynamic Default Broker Config** - Cluster-wide defaults
- **Static Broker Config** - Settings from server.properties
- **Default Config** - Built-in Kafka defaults

---

**Made with ❤️ for Kafka developers**
