#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, description) {
  log(`\n▶ ${description}...`, colors.cyan);
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✓ ${description} completed`, colors.green);
    return true;
  } catch (error) {
    log(`✗ ${description} failed`, colors.red);
    return false;
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✓ ${description} exists`, colors.green);
    return true;
  } else {
    log(`✗ ${description} missing: ${filePath}`, colors.red);
    return false;
  }
}

function main() {
  log('\n╔════════════════════════════════════════════════╗', colors.blue);
  log('║   VS Code Extension Packaging Script          ║', colors.blue);
  log('╚════════════════════════════════════════════════╝\n', colors.blue);

  // Check if vsce is installed
  log('Checking prerequisites...', colors.yellow);
  try {
    execSync('vsce --version', { stdio: 'pipe' });
    log('✓ vsce is installed', colors.green);
  } catch (error) {
    log('✗ vsce is not installed', colors.red);
    log('\nInstall it with: npm install -g @vscode/vsce', colors.yellow);
    process.exit(1);
  }

  // Validate package.json
  log('\nValidating package.json...', colors.yellow);
  const packageJson = require('../package.json');
  
  let hasErrors = false;
  
  if (packageJson.publisher === 'YOUR_PUBLISHER_ID') {
    log('✗ Publisher ID not set in package.json', colors.red);
    log('  Update "publisher" field with your VS Code Marketplace publisher ID', colors.yellow);
    hasErrors = true;
  } else {
    log(`✓ Publisher: ${packageJson.publisher}`, colors.green);
  }

  if (!packageJson.version) {
    log('✗ Version not set', colors.red);
    hasErrors = true;
  } else {
    log(`✓ Version: ${packageJson.version}`, colors.green);
  }

  // Check required files
  log('\nChecking required files...', colors.yellow);
  const iconPath = path.join(__dirname, '..', packageJson.icon || '');
  checkFile(path.join(__dirname, '..', 'README.md'), 'README.md');
  checkFile(path.join(__dirname, '..', 'LICENSE'), 'LICENSE');
  checkFile(path.join(__dirname, '..', 'CHANGELOG.md'), 'CHANGELOG.md');
  
  if (packageJson.icon) {
    if (!checkFile(iconPath, `Icon (${packageJson.icon})`)) {
      log('  ⚠ Icon file missing - package will still be created but won\'t have an icon', colors.yellow);
    }
  }

  if (hasErrors) {
    log('\n✗ Please fix the errors above before packaging', colors.red);
    process.exit(1);
  }

  // Clean previous builds
  log('\nCleaning previous builds...', colors.yellow);
  const outDir = path.join(__dirname, '..', 'out');
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
    log('✓ Cleaned out directory', colors.green);
  }

  // Compile TypeScript
  if (!exec('npm run compile', 'Compiling TypeScript')) {
    process.exit(1);
  }

  // Run linter (non-blocking)
  log('\nRunning linter...', colors.yellow);
  try {
    execSync('npm run lint', { stdio: 'inherit' });
    log('✓ Linting passed', colors.green);
  } catch (error) {
    log('⚠ Linting found issues (non-blocking)', colors.yellow);
  }

  // Package extension
  if (!exec('vsce package', 'Packaging extension')) {
    process.exit(1);
  }

  // Find the created .vsix file
  const files = fs.readdirSync(__dirname + '/..');
  const vsixFile = files.find(f => f.endsWith('.vsix'));
  
  if (vsixFile) {
    const stats = fs.statSync(path.join(__dirname, '..', vsixFile));
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    log('\n╔════════════════════════════════════════════════╗', colors.green);
    log('║          PACKAGING SUCCESSFUL! ✓               ║', colors.green);
    log('╚════════════════════════════════════════════════╝', colors.green);
    log(`\n📦 Package: ${vsixFile}`, colors.cyan);
    log(`📊 Size: ${fileSizeMB} MB`, colors.cyan);
    log(`\n🚀 To install locally:`, colors.yellow);
    log(`   code --install-extension ${vsixFile}`, colors.white);
    log(`\n📤 To publish:`, colors.yellow);
    log(`   npm run publish`, colors.white);
    log(`   or: vsce publish\n`, colors.white);
  } else {
    log('\n⚠ .vsix file not found', colors.yellow);
  }
}

main();

