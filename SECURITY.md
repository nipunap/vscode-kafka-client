# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
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

## Security Features

Current security features:
- ✅ Comprehensive broker URL validation
- ✅ AWS IAM authentication support with role assumption
- ✅ TLS/SSL encryption support
- ✅ SASL authentication (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512)
- ✅ Credential validation before connection
- ✅ Secure credential storage via VS Code Secret Storage API
- ✅ Input sanitization across all user inputs
- ✅ No hardcoded credentials or secrets

## Dependency Security

We regularly audit dependencies for known vulnerabilities:
- All dependencies are compatible with GPL-3.0 license
- Dependencies are kept up-to-date
- Security patches are applied promptly

Run `npm audit` to check for known vulnerabilities in dependencies.
