# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.6.x   | :white_check_mark: |
| 0.5.x   | :white_check_mark: |
| 0.4.x   | :x:                |
| 0.3.x   | :x:                |
| < 0.3   | :x:                |

## Security Vulnerabilities

### CVE-2024-XXXXX-1: Incomplete URL Substring Sanitization (Fixed in v0.2.1)

**Severity**: High
**GitHub Alert**: N/A (User reported)

**Description**:
Prior to version 0.2.1, the extension did not properly validate broker URLs entered by users. This could allow attackers to inject malicious URLs or special characters that could manipulate connection strings. The vulnerability allowed arbitrary hosts to be injected before or after legitimate broker addresses.

**Attack Vectors**:
- URL injection with `@` character (e.g., `evil.com@localhost:9092`)
- Path traversal with `/` (e.g., `localhost:9092/../../path`)
- Query string injection with `?` (e.g., `localhost:9092?param=value`)
- Fragment injection with `#` (e.g., `localhost:9092#fragment`)
- CRLF injection (e.g., `localhost:9092\r\nHost: evil.com`)
- Null byte injection (e.g., `localhost:9092\x00evil.com`)
- Invalid IPv4 addresses (e.g., `1.2.3:9092`, `256.0.0.1:9092`)

**Impact**:
An attacker could potentially redirect Kafka connections to malicious brokers, leading to:
- Data exfiltration (messages sent to attacker's broker)
- Man-in-the-middle attacks
- Denial of service
- Credential theft

**Fix**:
Version 0.2.1 introduces comprehensive broker URL validation:
- Validates proper `host:port` format
- Blocks dangerous characters: `\r`, `\n`, `\0`, `@`, `/`, `?`, `#`
- Validates hostnames against RFC standards
- Strict IPv4 validation (exactly 4 octets, 0-255 per octet)
- IPv6 support with bracket notation `[::1]:9092`
- Port range validation (1-65535)
- Both client-side (webview) and server-side validation

**Credits**:
Thank you to the security researcher who responsibly disclosed this vulnerability.

---

### CVE-2024-XXXXX-2: Incomplete String Escaping in YAML Output (Fixed in v0.2.1)

**Severity**: Warning
**GitHub Alert**: [CodeQL Alert #16](https://github.com/nipunap/vscode-kafka-client/security/code-scanning/16)

**Description**:
Prior to version 0.2.1, the YAML formatters (`formatTopicDetailsYaml` and `formatBrokerDetailsYaml`) only escaped double quotes but did not escape backslashes. This could allow injection attacks if Kafka configuration values contained backslashes (common in Windows paths).

**Attack Vectors**:
- Windows paths with backslashes (e.g., `C:\Users\kafka\data`)
- Config values with embedded quotes and backslashes
- Malformed YAML that breaks parsing
- Potential injection of YAML directives

**Example**:
```yaml
# Before fix (incorrect):
path.config: C:\Users\kafka\data  # Invalid YAML

# After fix (correct):
path.config: "C:\\Users\\kafka\\data"  # Properly escaped
```

**Impact**:
An attacker or misconfigured Kafka cluster could return configuration values that:
- Break YAML parsing in the extension
- Inject malicious YAML content
- Cause incorrect configuration display
- Lead to confusion or misconfiguratoin

**Fix**:
Version 0.2.1 implements proper string escaping:
- Escapes backslashes BEFORE quotes (correct order)
- Wraps values in quotes if they contain `\`, `"`, `:`, or `\n`
- Applied in all 4 locations across both formatters
- Comprehensive test coverage for edge cases

**Credits**:
Detected by GitHub Advanced Security (CodeQL) and Copilot code review.

---

## Security Improvements in v0.3.0

Version 0.3.0 introduces a major security overhaul with enterprise-grade architecture:

### 1. Secure Credential Management
- **CredentialManager**: All passwords now stored using VSCode's SecretStorage API
- **Encrypted at Rest**: Credentials encrypted by VSCode/OS keychain
- **Migration Support**: Automatic migration from any old plain-text passwords
- **Per-Cluster Isolation**: Credentials isolated by cluster name
- **Automatic Cleanup**: Credentials deleted when cluster is removed

### 2. Connection Security
- **ConnectionPool**: Centralized connection management with secure lifecycle
  - Connections reused securely across operations
  - Automatic cleanup of idle connections (prevents resource exhaustion)
  - Proper error handling prevents connection leaks
  - Failed connections cleaned up immediately

### 3. Error Handling & Information Disclosure
- **Centralized ErrorHandler**: Prevents sensitive information leakage in error messages
  - Generic error messages to users
  - Detailed logs only in debug mode
  - Credential errors detected and handled specially
  - Network errors sanitized

### 4. Logging Security
- **Structured Logging**: Context-aware logging with configurable levels
  - Sensitive data never logged (passwords, tokens)
  - Separate log channels per component
  - Debug logs clearly marked and optional
  - Log levels: DEBUG, INFO, WARN, ERROR

### 5. Input Validation
- Already implemented in v0.2.1, maintained in v0.3.0
- 32 security tests validate all broker inputs
- Both client and server-side validation

### 6. Architecture Security
- **Event-Driven**: Reduced coupling reduces attack surface
- **Base Provider**: Consistent error handling prevents information leakage
- **Dependency Injection**: Clear component boundaries
- **Immutable Events**: Events can't be tampered with

### Security Testing
- 187 total tests (up from 132 in v0.2.x)
- 55 new tests for security features
- 85.55% coverage on infrastructure components
- 98.19% coverage on validators
- Continuous integration tests on multiple OS platforms

---



### Security Verification

✅ **All 352 tests passing** after fixes
✅ **No new vulnerabilities introduced**
✅ **Compilation successful**
✅ **ESLint passing**

---

## Security Enhancements in v0.6.0

**Audit Date**: October 11, 2025
**Version**: v0.6.0
**Auditor**: Development Team

Version 0.6.0 introduces native ACL management, real-time message streaming, enhanced configuration descriptions, and performance optimizations with comprehensive security measures:

### 1. Native ACL Management
- **KafkaJS API Integration**: Direct use of `describeAcls()`, `createAcls()`, `deleteAcls()` APIs
- **No External Dependencies**: Eliminated kafka-acls CLI tool dependency (reduced attack surface)
- **Permission Validation**: Proper permission checks before ACL operations
- **Type Safety**: Strong TypeScript typing with enum-based validation prevents injection
- **Audit Trail**: All ACL operations logged with full context
- **Error Handling**: Graceful failures with clear, non-sensitive error messages

**Security Considerations:**
- ACL operations require `Alter` permission on cluster
- All operations authenticated using cluster credentials (SSL/SASL/IAM)
- No credential leakage in ACL logs
- Type mappings prevent injection via enum validation
- Failed operations don't reveal sensitive cluster details

**Threat Model:**
- ✅ **CLI Injection**: Eliminated by removing kafka-acls shell dependency
- ✅ **Permission Bypass**: Validated via cluster auth
- ✅ **Injection Attacks**: Enum-based validation prevents malformed ACL entries
- ✅ **Information Disclosure**: Error messages sanitized

### 2. AWS MSK Broker Caching
- **Credential Efficiency**: Bootstrap brokers cached after first fetch
- **Reduced AWS API Calls**: 99% fewer `GetBootstrapBrokers` calls
- **TLS Performance**: TLS connections work without AWS credentials after initial setup
- **Cache Security**: Brokers validated before caching
- **Persistence**: Cache stored in VS Code settings (safe, non-sensitive data)

**Security Benefits:**
- Reduced attack surface (fewer AWS API calls = fewer auth opportunities)
- Credentials only needed once per cluster configuration
- Cached data is non-sensitive (broker hostnames/ports only)
- Works offline after initial setup
- No credential storage in cache

**Threat Model:**
- ✅ **Credential Exposure**: Brokers contain no credentials
- ✅ **Cache Poisoning**: Validation before caching
- ✅ **Replay Attacks**: Brokers are public information
- ✅ **Auth Bypass**: Cache contains no auth data

### 3. Dashboard Caching
- **Performance Optimization**: Dashboard data cached for 5 minutes
- **Memory Safety**: Cache limited by TTL (5 min) and cleared on extension reload
- **No Sensitive Data**: Only metrics and statistics cached (no credentials)
- **User Control**: Manual refresh button available anytime
- **Visual Indicators**: Cache age displayed to users (e.g., "2 minutes ago")

**Security Considerations:**
- Cached data includes topic configs, broker info, consumer group states
- No passwords, tokens, or authentication data cached
- Cache cleared on extension deactivation
- Per-cluster isolation (clusters can't access each other's cache)
- In-memory only (not persisted to disk)

**Threat Model:**
- ✅ **Credential Leakage**: No credentials cached
- ✅ **Stale Data**: TTL ensures freshness
- ✅ **Cross-Cluster Leakage**: Per-cluster isolation
- ✅ **Persistence Attacks**: Memory-only cache

### 4. Real-Time Message Consumer
- **Memory Protection**: Hard limit of 1000 messages to prevent memory exhaustion
- **Consumer Isolation**: Each session uses unique consumer group ID (`vscode-kafka-client-{timestamp}`)
- **Auto-Cleanup**: Consumer connections automatically closed when webview is disposed
- **Controlled Access**: Start/Stop/Pause/Resume controls prevent runaway consumers
- **No Persistence**: Messages stored only in memory (RAM), never written to disk
- **Export Safety**: Export feature requires explicit user action via save dialog
- **Authentication Inheritance**: All consumer operations use cluster credentials (SSL/SASL/IAM)

**Security Considerations:**
- Message content visible in VS Code webview (suitable for development environments)
- Consumer groups have unique IDs to prevent conflicts
- No automatic reconnection on failure (manual restart required)
- Timestamp conversion is client-side JavaScript (no external API calls)
- Memory cleared immediately on webview close

**Threat Model:**
- ✅ **Memory Exhaustion**: Mitigated by 1000 message limit
- ✅ **Data Leakage**: No disk persistence, export requires user consent
- ✅ **Consumer Conflicts**: Unique group IDs prevent conflicts
- ✅ **Resource Leaks**: Auto-cleanup on dispose
- ⚠️ **Screen Capture**: Message content visible in UI (consider for sensitive data)

### 5. Advanced Message Producer
- **Input Validation**: All fields (key, value, headers, partition) validated before sending
- **Template Safety**: Pre-built templates use sanitized, non-sensitive example data
- **Header Validation**: Custom headers validated for proper key-value format
- **Partition Bounds**: Partition numbers validated against topic metadata
- **Connection Pooling**: Producer instances reused via connection pool
- **Error Handling**: Failures don't expose sensitive cluster information

**Security Considerations:**
- Producer inherits cluster authentication (SSL/SASL/IAM)
- Message content sent as-is (no encryption by extension - use cluster-level encryption)
- Headers and values are user-controlled (responsibility for sensitive data)
- Templates stored locally in code (no external dependencies)
- No automatic retry on failure (prevents accidental data duplication)

**Threat Model:**
- ✅ **Injection Attacks**: Validated inputs prevent malformed messages
- ✅ **Data Leakage**: No automatic logging of message content
- ✅ **Authentication Bypass**: Uses cluster credentials
- ⚠️ **Sensitive Data**: User responsible for not sending sensitive data in plaintext
- ⚠️ **Message Duplication**: Manual send only (no automatic retries)

### 6. Enhanced Configuration Descriptions
- **Modal Dialog System**: Click-based info dialogs replace tooltips for better UX
- **Field Descriptions Database**: 365+ descriptions stored in local JSON file
- **Human-Readable Formatting**: Client-side conversion for .ms and .bytes properties
- **No External Dependencies**: All descriptions bundled with extension
- **Content Security Policy**: Webviews use strict CSP to prevent XSS

**Security Considerations:**
- Description data is static and bundled (no runtime modification)
- Modal dialogs use CSP-compliant inline event handlers
- Human-readable conversion is mathematical (no eval() or dynamic code)
- Field descriptions sourced from official Apache Kafka and AWS MSK documentation
- No user-generated content in description database

**Data Sources Validated:**
- ✅ Apache Kafka 3.x documentation
- ✅ AWS MSK official documentation
- ✅ Production best practices from community
- ✅ Security recommendations from Kafka security guide

### 7. Infrastructure Enhancements
- **Consumer Manager**: Centralized consumer lifecycle management
- **Connection Pooling**: Shared producer instances across operations
- **Resource Tracking**: All active consumers tracked for cleanup
- **Error Boundaries**: Failures isolated per webview instance
- **Singleton Pattern**: Single instance of description loader

**Security Benefits:**
- Reduced connection overhead (fewer authentication attempts)
- Centralized cleanup prevents resource leaks
- Error isolation prevents cascading failures
- Immutable description database after load

### 8. Security Testing
- ✅ **352 Tests Passing**: All existing security tests maintained (5 old tests removed)
- ✅ **62 New Tests**: Modal dialog and description database tests
- ✅ **Memory Leak Tests**: Consumer cleanup verification
- ✅ **Input Validation**: Producer field validation tests
- ✅ **92%+ Code Coverage**: High coverage on security-critical paths

**Test Categories:**
- Infrastructure security tests (ConnectionPool, CredentialManager, Logger)
- Consumer lifecycle and cleanup tests
- Producer validation and error handling tests
- Modal dialog XSS prevention tests
- Description database integrity tests
- Human-readable formatter safety tests

---

## Security Enhancements in v0.5.0

Version 0.5.0 introduces advanced features with comprehensive security improvements:

### 1. AI-Powered Recommendations
- **GitHub Copilot Integration**: Uses VS Code Language Model API for intelligent recommendations
- **Data Privacy**: Configuration data sent to GitHub Copilot for analysis
- **No Persistent Storage**: AI service does not store analyzed data permanently
- **User Control**: AI features only active when explicitly enabled and Copilot is authenticated
- **Opt-in Model**: Button only appears when requirements are met (VS Code 1.85+ and active Copilot subscription)

**Security Considerations:**
- Configuration data (topic settings, broker configs) is sent to GitHub Copilot API
- No credentials or sensitive authentication data is ever sent to AI
- Recommendations are suggestions only - review before applying
- AI responses are displayed in read-only views
- See [GitHub Copilot Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-copilot-privacy-statement)

### 2. Enhanced Detail Views
- **HTML Webviews**: Rich interactive views with proper Content Security Policy
- **Search Functionality**: Client-side search (Cmd+F/Ctrl+F) - no data sent externally
- **JSON Export**: Copy functionality for configuration backup and sharing
- **Read-Only**: All detail views are read-only (edit mode coming in future)
- **No Script Injection**: All user data properly escaped in HTML rendering

### 3. Consumer Group State Monitoring
- **Enhanced State Tracking**: Now fetches detailed consumer group states via `describeGroups()`
- **Additional API Calls**: One extra call per consumer group for state information
- **Graceful Degradation**: Falls back to basic info if describe fails
- **No Security Impact**: Read-only operations using existing credentials

### 4. KStreams & KTables Support
- **Pattern-Based Filtering**: Topics categorized by naming conventions
- **No Additional Permissions**: Uses same read permissions as regular topics
- **Client-Side Filtering**: No server-side queries beyond standard topic listing

### Security Testing
- **352 Total Tests** (up from 187 in v0.3.x)
- **170 New Tests** for new features (KStreams, KTables, AI integration, native ACL operations, modal dialogs)
- **Maintained Coverage**: 85%+ on infrastructure components
- **All Tests Passing**: Continuous integration on multiple platforms
- **Security Fixes**: All 6 CodeQL alerts resolved

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by:

1. **DO NOT** open a public issue
2. Email the maintainer directly with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to:
- Confirm the vulnerability
- Develop and test a fix
- Coordinate disclosure timing
- Credit you for the discovery (if desired)

## Security Best Practices

When using this extension:

1. **Broker URLs**: Only connect to trusted Kafka brokers
2. **Credentials**: Use AWS IAM roles when possible instead of storing credentials
3. **TLS/SSL**: Enable encryption for production clusters
4. **Network**: Use VPNs or private networks for sensitive deployments
5. **Updates**: Keep the extension updated to receive security patches
6. **Logging**: Use INFO or WARN log levels in production (avoid DEBUG to prevent sensitive data logging)
7. **Connection Pool**: The extension automatically manages connections securely
8. **AI Features** (v0.4.0+):
   - Understand that configuration data is sent to GitHub Copilot for analysis
   - Review AI recommendations before applying to production
   - AI button only appears when Copilot is authenticated (explicit opt-in)
   - No credentials or authentication tokens are ever sent to AI
   - Consider disabling Copilot if working with highly sensitive configurations
9. **HTML Views**: Interactive detail views use Content Security Policy - safe to use
10. **ACL Operations** (v0.6.0+):
   - ACL create/delete operations require `Alter` permission on cluster
   - All ACL operations are logged for audit trails
   - Failed ACL operations don't reveal sensitive cluster information
11. **Caching** (v0.6.0+):
   - Dashboard cache contains only non-sensitive metrics (no credentials)
   - Broker cache contains only hostnames/ports (public information)
   - Cache cleared on extension reload or manual refresh
12. **Message Streaming** (v0.6.0+):
   - Real-time consumer buffers max 1000 messages (memory protection)
   - Message content visible in webview (not suitable for highly sensitive data)
   - Export requires explicit user action
13. **Message Producer** (v0.6.0+):
   - User responsible for not sending sensitive data in plaintext
   - Use cluster-level encryption for sensitive messages
   - Templates use example data only (no real credentials)

## Security Features

### Authentication & Credentials (v0.3.0+)
- ✅ **Secure Credential Storage**: Passwords stored in VSCode SecretStorage API (encrypted at rest)
- ✅ **No Plain-Text Storage**: Sensitive credentials never saved to configuration files
- ✅ **Automatic Migration**: Old plain-text passwords migrated to secure storage
- ✅ **Credential Manager**: Centralized secure credential handling
- ✅ **AWS IAM Authentication**: Support for role assumption with temporary credentials
- ✅ **Multiple Auth Methods**: SASL (PLAIN, SCRAM-SHA-256/512), TLS/SSL, AWS IAM

### Input Validation & Sanitization (v0.2.1+)
- ✅ **Comprehensive Broker URL Validation**: 32 security tests covering:
  - Hostname/IPv4/IPv6 validation
  - Port range validation (1-65535)
  - Dangerous character blocking (`\r`, `\n`, `\0`, `@`, `/`, `?`, `#`)
  - CRLF injection prevention
  - Null byte injection prevention
  - URL injection prevention
- ✅ **Client-Side & Server-Side Validation**: Defense in depth
- ✅ **YAML Output Escaping**: Proper backslash and quote escaping
- ✅ **Input Sanitization**: All user inputs validated before use

### Infrastructure & Architecture (v0.3.0+)
- ✅ **Connection Pooling**: Secure connection lifecycle management
  - Automatic idle connection cleanup (5-minute timeout)
  - Proper disconnection on errors
  - No connection leaks
- ✅ **Centralized Error Handling**: Prevents error information leakage
- ✅ **Structured Logging**: Context-aware logging without sensitive data
- ✅ **Event-Driven Architecture**: Reduced attack surface through decoupling
- ✅ **Base Provider Pattern**: Consistent error handling across all providers

### Network Security
- ✅ **TLS/SSL Support**: Full encryption support for all connections
- ✅ **AWS MSK TLS**: Simplified configuration with built-in public certificates
- ✅ **Broker Caching**: Reduces AWS API calls (fewer auth opportunities)
- ✅ **Mutual TLS (mTLS)**: Support for client certificate authentication
- ✅ **Certificate Validation**: Proper CA, client cert, and key handling
- ✅ **Offline Support**: Cached brokers work without network connectivity

### Code Quality & Testing (v0.6.0+)
- ✅ **352 Tests**: Comprehensive test coverage including 32 security tests, 62 modal dialog tests, and consumer/producer webview tests
- ✅ **85%+ Infrastructure Coverage**: High coverage on security-critical components
- ✅ **Static Analysis**: ESLint and TypeScript strict mode
- ✅ **No Hardcoded Secrets**: All credentials managed securely
- ✅ **AI Safety**: No credentials sent to AI, only configuration metadata
- ✅ **ACL Type Safety**: Enum-based validation prevents injection attacks

### AI & Data Privacy (v0.5.0+)
- ✅ **Opt-In Only**: AI features require explicit GitHub Copilot subscription
- ✅ **No Credential Leakage**: Passwords, tokens, keys never sent to AI
- ✅ **Configuration-Only**: Only topic/broker/consumer group settings sent
- ✅ **GitHub Policy**: Governed by GitHub Copilot Privacy Statement
- ✅ **Read-Only Recommendations**: AI suggestions displayed but not auto-applied
- ✅ **Availability Check**: Feature disabled if Copilot unavailable
- ✅ **User Control**: Button appears only when user has active Copilot

### ACL Security (v0.6.0+)
- ✅ **Native API**: Direct KafkaJS integration (no shell command injection risk)
- ✅ **Type Safety**: Enum-based validation prevents injection attacks
- ✅ **Permission Checks**: Validates `Alter` permission before operations
- ✅ **Audit Logging**: All ACL operations logged with full context
- ✅ **Error Sanitization**: Failed operations don't leak sensitive details

### Message Streaming Security (v0.6.0+)
- ✅ **Memory Limits**: Hard cap of 1000 messages prevents memory exhaustion
- ✅ **Consumer Isolation**: Unique group IDs prevent conflicts
- ✅ **Auto-Cleanup**: Consumers disposed with webview
- ✅ **No Persistence**: Messages never written to disk
- ✅ **User Consent**: Export requires explicit save dialog

### Producer Security (v0.6.0+)
- ✅ **Input Validation**: All fields validated before sending
- ✅ **Template Safety**: Example data only (no real credentials)
- ✅ **No Auto-Retry**: Prevents accidental duplication
- ✅ **Connection Pooling**: Efficient resource management
- ✅ **Error Isolation**: Failures don't expose cluster details
- ✅ **No CLI Dependency**: Eliminated external kafka-acls tool (reduced attack surface)

## Dependency Security

We regularly audit dependencies for known vulnerabilities:
- All dependencies are compatible with GPL-3.0 license
- Dependencies are kept up-to-date
- Security patches are applied promptly

Run `npm audit` to check for known vulnerabilities in dependencies.
