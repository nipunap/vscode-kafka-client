# Security Policy

## Overview

The VSCode Kafka Client extension handles sensitive data including Kafka credentials, message content, and cluster configurations. This document outlines our security practices, how to report vulnerabilities, and guidance for secure usage.

**Current Version**: v0.10.0 (Production Ready)
**Security Test Coverage**: 632 tests
**Compliance**: OWASP Top 10, CWE-532, CWE-209

---

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          | Status                       | Security Updates |
| ------- | ------------------ | ---------------------------- | ---------------- |
| 0.10.x  | :white_check_mark: | Latest - Production Ready    | Active           |
| 0.9.x   | :white_check_mark: | Supported                    | Active           |
| 0.8.x   | :white_check_mark: | Supported                    | Active           |
| 0.7.x   | :white_check_mark: | Supported                    | Active           |
| 0.6.x   | :warning:          | Limited Support              | Critical only    |
| < 0.6   | :x:                | Unsupported                  | None             |

**Recommendation**: Always use the latest version (0.10.x) for full security coverage.

---

## Reporting a Vulnerability

We take security vulnerabilities seriously and appreciate responsible disclosure.

### :rotating_light: **DO NOT** open public GitHub issues for security vulnerabilities

### How to Report

**Email**: Contact the maintainer directly (see GitHub profile)

**Include**:
- Detailed description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact assessment
- Proof of concept (if applicable)
- Suggested fix (optional)

### Response Timeline

| Stage                  | Timeline      |
| ---------------------- | ------------- |
| Initial Response       | 48 hours      |
| Vulnerability Confirmed| 3-5 days      |
| Fix Development        | 7-14 days     |
| Security Release       | Coordinated   |
| Public Disclosure      | After release |

### What Happens Next

1. **Acknowledge**: We'll confirm receipt within 48 hours
2. **Assess**: Severity and impact evaluation (CVSS scoring)
3. **Fix**: Develop and test security patch
4. **Coordinate**: Agree on disclosure timeline with reporter
5. **Release**: Publish security update
6. **Credit**: Public acknowledgment (if desired)
7. **Advisory**: Publish security advisory (GitHub Security tab)

### Scope

**In Scope**:
- Authentication bypass
- Credential leakage
- XSS vulnerabilities
- Injection attacks (SQL, Command, YAML)
- Data exposure through logs/cache
- CSRF in webviews
- Race conditions leading to security issues
- Denial of Service (DoS)

**Out of Scope**:
- Social engineering attacks
- Physical access attacks
- Issues in third-party dependencies (report to upstream)
- Kafka broker vulnerabilities (report to Apache Kafka)

---

## Security Advisories

### Fixed Vulnerabilities

All known vulnerabilities have been fixed in supported versions:

#### High Severity

**URL Injection Vulnerability** (Fixed in v0.2.1)
- **ID**: CVE-2025-XXXXX-1 *(pending official CVE assignment)*
- **Severity**: High (CVSS 7.5)
- **Impact**: URL injection, path traversal, CRLF injection, credential theft
- **Fix**: RFC-compliant URL validation with character whitelist
- **Affected**: < v0.2.1
- **Credit**: Responsibly disclosed by security researcher

#### Medium Severity

**YAML Escaping Vulnerability** (Fixed in v0.2.1)
- **ID**: CVE-2025-XXXXX-2 *(pending official CVE assignment)*
- **Severity**: Warning (CVSS 4.3)
- **Impact**: YAML parsing errors, configuration display issues
- **Fix**: Correct backslash escaping order, auto-quoting
- **Affected**: < v0.2.1
- **Credit**: GitHub Advanced Security (CodeQL)
- **Reference**: [CodeQL Alert #16](https://github.com/nipunap/vscode-kafka-client/security/code-scanning/16)

**Status**: :white_check_mark: All known vulnerabilities resolved

For detailed security advisories, see the [GitHub Security Advisories](https://github.com/nipunap/vscode-kafka-client/security/advisories) page.

---

## Security Features

### Credential Protection

- **Encrypted Storage**: VSCode SecretStorage API (encrypted at rest)
- **No Plaintext**: Credentials never stored in plain text
- **Automatic Migration**: Legacy plaintext passwords auto-migrated
- **Logger Sanitization**: 13 sensitive field types automatically redacted
  - `saslPassword`, `sslPassword`, `awsSecretAccessKey`, `awsAccessKeyId`
  - `schemaRegistryApiKey`, `schemaRegistryApiSecret`, `apiKey`, `apiSecret`
  - `principal`, `password`, `secret`, `token`, `awsSessionToken`
- **Audit Logging**: Operations logged without sensitive data

### Authentication Methods

- **SASL**: PLAIN, SCRAM-SHA-256, SCRAM-SHA-512
- **TLS/SSL**: Client certificates, mutual TLS (mTLS)
- **AWS IAM**: IAM roles (recommended), temporary credentials
- **Schema Registry**: HTTPS enforcement, API key protection

### Input Validation

- **URL Validation**: RFC-compliant hostname/IPv4/IPv6 validation
- **Port Range**: 1-65535 with type checking
- **Blocked Characters**: CRLF (`\r\n`), null bytes (`\0`), URL injection (`@/?#`)
- **Message Validation**: Key/value/header validation, size limits
- **Defense in Depth**: Client-side and server-side validation

### Web Security (Webviews)

- **Content Security Policy (CSP)**: `script-src` whitelist, `default-src 'none'`
- **XSS Prevention**: HTML escaping for all dynamic content
- **Command Whitelist**: Only approved commands accepted
- **Race Condition Protection**: Request ID validation
- **Message Validation**: Type checking, length limits
- **Timeout Handling**: 10-second timeouts with graceful fallback

### Network Security

- **TLS/SSL**: Encryption for all connections
- **Certificate Validation**: Automatic certificate verification
- **HTTPS Enforcement**: Schema Registry requires HTTPS
- **AWS MSK**: Built-in certificate support, IAM authentication
- **Connection Pooling**: Centralized connection management, 5-minute idle timeout

### Data Privacy

- **PII Detection**: Automatic warnings for email/credit card patterns in searches
- **Telemetry**: No PII, credentials, or message content in telemetry events
- **Client-Side Processing**: Regex filtering performed locally (never sent to broker)
- **Memory Limits**: 1000 message buffer cap (prevents memory exhaustion)
- **No Persistence**: Real-time messages stored in RAM only
- **Export Consent**: Save dialog required for message export

### Access Control

- **Native ACL API**: Direct KafkaJS API (no CLI injection risk)
- **Permission Checks**: `Alter` permission required for ACL operations
- **Enum Validation**: Type-safe enums prevent injection attacks
- **Audit Trail**: All ACL operations logged with context
- **Error Sanitization**: Failed operations don't expose cluster details

### AI Features (Optional)

- **Opt-In Only**: Requires GitHub Copilot subscription
- **No Credentials Sent**: Only configuration metadata sent to AI
- **Privacy Policy**: Governed by [GitHub Copilot Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-copilot-privacy-statement)
- **Read-Only**: AI provides recommendations only (no automatic changes)

---

## Security Best Practices

### :lock: For Extension Users

#### Connection Security

1. **Use TLS/SSL**: Always enable encryption for production clusters
   ```json
   {
     "ssl": true,
     "sasl": {
       "mechanism": "scram-sha-512"
     }
   }
   ```

2. **Prefer IAM Roles**: Use AWS IAM roles instead of stored credentials when possible
   - Avoids credential storage entirely
   - Automatic credential rotation
   - Centralized access control

3. **Network Isolation**: Connect through VPN or private networks for sensitive clusters

4. **Trusted Brokers Only**: Only connect to known, trusted Kafka brokers

#### Configuration

5. **Keep Updated**: Enable automatic extension updates for security patches

6. **Logging Levels**: Use `INFO` or `WARN` in production (avoid `DEBUG`)
   - `DEBUG` may log additional context (still sanitized)
   - Use for troubleshooting only

7. **Schema Registry**: Always use HTTPS URLs
   ```
   ✅ https://schema-registry.example.com
   ❌ http://schema-registry.example.com (rejected)
   ```

#### Message Handling

8. **Sensitive Data**: Don't produce messages with credentials/secrets via extension
   - Use cluster-level encryption at rest
   - Apply field-level encryption before producing

9. **Screen Sharing**: Be aware message content is visible in webviews during screen shares

10. **Export Carefully**: Review messages before exporting to files

#### ACL Operations

11. **Least Privilege**: Grant minimum required permissions

12. **Review Changes**: Double-check ACL modifications before applying

13. **Audit Logs**: Monitor ACL change logs for compliance

#### AI Features

14. **Review Recommendations**: Always review AI suggestions before applying to production

15. **Configuration Review**: AI sees topic configs, broker settings, consumer group states
    - No credentials/passwords/tokens sent
    - See GitHub Copilot privacy policy for details

### :shield: For Developers

#### Contributing

16. **No Hardcoded Secrets**: Never commit credentials, API keys, or tokens

17. **Input Validation**: Validate all user input (defense in depth)

18. **Error Messages**: Sanitize errors (use `Logger.sanitize()`)

19. **Testing**: Add security tests for new features
    - Input validation tests
    - Sanitization tests
    - XSS prevention tests

#### Code Review

20. **Security Checklist**:
    - [ ] User input validated
    - [ ] Sensitive data sanitized in logs
    - [ ] HTML escaped in webviews
    - [ ] CSP headers present
    - [ ] Error messages don't leak credentials
    - [ ] Tests cover security scenarios

---

## Security Testing

### Test Coverage

| Category                  | Tests | Coverage |
| ------------------------- | ----- | -------- |
| Input Validation          | 32    | 100%     |
| Credential Sanitization   | 55    | 100%     |
| XSS Prevention            | 38    | 100%     |
| ACL Security              | 62    | 100%     |
| Message Search/PII        | 18    | 100%     |
| Schema Registry HTTPS     | 15    | 100%     |
| Telemetry Privacy         | 21    | 100%     |
| **Total Security Tests**  | 241   | 100%     |
| **Total Tests (v0.10.0)** | 632   | 92%+     |

### Static Analysis

- **ESLint**: Security rules enabled
- **TypeScript**: Strict mode (`--noUnusedLocals`, `--noUnusedParameters`)
- **CodeQL**: GitHub Advanced Security scanning (all alerts resolved)
- **npm audit**: Regular dependency vulnerability scans

### Manual Security Audits

- **v0.10.0**: October 18, 2025
- **v0.8.9**: October 17, 2025
- **v0.7.0**: October 12, 2025
- **v0.6.0**: October 11, 2025

---

## Dependency Security

### Vulnerability Management

- **Automated Scanning**: GitHub Dependabot enabled
- **Update Policy**: Security patches applied within 48 hours for critical issues
- **Audit Frequency**: `npm audit` run before each release
- **License Compliance**: GPL-3.0 license adherence verified

### Checking Dependencies

Users can verify dependency security:

```bash
cd ~/.vscode/extensions/nipunaperera.vscode-kafka-client-*
npm audit
```

**Expected Result**: 0 vulnerabilities

---

## Compliance & Standards

### Industry Standards

- **OWASP Top 10**: XSS prevention, injection prevention, security logging
- **CWE-532**: Information Exposure Through Log Files (mitigated)
- **CWE-209**: Information Exposure Through Error Messages (mitigated)
- **CSP Level 3**: Content Security Policy implementation

### Security Frameworks

- **Defense in Depth**: Multiple validation layers (client + server)
- **Least Privilege**: Minimal required permissions
- **Secure by Default**: Security features enabled automatically
- **Privacy by Design**: PII detection, telemetry filtering

### Testing Standards

- **100% Critical Path Coverage**: All security-critical code tested
- **Regression Testing**: 632 total tests prevent security regressions
- **Fuzzing**: Input validation tested with edge cases

---

## Version History

For detailed security enhancements by version, see [VERSION_SECURITY.md](VERSION_SECURITY.md).

### Quick Summary

| Version   | Date           | Key Security Features                                    |
| --------- | -------------- | -------------------------------------------------------- |
| **0.10.0** | Oct 18, 2025   | Schema Registry HTTPS, PII warnings, XSS fixes          |
| **0.8.9**  | Oct 17, 2025   | Logger sanitization (13 sensitive fields)                |
| **0.7.0**  | Oct 12, 2025   | CSP, XSS prevention, race condition fixes                |
| **0.6.0**  | Oct 11, 2025   | Native ACL API, caching, real-time consumer              |
| **0.3.0**  | 2025           | SecretStorage, connection pooling, error sanitization    |
| **0.2.1**  | 2025           | URL validation, YAML escaping (fixed CVE-2025-XXXXX-1/2) |

---

## Additional Resources

- **GitHub Security**: [Security Advisories](https://github.com/nipunap/vscode-kafka-client/security)
- **Bug Reports**: [GitHub Issues](https://github.com/nipunap/vscode-kafka-client/issues) (non-security only)
- **Documentation**: [README.md](README.md)
- **License**: [GPL-3.0](LICENSE)

---

## Contact

**For security issues**: Email maintainer directly (DO NOT use public issues)
**For general support**: [GitHub Discussions](https://github.com/nipunap/vscode-kafka-client/discussions)

---

*Last Updated: February 2026*
*Document Version: 2.0 (Standard Format)*
