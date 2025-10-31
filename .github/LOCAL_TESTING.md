# Local Workflow Testing Guide

## Overview

Testing GitHub Actions workflows locally before pushing can save time and prevent failed CI runs. This guide covers multiple approaches.

---

## ⚡ Quick Test (Recommended)

Use the included test script that simulates most workflow steps:

```bash
# Make script executable (first time only)
chmod +x .github/workflows/test-release-local.sh

# Run the test
./.github/workflows/test-release-local.sh

# Or test a specific version
./.github/workflows/test-release-local.sh 0.0.2
```

### What It Tests

✅ **Tested Locally:**
- Version format validation (semver)
- Version increment check (must be greater)
- Duplicate version check (already tagged)
- Required files existence
- JSON file validation
- Linting
- TypeScript compilation
- Extension packaging
- VSIX file validation (size, structure, version)
- Changelog entry check

❌ **Skipped Locally (GitHub-only):**
- Dependency review (requires GitHub API)
- Full security scan (super-linter)
- Actual marketplace publishing
- GitHub Release creation

---

## 🐳 Full Test with Act

[Act](https://github.com/nektos/act) runs GitHub Actions workflows locally using Docker.

### Installation

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (with Chocolatey)
choco install act-cli
```

### Usage

```bash
# Test the release workflow
act push --job version-check

# Test with secrets (won't actually publish)
act push --secret-file .secrets \
  --job build

# Dry run (see what would execute)
act push --dryrun
```

### Create `.secrets` file (for testing):

```bash
# .secrets (git-ignored)
GITHUB_TOKEN=ghp_your_test_token
AZURE_TOKEN=test_token
OPEN_VSX_ACCESS_TOKEN=test_token
```

### Limitations of Act

⚠️ Some actions don't work perfectly with Act:
- `lewagon/wait-on-check-action` (uses GitHub API)
- `actions/dependency-review-action` (requires GitHub infrastructure)
- Publishing actions (requires real credentials)

**Solution:** These steps have `continue-on-error: true` so Act can proceed.

---

## 🔍 Validate Workflow Syntax

### Using GitHub CLI

```bash
# Install gh (if not already)
brew install gh

# Validate workflow file
gh workflow view publish-release.yml
```

### Using actionlint

```bash
# Install
brew install actionlint

# Validate
actionlint .github/workflows/publish-release.yml
```

### Using VS Code Extension

Install: [GitHub Actions](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-github-actions)

Features:
- Syntax highlighting
- Autocomplete
- Inline validation
- Workflow visualization

---

## 🧪 Manual Step-by-Step Testing

### 1. Version Check

```bash
# Check current version
node -p "require('./package.json').version"

# Check last tag
git describe --tags --abbrev=0

# Validate semver format
npx semver 1.2.3  # Should output: 1.2.3

# Test version comparison
npx semver -r ">1.0.0" 1.2.3  # Should output: 1.2.3
```

### 2. Linting

```bash
npm run lint
```

### 3. Build & Compile

```bash
npm ci
npm run compile

# Check output
ls -la out/extension.js
```

### 4. Package Extension

```bash
# If you have a package script
npm run package

# Or use vsce directly
npm install -g @vscode/vsce
vsce package
```

### 5. Validate VSIX

```bash
# List contents
unzip -l *.vsix

# Extract and inspect
unzip *.vsix -d /tmp/vsix-test
cat /tmp/vsix-test/extension/package.json

# Check size
du -h *.vsix
```

### 6. Test Install Locally

```bash
# Install in VS Code
code --install-extension vscode-kafka-*.vsix

# Test the extension
# (Open VS Code and try the Kafka features)

# Uninstall
code --uninstall-extension nipunap.vscode-kafka
```

---

## 🚀 Testing the Full Release Process

### Option 1: Test Branch

```bash
# Create test branch
git checkout -b test-release

# Bump version
npm version patch --no-git-tag-version

# Update changelog
echo "## [0.0.2] - $(date +%Y-%m-%d)" >> CHANGELOG.md
echo "- Test release" >> CHANGELOG.md

# Commit
git add package.json CHANGELOG.md
git commit -m "chore(release): v0.0.2 [test]"

# Push to test branch (won't trigger release)
git push origin test-release

# Create PR and watch CI run
# Don't merge to main unless you want to actually release
```

### Option 2: Fork & Test

```bash
# Fork the repository
# Clone your fork
git clone https://github.com/YOUR_USERNAME/vscode-kafka-client.git

# Make changes
npm version patch

# Push to YOUR fork's main branch
git push origin main

# Watch the workflow run in YOUR repository
# No impact on the original repository
```

### Option 3: Disable Publishing (Dry Run)

Temporarily remove the marketplace secrets:

1. Go to: Settings → Secrets → Actions
2. Delete (or rename) `AZURE_TOKEN` and `OPEN_VSX_ACCESS_TOKEN`
3. Push version bump to main
4. Workflow will run but skip publishing steps
5. Restore secrets after testing

---

## 📋 Pre-Release Checklist

Run through this before any release:

```bash
# 1. Update version
npm version [patch|minor|major]

# 2. Update CHANGELOG.md
# Add section for new version with changes

# 3. Run local tests
./.github/workflows/test-release-local.sh

# 4. Test VSIX locally
code --install-extension *.vsix

# 5. Commit and push
git add package.json CHANGELOG.md
git commit -m "chore(release): v$(node -p 'require(\"./package.json\").version')"
git push origin main

# 6. Monitor workflow
# Visit: https://github.com/nipunap/vscode-kafka-client/actions
```

---

## 🐛 Troubleshooting

### "No VSIX file found"

```bash
# Check if package script exists
npm run package --if-present

# Try vsce directly
npm install -g @vscode/vsce
vsce package

# Check for errors in compile step
npm run compile
```

### "Invalid semantic version"

```bash
# Version must be X.Y.Z
node -p "require('./package.json').version"

# Fix if needed
npm version 1.0.0 --no-git-tag-version
```

### "Linting failed"

```bash
# See specific errors
npm run lint

# Auto-fix if possible
npm run lint -- --fix
```

### "Version already tagged"

```bash
# Check existing tags
git tag -l

# If you need to re-release (not recommended):
# Delete local tag
git tag -d v1.0.0

# Delete remote tag (DANGEROUS)
git push origin :refs/tags/v1.0.0
```

---

## 🔄 CI/CD vs Local Testing

| Aspect | Local Testing | GitHub Actions |
|--------|---------------|----------------|
| **Speed** | ⚡ Instant | 5-10 minutes |
| **Cost** | 🆓 Free | 🆓 Free (with limits) |
| **Security Scan** | ⚠️ Basic | ✅ Full (super-linter) |
| **Dependency Review** | ❌ No | ✅ Yes |
| **Marketplace Publish** | ❌ Manual | ✅ Automated |
| **Artifact Upload** | ❌ N/A | ✅ Yes |
| **Parallel Jobs** | ❌ No | ✅ Yes |
| **Rollback** | ❌ Manual | ✅ Automated |

**Recommendation:** Use local testing for quick feedback, then rely on GitHub Actions for the full release.

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Act Documentation](https://github.com/nektos/act)
- [vsce Documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## 💡 Best Practices

1. **Always test locally first** - Catches 90% of issues
2. **Use meaningful version bumps** - Follow semver
3. **Update CHANGELOG.md** - Document changes
4. **Test the VSIX** - Install and use it before releasing
5. **Monitor the workflow** - Watch for failures
6. **Keep secrets safe** - Never commit secrets
7. **Use test branches** - For risky changes
8. **Review logs** - Learn from failures

---

## 🎯 Quick Reference

```bash
# Test everything locally
./.github/workflows/test-release-local.sh

# Build and package
npm ci && npm run compile && npm run package

# Validate VSIX
unzip -l *.vsix && code --install-extension *.vsix

# Check version
node -p "require('./package.json').version"

# Validate workflow syntax
actionlint .github/workflows/publish-release.yml

# Test with act (full simulation)
act push --job build
```

---

**Remember:** Local testing catches issues early, but the full GitHub Actions workflow is the source of truth for releases. 🚀
