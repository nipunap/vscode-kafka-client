# Changelog

All notable changes to the "Kafka Client" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.8.4](https://github.com/nipunap/vscode-kafka-client/compare/v0.8.3...v0.8.4) (2025-10-14)


### 🐛 Bug Fixes

* let action create tag and release atomically to prevent immutable release error ([614f12a](https://github.com/nipunap/vscode-kafka-client/commit/614f12a4e59e303329533ae2c677619638e34769))

## [0.8.3](https://github.com/nipunap/vscode-kafka-client/compare/v0.8.2...v0.8.3) (2025-10-14)


### 🐛 Bug Fixes

* use wildcard pattern for VSIX upload to prevent immutable release error ([8a5f107](https://github.com/nipunap/vscode-kafka-client/commit/8a5f107e46a48680efdcd2e12e8f6c2e2d728a76))

## [0.8.2](https://github.com/nipunap/vscode-kafka-client/compare/v0.8.1...v0.8.2) (2025-10-14)


### 🐛 Bug Fixes

* resolve immutable release error with atomic release creation ([d8a8530](https://github.com/nipunap/vscode-kafka-client/commit/d8a85307f1e9b3b02e5bd6f4ae363e4c66a3d5f4))

## [0.8.1](https://github.com/nipunap/vscode-kafka-client/compare/v0.7.1...v0.8.1) (2025-10-14)


### ✨ Features

* add Open VSX Registry publishing support ([9abcf08](https://github.com/nipunap/vscode-kafka-client/commit/9abcf08f8794890d914fc0fcd62af3b95c8302a0))
* add top consumer groups section to cluster dashboard ([ceebe09](https://github.com/nipunap/vscode-kafka-client/commit/ceebe09847a0c5a01f84d01d28a344c83cd01002))


### 🐛 Bug Fixes

* add all test cases ([f11d561](https://github.com/nipunap/vscode-kafka-client/commit/f11d5610a7c5877ec5f0d1de622b7abe76b87b82))
* attach VSIX file to GitHub releases and improve package verification ([90e2704](https://github.com/nipunap/vscode-kafka-client/commit/90e2704826f1982c85280cf246b42a06e172dd26))
* correct consumer groups sorting order ([5ed1670](https://github.com/nipunap/vscode-kafka-client/commit/5ed1670cb80752b8ffdd0f71f9795a232b895784))
* ensure webview scripts are included in VSIX package ([2d872fa](https://github.com/nipunap/vscode-kafka-client/commit/2d872fa731c12ff4ed48e0ddbe1e144a70493426))
* improve broker table styling and layout ([4f6304c](https://github.com/nipunap/vscode-kafka-client/commit/4f6304c5044336769e9cd20c92692a2f1428ec3f))
* improve consumer groups dashboard UI stability and responsiveness ([ad7d7be](https://github.com/nipunap/vscode-kafka-client/commit/ad7d7be686681a54d21dfcf8e265259a201af58d))
* increase parallel processing test timeout to 600ms for Windows CI ([58b3886](https://github.com/nipunap/vscode-kafka-client/commit/58b3886bcdd00e9d3bfba84b71cbbc8c933ef599))
* increase timing thresholds in parallel processing test for CI compatibility ([85c78c9](https://github.com/nipunap/vscode-kafka-client/commit/85c78c9e7a2a385894ea12187da92633d80f2fe3))
* prevent file handle exhaustion in Windows CI tests ([2d33965](https://github.com/nipunap/vscode-kafka-client/commit/2d33965960edcb46b32ae8ecf3bb9f3086dc7ac8))
* senior engineering review improvements ([299c775](https://github.com/nipunap/vscode-kafka-client/commit/299c7755617958a86c945c402f4719e55573ea81))
* show consumer groups with topic assignments regardless of member count ([b4819b2](https://github.com/nipunap/vscode-kafka-client/commit/b4819b2e30aa09ce31c05ba3ff496f69e9e6f533))


### ♻️ Code Refactoring

* change consumer groups to table format and filter Empty state ([c22ffb9](https://github.com/nipunap/vscode-kafka-client/commit/c22ffb9fa57cd5afcbecc68818a48762e9dc7d42))

## [0.8.0](https://github.com/nipunap/vscode-kafka-client/compare/v0.7.1...v0.8.0) (2025-10-14)


### ✨ Features

* add Open VSX Registry publishing support ([9abcf08](https://github.com/nipunap/vscode-kafka-client/commit/9abcf08f8794890d914fc0fcd62af3b95c8302a0))

## [0.7.1](https://github.com/nipunap/vscode-kafka-client/compare/v0.7.0...v0.7.1) (2025-10-14)


### 🐛 Bug Fixes

* Fix critical issues from code review ([7dd4937](https://github.com/nipunap/vscode-kafka-client/commit/7dd4937f95353e0d1a645d075324de8c8b533d0e))
* Handle undefined topic offsets gracefully ([5249a28](https://github.com/nipunap/vscode-kafka-client/commit/5249a28b3f5f178394fafbee7540a658a66de478))

## [0.7.0](https://github.com/nipunap/vscode-kafka-client/compare/v0.6.0...v0.7.0) (2025-10-12)


### ✨ Features

* add 10-second timeout for AI parameter details requests ([86433e7](https://github.com/nipunap/vscode-kafka-client/commit/86433e713a27eef4d6cfc033520c8fda5437a6ad))
* add human-readable config source labels and AI-powered parameter details ([9cb75bd](https://github.com/nipunap/vscode-kafka-client/commit/9cb75bdbdfae8e0cdecb4fcbb85880e3ddae17ff))
* architectural improvements for production readiness ([9e96295](https://github.com/nipunap/vscode-kafka-client/commit/9e9629549f86c8a92b51345b8edaa28b0d4bad27))
* move human-readable toggle to table header for bulk operations ([75c5d6a](https://github.com/nipunap/vscode-kafka-client/commit/75c5d6acd17f86c6b12f46cb20b59f7c1b09bb61))


### 🐛 Bug Fixes

* add missed files ([da60413](https://github.com/nipunap/vscode-kafka-client/commit/da60413467e9614c1a898ac0b0a1cdeda82bbbdc))
* add proper HTML formatting to AI-enhanced parameter details ([2735d6c](https://github.com/nipunap/vscode-kafka-client/commit/2735d6cd1e3afdc30c0bca62731c4e13c6340e19))
* apply header-based human-readable toggle to Message Consumer webview ([8c44048](https://github.com/nipunap/vscode-kafka-client/commit/8c4404866c4642853493767e9c494bae98a123e2))
* make script tag regex case-insensitive in security tests ([672f7dd](https://github.com/nipunap/vscode-kafka-client/commit/672f7ddbfcad43ce8d90b90aa3fdf1a28573071f)), closes [#29](https://github.com/nipunap/vscode-kafka-client/issues/29)
* resolve CSP violations for inline event handlers and external scripts ([4e9275e](https://github.com/nipunap/vscode-kafka-client/commit/4e9275e4dc9e23b2408dda353306083d5596614a))


### ⚡ Performance Improvements

* simplify AI request flow for faster response times ([bc7ecb3](https://github.com/nipunap/vscode-kafka-client/commit/bc7ecb3a254ba0412735ccb0018a62ac0d87e0e2))


### ♻️ Code Refactoring

* comprehensive code cleanup - remove unused code and variables ([3790bbe](https://github.com/nipunap/vscode-kafka-client/commit/3790bbeeaf40c088faa9806ce4fd238a8f8db1f1))

## [0.6.0](https://github.com/nipunap/vscode-kafka-client/compare/v0.5.0...v0.6.0) (2025-10-11)


### ⚠ BREAKING CHANGES

* Old simple producer and batch consumer commands removed

- Remove old produceMessage function (simple input boxes)
- Remove old consumeMessages function (batch limited to text document)
- Replace kafka.produceMessage with advanced producer webview
- Replace kafka.consumeMessages with real-time streaming consumer
- Remove kafka.produceMessageWithForm command
- Remove kafka.streamMessages command (consolidated into consumeMessages)
- Simplify command menu (2 commands instead of 4)
- Update tests: Remove 5 old tests (352 tests total, down from 357)
- Update documentation to reflect new simplified commands

Benefits:
- Cleaner UX: One "Produce Message" instead of two options
- Cleaner UX: One "Consume Messages" for streaming instead of batch
- Advanced features by default (templates, headers, pause/resume)
- Consistent naming across extension
* None (backward compatible)

Resolves: #message-streaming
Resolves: #enhanced-descriptions

### ✨ Features

* add export buttons for topics and consumer groups ([c6c45c9](https://github.com/nipunap/vscode-kafka-client/commit/c6c45c9397de756d3cdbfa335438e28b66aed3b5))
* add real-time message streaming and enhanced configuration descriptions ([eac91ff](https://github.com/nipunap/vscode-kafka-client/commit/eac91ff6f4b402e0cbd7662ef478e51d0e77614f))


### 🐛 Bug Fixes

* topic and consumer group search showing old YAML view instead of HTML webview ([22b46c1](https://github.com/nipunap/vscode-kafka-client/commit/22b46c1791a7e54a905a6cc2947e217fce78fa2d))


### ♻️ Code Refactoring

* remove old producer/consumer, replace with advanced webviews ([a9e5442](https://github.com/nipunap/vscode-kafka-client/commit/a9e5442d75c9422fb3c851af63122c2ce6937e7b))


### 📝 Documentation

* add export functionality to README ([9f6c7ee](https://github.com/nipunap/vscode-kafka-client/commit/9f6c7ee47209b464e4a9885b534a6134d3e36f86))
* consolidate security enhancements into v0.6.0 ([1a0da57](https://github.com/nipunap/vscode-kafka-client/commit/1a0da57f4f18bbe54e1a941640d7125db17b6aad))

## [0.5.0](https://github.com/nipunap/vscode-kafka-client/compare/v0.4.0...v0.5.0) (2025-10-09)


### ✨ Features

* Add AI Advisor powered by GitHub Copilot ([a1b77bd](https://github.com/nipunap/vscode-kafka-client/commit/a1b77bd4b2258e71d29340f2b207ec26ca3a2c1b))
* Add search functionality and JSON export to detail views ([8f68ec1](https://github.com/nipunap/vscode-kafka-client/commit/8f68ec1194f2ca0f9861aebabc6ca772dd23034a))
* Add separate KStreams and KTables sections with full topic functionality ([48aad5f](https://github.com/nipunap/vscode-kafka-client/commit/48aad5f716b1addd6f350e2e6f69e8d2b398aa88))
* Conditionally show AI Advisor button and fix consumer group colors ([7718e53](https://github.com/nipunap/vscode-kafka-client/commit/7718e531b4ff375fb19f3ceb65cc52553ab5085e))
* Convert all detail views from YAML to formatted HTML ([9e53aa1](https://github.com/nipunap/vscode-kafka-client/commit/9e53aa1c1c5754f47bf92d7661a43d29e4266498))
* Display all configurations and enhanced metadata in detail views ([f529e05](https://github.com/nipunap/vscode-kafka-client/commit/f529e05ac63af95b9808b5c0e1281e9e5495db8c))
* Improve AI recommendations with concise, structured format ([379f04c](https://github.com/nipunap/vscode-kafka-client/commit/379f04c830d121055c7d91dbfdbe2a04de4df773))
* Integrate ACLs with topics for better context and usability ([243158c](https://github.com/nipunap/vscode-kafka-client/commit/243158c272208dff841a08f53d623a3190e7d19b))


### 🐛 Bug Fixes

* Prevent automatic error log window from opening ([a75072f](https://github.com/nipunap/vscode-kafka-client/commit/a75072fbf130cde1ce49667501d80bdddb0d4211))
* Update CodeQL workflow to v3 and resolve configuration conflicts ([7b74edc](https://github.com/nipunap/vscode-kafka-client/commit/7b74edc4d2427cda364abf7de017814bdb9caa06))


### ♻️ Code Refactoring

* Remove standalone ACL view section ([c61bea9](https://github.com/nipunap/vscode-kafka-client/commit/c61bea9e1a2732556d54debca165f7857a206d1d))


### 📝 Documentation

* Update SECURITY.md for v0.5.0 release ([2c48fbe](https://github.com/nipunap/vscode-kafka-client/commit/2c48fbeaf6ab6cde0519cabe5d3990473e07079e))

## [0.4.0](https://github.com/nipunap/vscode-kafka-client/compare/v0.3.0...v0.4.0) (2025-10-08)


### ✨ Features

* Add comprehensive ACL management functionality ([dba189a](https://github.com/nipunap/vscode-kafka-client/commit/dba189a4e9974541c393e29180d729c8bc0b57d7))
* Improve ACL error handling and HTML help ([51f6ad7](https://github.com/nipunap/vscode-kafka-client/commit/51f6ad7e68a25124fe7729de9b4aad093222a696))


### 🐛 Bug Fixes

* Improve ACL provider error handling ([88cc1b3](https://github.com/nipunap/vscode-kafka-client/commit/88cc1b331535af9928ff92cb96027a105bc7a459))


### ♻️ Code Refactoring

* Add service layer for better separation of concerns ([9ca3fa3](https://github.com/nipunap/vscode-kafka-client/commit/9ca3fa3ac5c93e9e672855a3760cfc144e7f1335))
* Complete architectural improvements ([6bd97db](https://github.com/nipunap/vscode-kafka-client/commit/6bd97db2d7291c459517a4a024b3b5497f597a3d))
* Implement architectural improvements ([2849215](https://github.com/nipunap/vscode-kafka-client/commit/284921580be60b4421d6be9f574885ae38413f92))


### 📝 Documentation

* Streamline README and add screenshots section ([5f6f03f](https://github.com/nipunap/vscode-kafka-client/commit/5f6f03f1ae308f7d48101890cc5ccc80665aba57))

## [0.3.0](https://github.com/nipunap/vscode-kafka-client/compare/v0.2.0...v0.3.0) (2025-10-07)


### ✨ Features

* add cluster discovery for MSK SASL/SCRAM and TLS auth ([70d4542](https://github.com/nipunap/vscode-kafka-client/commit/70d4542b6858a468d0f6e6ad9ec957555c91578f))
* add MSK TLS authentication support ([4a7053b](https://github.com/nipunap/vscode-kafka-client/commit/4a7053b75c8965de67e95f8041c28ac0aa51a19d))
* integrate CredentialManager and ConnectionPool into KafkaClientManager ([b7ccd29](https://github.com/nipunap/vscode-kafka-client/commit/b7ccd291c1abf826d499a12aab961fba7b1cb368))


### 🐛 Bug Fixes

* regex syntax error in webview causing form to break ([5fe3297](https://github.com/nipunap/vscode-kafka-client/commit/5fe32972e52d258773ff0529ed014e6571ab6a58))


### ♻️ Code Refactoring

* complete infrastructure integration - providers and error handling ([f8831dd](https://github.com/nipunap/vscode-kafka-client/commit/f8831dd3cd35b5c33abd3b5d6015a2aedf31b51b))
* implement architectural improvements for better maintainability ([476fc0d](https://github.com/nipunap/vscode-kafka-client/commit/476fc0d75449f1a469922ec30cb643772864a5bf))

## [0.2.1](https://github.com/nipunap/vscode-kafka-client/compare/v0.2.0...v0.2.1) (2025-10-07)


### 🐛 Bug Fixes

* regex syntax error in webview causing form to break ([5fe3297](https://github.com/nipunap/vscode-kafka-client/commit/5fe32972e52d258773ff0529ed014e6571ab6a58))

## [0.2.0](https://github.com/nipunap/vscode-kafka-client/compare/v0.1.4...v0.2.0) (2025-10-06)


### ✨ Features

* add broker management and enhanced configuration views ([18b08cc](https://github.com/nipunap/vscode-kafka-client/commit/18b08ccd15b4ffd0a0bc3b7940c389fc92192e1e))
* add interactive cluster dashboard with parallel data loading ([b444d80](https://github.com/nipunap/vscode-kafka-client/commit/b444d80d9750dd82d681333bee01eb1f25be9ab9))

## [0.1.4](https://github.com/nipunap/vscode-kafka-client/compare/v0.1.3...v0.1.4) (2025-10-05)


### 🐛 Bug Fixes

* remove VSIX from GitHub releases to avoid immutable release error ([d24b425](https://github.com/nipunap/vscode-kafka-client/commit/d24b425b0529d4ac93d033d45340acb3fb41d4b3))

## [0.1.3](https://github.com/nipunap/vscode-kafka-client/compare/v0.1.2...v0.1.3) (2025-10-05)


### 🐛 Bug Fixes

* Make GitHub release creation idempotent ([7482af1](https://github.com/nipunap/vscode-kafka-client/commit/7482af1ae2d08c2466332690b0607a0a83a07fec))

## [0.1.2](https://github.com/nipunap/vscode-kafka-client/compare/v0.1.1...v0.1.2) (2025-10-05)


### 🐛 Bug Fixes

* Publish pre-built VSIX to marketplace instead of re-packaging ([e31d21f](https://github.com/nipunap/vscode-kafka-client/commit/e31d21fb5d7c64571775c01e644da795d27b336c))

## [0.1.1](https://github.com/nipunap/vscode-kafka-client/compare/v0.1.0...v0.1.1) (2025-10-05)


### 🐛 Bug Fixes

* add missing file changes ([0bcb539](https://github.com/nipunap/vscode-kafka-client/commit/0bcb539dcf34d491e6a9f5f51d37824fa8922fde))
* Bundle extension with esbuild and remove unused variable ([d82fdc2](https://github.com/nipunap/vscode-kafka-client/commit/d82fdc2808a448d86e0861ddc38346c6b1a82cd7))
* Support both bundled and unbundled packaging ([6035f43](https://github.com/nipunap/vscode-kafka-client/commit/6035f43f7db99e1a543d1fed943d68665fd6536a))
* Use out/extension.js for development/testing, dist for production ([670309a](https://github.com/nipunap/vscode-kafka-client/commit/670309a9bf6485d11029b88e14621d28a0c73dae))

## [0.1.0](https://github.com/nipunap/vscode-kafka-client/compare/v0.0.3...v0.1.0) (2025-10-05)


### ✨ Features

* Add comprehensive error handling, token caching, and UI improvements ([5d522f0](https://github.com/nipunap/vscode-kafka-client/commit/5d522f069dbd0c6c947f8f1d8c9dd5e555c203ce))


### 🐛 Bug Fixes

* remove out/* ([e939bab](https://github.com/nipunap/vscode-kafka-client/commit/e939babd55a60674080141ed866f2b5c1cc67480))
* tslib errors ([52a944e](https://github.com/nipunap/vscode-kafka-client/commit/52a944ebf43e693c6c6dc072f984a1c13c4d0f28))

## [0.0.4](https://github.com/nipunap/vscode-kafka-client/compare/v0.0.3...v0.0.4) (2025-10-05)


### 🐛 Bug Fixes

* remove out/* ([e939bab](https://github.com/nipunap/vscode-kafka-client/commit/e939babd55a60674080141ed866f2b5c1cc67480))
* tslib errors ([52a944e](https://github.com/nipunap/vscode-kafka-client/commit/52a944ebf43e693c6c6dc072f984a1c13c4d0f28))

## [0.0.3](https://github.com/nipunap/vscode-kafka-client/compare/v0.0.2...v0.0.3) (2025-10-05)


### 🐛 Bug Fixes

* properly check AZURE_TOKEN secret availability ([7103d33](https://github.com/nipunap/vscode-kafka-client/commit/7103d336be8d827837360146bae44e8cd4ce927d))

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
