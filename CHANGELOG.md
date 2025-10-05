# Changelog

All notable changes to the "Kafka Client" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### ✨ Features
- Automated versioning based on conventional commits
- Automated CHANGELOG generation from commit messages
- GitHub Actions CI/CD workflow for automated testing
- Multi-platform testing (Ubuntu, Windows, macOS)
- Multi-version Node.js testing (18.x, 20.x)
- CodeQL security scanning workflow

### 🔧 Development
- Added `npm run package` script with validation checks
- Added `npm run publish` script with interactive wizard
- Automated packaging and publishing scripts
- CI workflow validates linting, compilation, and packaging on every PR
- PRs require all checks to pass before merging

### 💄 Improvements
- Gallery banner configuration for marketplace
- Enhanced categories for better discoverability
- Improved marketplace presence with better categories
- Refactored `tmp/` directory to `mics/` for better organization
- Enhanced README with CI badge and contribution guidelines

## [0.0.1] - Initial Release

### Features
- 🔌 Connect to Apache Kafka and AWS MSK clusters
- ☁️ AWS MSK IAM authentication with automatic role assumption
- 🔐 AWS Profile management with credential expiration tracking
- 🔍 Auto-discovery of MSK clusters in AWS accounts
- 📋 Topic management (create, delete, browse)
- 👥 Consumer group monitoring with lag and offset information
- 📊 Detailed resource views in YAML format
- 🔒 Support for SSL/TLS, SASL (PLAIN, SCRAM-SHA-256/512), and AWS IAM
- 📨 Produce and consume messages with custom keys and values
- 🎯 Context menu actions for clusters, topics, and consumer groups

### Security Features
- Direct reading from `~/.aws/credentials` file
- Support for temporary credentials with expiration tracking
- Secure credential storage (passwords never saved to settings)
- IAM role assumption for elevated permissions

### UI/UX
- Dedicated Kafka activity bar with two views (Clusters and Consumer Groups)
- Webview form for cluster connection with AWS integration
- Visual indicators for AWS credential status
- Refresh buttons for all views

