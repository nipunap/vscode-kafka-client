# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | :white_check_mark: |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :x:                |
| < 0.2   | :x:                |

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

## Security Audit Report (v0.4.0) - October 2025

**Audit Date**: October 9, 2025  
**Auditor**: Senior Security Engineer  
**Scope**: Comprehensive security review of codebase and CI/CD  
**Status**: ✅ **PASSED** - All critical issues resolved

### Findings Summary

**CodeQL Alerts Fixed**: 6/6 (100%)
- ✅ Fixed: Replacement of substring with itself (Medium)
- ✅ Fixed: Useless assignment to local variable (Warning)
- ✅ Fixed: 4x Workflow permissions not defined (Medium)

**Security Review**: 
- ✅ Credential Management: SECURE
- ✅ Input Validation: EXCELLENT
- ✅ Error Handling: EXCELLENT  
- ✅ AI Data Transmission: SECURE
- ✅ Dependencies: UP-TO-DATE
- ✅ Test Coverage: 296 tests passing (85%+ coverage)

### Issues Fixed in This Release

#### 1. CodeQL Alert #2: Replacement of Substring with Itself
- **Severity**: Medium
- **Location**: `src/kafka/kafkaClientManager.ts:211`
- **Issue**: `connection.saslMechanism.toLowerCase().replace(/-/g, '-')` replaced hyphens with hyphens (no-op)
- **Fix**: Removed useless `.replace()` call - now just `.toLowerCase()`
- **Impact**: No security impact, code clarity improvement

#### 2. CodeQL Alert #11: Console Logging
- **Severity**: Warning
- **Location**: `src/kafka/kafkaClientManager.ts:896`
- **Issue**: Direct `console.error()` usage instead of structured logging
- **Fix**: Replaced with `this.logger.error()` for consistent logging
- **Security Benefit**: All errors now go through centralized logger with proper sanitization

#### 3. CodeQL Alerts #12, #15, #26, #27: Workflow Permissions
- **Severity**: Medium (4 alerts)
- **Location**: `.github/workflows/ci.yml` and `publish-release.yml`
- **Issue**: GitHub Actions workflows lacked explicit permission declarations
- **Fix**: 
  - `ci.yml`: Added `permissions: contents: read` (minimal, read-only)
  - `publish-release.yml`: Added `permissions: contents: write, pull-requests: read`
- **Security Benefit**: Follows principle of least privilege, prevents token abuse

### Security Verification

✅ **All 296 tests passing** after fixes  
✅ **No new vulnerabilities introduced**  
✅ **Compilation successful**  
✅ **ESLint passing**

---

## Security Enhancements in v0.4.0

Version 0.4.0 introduces advanced features with security considerations:

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
- **296 Total Tests** (up from 187 in v0.3.x)
- **109 New Tests** for new features (KStreams, KTables, AI integration)
- **Maintained Coverage**: 85%+ on infrastructure components
- **All Tests Passing**: Continuous integration on multiple platforms

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
- ✅ **Mutual TLS (mTLS)**: Support for client certificate authentication
- ✅ **Certificate Validation**: Proper CA, client cert, and key handling

### Code Quality & Testing (v0.4.0+)
- ✅ **296 Tests**: Comprehensive test coverage including 32 security tests
- ✅ **85%+ Infrastructure Coverage**: High coverage on security-critical components
- ✅ **Static Analysis**: ESLint and TypeScript strict mode
- ✅ **No Hardcoded Secrets**: All credentials managed securely
- ✅ **AI Safety**: No credentials sent to AI, only configuration metadata

### AI & Data Privacy (v0.4.0+)
- ✅ **Opt-In Only**: AI features require explicit GitHub Copilot subscription
- ✅ **No Credential Leakage**: Passwords, tokens, keys never sent to AI
- ✅ **Configuration-Only**: Only topic/broker/consumer group settings sent
- ✅ **GitHub Policy**: Governed by GitHub Copilot Privacy Statement
- ✅ **Read-Only Recommendations**: AI suggestions displayed but not auto-applied
- ✅ **Availability Check**: Feature disabled if Copilot unavailable
- ✅ **User Control**: Button appears only when user has active Copilot

## Dependency Security

We regularly audit dependencies for known vulnerabilities:
- All dependencies are compatible with GPL-3.0 license
- Dependencies are kept up-to-date
- Security patches are applied promptly

Run `npm audit` to check for known vulnerabilities in dependencies.
