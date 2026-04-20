# CLAUDE.md - VS Code Kafka Client

## What This Is

A VS Code extension providing a full Kafka client with AWS MSK support, IAM authentication, schema registry integration, and tree-based cluster browsing. Published to both VS Code Marketplace and Open VSX.

## Quick Commands

```bash
npm run compile          # TypeScript → out/
npm run compile:strict   # Same + unused vars/params check (runs in pretest)
npm run lint             # ESLint (flat config, eslint.config.js)
npm run test             # Full test suite (launches VS Code test host)
npm run test:unit        # Mocha-only unit tests (no VS Code host)
npm run bundle           # Production esbuild → dist/extension.js (minified)
npm run package          # Creates .vsix from dist/ bundle
npm run watch            # Parallel tsc + esbuild watch
```

## Architecture

```
src/
├── extension.ts              # Entry point: activation, command registration, cleanup
├── commands/                 # Command handlers grouped by domain
│   ├── commandRegistry.ts    # Metadata-driven registration (CommandDefinition[])
│   ├── commandDefinitions.ts # Central list of all 50+ commands
│   ├── topicCommands.ts      # Topic CRUD, produce, consume, dashboard
│   ├── consumerGroupCommands.ts
│   ├── brokerCommands.ts
│   ├── aclCommands.ts
│   ├── clusterCommands.ts
│   └── ...
├── kafka/
│   ├── kafkaClientManager.ts # Central facade: connections, pooling, delegation to services
│   ├── mskIamAuthenticator.ts # AWS IAM token generation with 14-min caching
│   └── adapters/MSKAdapter.ts # AWS SDK: bootstrap broker discovery from cluster ARN
├── services/                 # Pure domain logic (no UI deps, fully testable)
│   ├── TopicService.ts
│   ├── ConsumerGroupService.ts
│   ├── BrokerService.ts
│   ├── ProducerService.ts
│   ├── PartitionService.ts
│   ├── SchemaRegistryService.ts # Confluent + AWS Glue schema support
│   ├── LagMonitor.ts           # Polling-based consumer lag alerts
│   └── ...
├── providers/                # VS Code TreeDataProvider implementations
│   ├── BaseProvider.ts       # Abstract base with error isolation
│   ├── kafkaExplorerProvider.ts # Clusters → Topics → Partitions tree
│   ├── consumerGroupProvider.ts
│   ├── brokerProvider.ts
│   └── ...
├── views/                    # Webview panels (HTML-based detail views)
│   ├── BaseWebview.ts        # Abstract: panel lifecycle, messaging, CSP
│   ├── DetailsWebview.ts     # Generic details (topics, groups, brokers, ACLs)
│   ├── MessageConsumerWebview.ts
│   ├── MessageProducerWebview.ts
│   └── WebviewManager.ts     # Singleton: prevents duplicates, tracks resources
├── infrastructure/
│   ├── Logger.ts             # Per-component loggers, auto-redacts credentials
│   ├── CredentialManager.ts  # VS Code SecretStorage wrapper (OS keychain)
│   ├── EventBus.ts           # Pub/sub for decoupling commands ↔ providers
│   ├── ErrorHandler.ts       # Classifies errors, shows user-friendly messages
│   ├── ConnectionPool.ts     # Reuses Admin/Producer; 5-min idle timeout
│   ├── ConfigurationService.ts # Persists cluster metadata to VS Code settings
│   └── AuditLog.ts           # Operation tracking (no PII)
├── types/                    # TypeScript interfaces (nodes.ts, acl.ts)
├── utils/                    # Formatters, validators, error classifiers
├── forms/                    # Multi-step input wizards (cluster connection)
└── data/                     # fieldDescriptions.json (Kafka concept tooltips)
```

### Key Data Flow

- **Operations:** Command → KafkaClientManager → Service → KafkaJS Admin/Producer/Consumer
- **UI refresh:** Command → EventBus.emit → TreeProvider.refresh → getChildren
- **Credentials:** CredentialManager (SecretStorage) → KafkaClientManager → KafkaJS/AWS SDK

### Connection Management

`KafkaClientManager` caches Admin/Producer per cluster with 5-min health checks. Auth: PLAINTEXT, SSL, SASL (PLAIN, SCRAM-SHA-256/512, AWS MSK IAM). MSK IAM tokens cached 14 min (15 min expiry).

## Testing

- **Framework:** Mocha (TDD UI) + Sinon stubs. Timeout: 10s.
- **45 test files** in `src/test/suite/`. Unit tests mock at service boundary. Integration tests (e.g. `*.integration.test.ts`) mock only the KafkaJS `Admin` object.
- **Pattern:** Command-layer tests stub the manager. Manager-layer tests stub the KafkaJS admin. See `partitionService.integration.test.ts` for the canonical integration test pattern.
- **Coverage:** `npm run test:coverage` (c8). Thresholds: 30% lines, 50% functions, 70% branches.

## CI/CD

- **ci.yml:** Build + test matrix (ubuntu/windows/macos x Node 18/20), lint, dependency review, VSIX packaging.
- **auto-version-pr.yml:** Conventional commits on PR → auto semver bump + CHANGELOG update.
- **publish-release.yml:** On main push with version change → build → GitHub Release → publish to VS Code Marketplace + Open VSX.
- **codeql.yml:** Weekly security scan.

## Conventions

- **Commits:** Conventional commits (`feat:`, `fix:`, `chore:`, etc.). Breaking changes: `feat!:` or `fix!:`.
- **Naming:** PascalCase classes, camelCase functions, UPPER_SNAKE_CASE constants/events.
- **Error handling:** Services throw; commands catch via `ErrorHandler.wrap()`. Providers isolate errors in `getChildrenSafely()`.
- **Logging:** `private logger = Logger.getLogger('ClassName')`. Credentials auto-redacted.
- **Imports:** vscode first, then external packages, then relative. No barrel exports.
- **`any` types:** Allowed by ESLint config (`@typescript-eslint/no-explicit-any: off`), gradually being reduced.
- **Build outputs:** `out/` for dev/testing, `dist/` for production bundle. Entry point: `out/extension.js`.

## Dependencies Worth Knowing

- `kafkajs` (^2.2.4) — Core Kafka client
- `@aws-sdk/client-kafka`, `client-sts`, `credential-providers` (^3.990.0) — AWS MSK support
- `@kafkajs/confluent-schema-registry` (^3.9.0) — Schema validation
- `aws-msk-iam-sasl-signer-js` — MSK IAM SASL signing
- `esbuild` — Bundler (not webpack)
- `commit-and-tag-version` — Release automation
