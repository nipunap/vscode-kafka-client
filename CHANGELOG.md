# Changelog

All notable changes to the "Kafka Client" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

## 0.0.2 (2025-10-05)


### ✨ Features

* add automated CI/CD workflows and versioning ([332bf23](https://github.com/nipunap/vscode-kafka-client/commit/332bf235a29a4eeb48762f38560b5f987c175331))
* add CI check before publishing to VS Code Marketplace ([bab3892](https://github.com/nipunap/vscode-kafka-client/commit/bab3892d5390a6f3679a8e3ecfb52428349624bf))
* Implement fully automated release workflow ([000139e](https://github.com/nipunap/vscode-kafka-client/commit/000139e40f34ab1a29b999af58d32f60d1bb068d))
* Implement two-step release workflow ([e600172](https://github.com/nipunap/vscode-kafka-client/commit/e600172bc44e5c98a34c9bd8151176d72dc13f7e))
* init commit ([9bbec5e](https://github.com/nipunap/vscode-kafka-client/commit/9bbec5ee441f872930bdac142a08ad085b051a90))


### 🐛 Bug Fixes

* Add better error handling for protected branch push ([b92ae5a](https://github.com/nipunap/vscode-kafka-client/commit/b92ae5a1331e90dea36b1cf5e0b3b24fe6f1bbcc))
* add missing activation events for commands ([d04c73c](https://github.com/nipunap/vscode-kafka-client/commit/d04c73ccbd93e68e5abcfae51dd2c21cd6792976))
* add missing command declarations and remove unused import ([5f81973](https://github.com/nipunap/vscode-kafka-client/commit/5f81973be9709e2eaae568c0053afb19f2a829ef))
* Add permissions to lint-report job for PR comments ([67eeff2](https://github.com/nipunap/vscode-kafka-client/commit/67eeff21404789f59b5c67afae9d5b12ab0c543c))
* adding missing id: bump ([8bd7d2d](https://github.com/nipunap/vscode-kafka-client/commit/8bd7d2d2942492c19c1a5eda2f9fa302cdcfde80))
* Change to PR-based release workflow for protected branches ([8dbae06](https://github.com/nipunap/vscode-kafka-client/commit/8dbae06b51c08038da2db4fd5d2551e1028c6bd2))
* **ci:** improve workflow reliability and safety ([13edd09](https://github.com/nipunap/vscode-kafka-client/commit/13edd09a11bcfa6cedaf6d94714ae175d2749216))
* correct GitHub Actions syntax for secrets check ([d9f526d](https://github.com/nipunap/vscode-kafka-client/commit/d9f526dcb6d61315f7c3aa0739e911e91c42a28d))
* Correct glob pattern in test suite index ([e1d3bcf](https://github.com/nipunap/vscode-kafka-client/commit/e1d3bcf1c04df48d3036e0a47ba856a51726f5f9))
* Fix timeout in kafka.addCluster command test ([889d68b](https://github.com/nipunap/vscode-kafka-client/commit/889d68be029843355bbdd46296258a0e8389e9ba))
* migrate to ESLint 9 flat config format ([1b8b126](https://github.com/nipunap/vscode-kafka-client/commit/1b8b126343fed014a2ec9ed74ea337ad3a5c7163))
* Prevent CI from packaging on main branch ([b1967ce](https://github.com/nipunap/vscode-kafka-client/commit/b1967ceee36f9afb651e12100e8e393125d5457d))
* prevent double commit in auto-version workflow ([0fb4a44](https://github.com/nipunap/vscode-kafka-client/commit/0fb4a4414b9d20a5e093374fb17b0ff46a1cb9b0))
* remove deprecated ESLint rules from config ([113d5f4](https://github.com/nipunap/vscode-kafka-client/commit/113d5f4af899aee35b1cb29b35345131a02ef78f))
* Remove infinite loop in version-and-release workflow ([0b899ce](https://github.com/nipunap/vscode-kafka-client/commit/0b899ceb48493d04a4f4e60c2df45d737b9406ad))
* remove warnings from ESLint ([c6dacf9](https://github.com/nipunap/vscode-kafka-client/commit/c6dacf9f7c29d711f9a931b360ed9576a9bc3f54))
* replace empty interface with type alias ([878d1fb](https://github.com/nipunap/vscode-kafka-client/commit/878d1fb1016bbf3395dd7c40b42d663177b4a128))
* reset working tree before version bump in auto-version workflow ([f4cc884](https://github.com/nipunap/vscode-kafka-client/commit/f4cc884fe1b5f2fe28998c87dd2ec48e05ee4ffe))
* resolve critical resource leaks and add comprehensive test coverage ([c85fb97](https://github.com/nipunap/vscode-kafka-client/commit/c85fb97ba490461e57b7c70340be3947959af010))
* resolve critical resource leaks and add proper lifecycle management ([441246a](https://github.com/nipunap/vscode-kafka-client/commit/441246a5ccef503f8770006cd975cc5cd8421710))
* set vscode-kafka repo ([445b34d](https://github.com/nipunap/vscode-kafka-client/commit/445b34dd390bca7bc45f84e437e03f35bef0bec3))
* Simplify kafka.addCluster test to avoid timeout ([d7323ad](https://github.com/nipunap/vscode-kafka-client/commit/d7323ad9145d3d8d574f854d07d3c9291df3af43))
* update CI wait action to check workflow status ([78a7c44](https://github.com/nipunap/vscode-kafka-client/commit/78a7c442a6c19e07f79ca1501e95344775af80a3))
* use correct ESLint packages in flat config ([637a8c9](https://github.com/nipunap/vscode-kafka-client/commit/637a8c9e4b3bb25cff7e1ea55f96df8ab7201bc1))


### 📝 Documentation

* Add release and marketplace badges to README ([e63ec3c](https://github.com/nipunap/vscode-kafka-client/commit/e63ec3caccc054e6bbf062397a4c52ded9a3351a))

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
