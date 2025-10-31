#!/bin/bash
#
# Local Release Workflow Testing Script
#
# This script simulates the release workflow steps locally
# without requiring GitHub Actions infrastructure.
#
# Usage:
#   ./test-release-local.sh [version]
#
# Example:
#   ./test-release-local.sh 0.0.2
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧪 Local Release Workflow Test"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test version (optional argument)
TEST_VERSION="${1:-}"

# ============================================================================
# Step 1: Version Check
# ============================================================================
echo "📋 Step 1: Version Check"
echo "------------------------"

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version in package.json: $CURRENT_VERSION"

if [ -n "$TEST_VERSION" ]; then
    if [ "$CURRENT_VERSION" != "$TEST_VERSION" ]; then
        echo -e "${YELLOW}⚠️  Version mismatch: package.json has $CURRENT_VERSION but you specified $TEST_VERSION${NC}"
        echo "Update package.json first: npm version $TEST_VERSION --no-git-tag-version"
        exit 1
    fi
fi

# Get last tag
LAST_TAG=$(git describe --tags --abbrev=0 --match "v*.*.*" 2>/dev/null || echo "v0.0.0")
PREVIOUS_VERSION=${LAST_TAG#v}
echo "Previous version (from tags): $PREVIOUS_VERSION"

# Validate semver
if ! npx --yes semver "$CURRENT_VERSION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Invalid semantic version format: $CURRENT_VERSION${NC}"
    exit 1
fi

# Check if already tagged
if git rev-parse "v$CURRENT_VERSION" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Version v$CURRENT_VERSION already tagged${NC}"
    echo "This would skip the release in the actual workflow"
fi

# Check version increment
if [ "$PREVIOUS_VERSION" != "0.0.0" ]; then
    if ! npx --yes semver -r ">$PREVIOUS_VERSION" "$CURRENT_VERSION" >/dev/null 2>&1; then
        echo -e "${RED}❌ Version $CURRENT_VERSION must be greater than $PREVIOUS_VERSION${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Version check passed${NC}"
echo ""

# ============================================================================
# Step 2: Security Scan (Simplified)
# ============================================================================
echo "🔒 Step 2: Security Scan (Simplified)"
echo "--------------------------------------"

# Check for package.json and required files
REQUIRED_FILES=("package.json" "tsconfig.json" "README.md" "LICENSE")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Required file missing: $file${NC}"
        exit 1
    fi
done

# Validate JSON files
echo "Validating JSON files..."
for json_file in package.json tsconfig.json; do
    if ! node -e "JSON.parse(require('fs').readFileSync('$json_file', 'utf8'))" 2>/dev/null; then
        echo -e "${RED}❌ Invalid JSON: $json_file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Basic security checks passed${NC}"
echo -e "${YELLOW}ℹ️  Note: Full super-linter scan only runs in GitHub Actions${NC}"
echo ""

# ============================================================================
# Step 3: Dependency Review (Skipped Locally)
# ============================================================================
echo "📦 Step 3: Dependency Review"
echo "-----------------------------"
echo -e "${YELLOW}⏭️  Skipped (requires GitHub Dependency Graph API)${NC}"
echo "   This step only runs in GitHub Actions"
echo ""

# ============================================================================
# Step 4: Build & Package
# ============================================================================
echo "🔨 Step 4: Build & Package"
echo "---------------------------"

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci
fi

# Run linter
echo "Running linter..."
if ! npm run lint 2>&1 | grep -q "error" ; then
    echo -e "${GREEN}✅ Linting passed${NC}"
else
    echo -e "${RED}❌ Linting failed${NC}"
    npm run lint
    exit 1
fi

# Compile TypeScript
echo "Compiling TypeScript..."
if ! npm run compile; then
    echo -e "${RED}❌ Compilation failed${NC}"
    exit 1
fi

if [ ! -f "out/extension.js" ]; then
    echo -e "${RED}❌ Compilation output missing: out/extension.js${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Compilation successful${NC}"

# Package extension
echo "Packaging extension..."
if [ -f "*.vsix" ]; then
    rm -f *.vsix
fi

# Check if package script exists
if npm run package --if-present 2>&1 | grep -q "Missing script"; then
    echo "No package script found, using vsce directly..."
    if ! command -v vsce &> /dev/null; then
        echo "Installing vsce..."
        npm install -g @vscode/vsce
    fi
    vsce package
else
    npm run package
fi

echo -e "${GREEN}✅ Packaging successful${NC}"
echo ""

# ============================================================================
# Step 5: VSIX Validation
# ============================================================================
echo "✅ Step 5: VSIX Validation"
echo "---------------------------"

# Find VSIX file
VSIX_FILE=$(find . -maxdepth 1 -name "*.vsix" -type f | head -n 1)

if [ -z "$VSIX_FILE" ]; then
    echo -e "${RED}❌ No VSIX file found${NC}"
    exit 1
fi

VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" -type f | wc -l)
if [ "$VSIX_COUNT" -gt 1 ]; then
    echo -e "${YELLOW}⚠️  Multiple VSIX files found ($VSIX_COUNT), using: $VSIX_FILE${NC}"
    find . -maxdepth 1 -name "*.vsix" -type f
fi

# File size check
FILE_SIZE=$(stat -f%z "$VSIX_FILE" 2>/dev/null || stat -c%s "$VSIX_FILE")
FILE_SIZE_MB=$((FILE_SIZE / 1024 / 1024))
echo "📦 VSIX package: $VSIX_FILE (${FILE_SIZE_MB}MB)"

if [ "$FILE_SIZE" -lt 1024 ]; then
    echo -e "${RED}❌ VSIX too small (< 1KB), likely corrupted${NC}"
    exit 1
fi

if [ "$FILE_SIZE" -gt 104857600 ]; then
    echo -e "${RED}❌ VSIX too large (> 100MB), exceeds marketplace limits${NC}"
    exit 1
fi

if [ "$FILE_SIZE_MB" -gt 50 ]; then
    echo -e "${YELLOW}⚠️  VSIX is large (${FILE_SIZE_MB}MB), consider optimization${NC}"
fi

# Structure validation
echo "Validating VSIX structure..."
if ! unzip -l "$VSIX_FILE" | grep -q "extension/package.json"; then
    echo -e "${RED}❌ Invalid VSIX: missing extension/package.json${NC}"
    exit 1
fi

if ! unzip -l "$VSIX_FILE" | grep -q "extension.vsixmanifest"; then
    echo -e "${RED}❌ Invalid VSIX: missing extension.vsixmanifest${NC}"
    exit 1
fi

# Version validation
unzip -p "$VSIX_FILE" "extension/package.json" > /tmp/vsix-package.json
VSIX_VERSION=$(node -p "require('/tmp/vsix-package.json').version")

if [ "$VSIX_VERSION" != "$CURRENT_VERSION" ]; then
    echo -e "${RED}❌ Version mismatch: VSIX=$VSIX_VERSION, expected=$CURRENT_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✅ VSIX validation passed${NC}"
echo ""

# ============================================================================
# Step 6: Changelog Check
# ============================================================================
echo "📝 Step 6: Changelog Check"
echo "---------------------------"

if [ ! -f "CHANGELOG.md" ]; then
    echo -e "${YELLOW}⚠️  CHANGELOG.md not found${NC}"
else
    if grep -q "\[$CURRENT_VERSION\]" CHANGELOG.md; then
        echo -e "${GREEN}✅ CHANGELOG.md has entry for v$CURRENT_VERSION${NC}"
    else
        echo -e "${YELLOW}⚠️  CHANGELOG.md missing entry for v$CURRENT_VERSION${NC}"
    fi
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 All Local Tests Passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
echo "  Version: $CURRENT_VERSION"
echo "  Previous: $PREVIOUS_VERSION"
echo "  VSIX: $VSIX_FILE (${FILE_SIZE_MB}MB)"
echo ""
echo "✅ Ready to release!"
echo ""
echo "Next steps:"
echo "  1. Commit version bump: git add package.json CHANGELOG.md"
echo "  2. Commit: git commit -m \"chore(release): v$CURRENT_VERSION\""
echo "  3. Push to main: git push origin main"
echo "  4. GitHub Actions will handle the rest automatically"
echo ""
echo "Or test the VSIX locally:"
echo "  code --install-extension $VSIX_FILE"
echo ""
