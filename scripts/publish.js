#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
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

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  log('\n╔════════════════════════════════════════════════╗', colors.magenta);
  log('║   VS Code Extension Publishing Script         ║', colors.magenta);
  log('╚════════════════════════════════════════════════╝\n', colors.magenta);

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

  // Read package.json
  const packageJson = require('../package.json');
  
  log('\nExtension Details:', colors.yellow);
  log(`  Name: ${packageJson.displayName || packageJson.name}`, colors.cyan);
  log(`  Version: ${packageJson.version}`, colors.cyan);
  log(`  Publisher: ${packageJson.publisher}`, colors.cyan);

  if (packageJson.publisher === 'YOUR_PUBLISHER_ID') {
    log('\n✗ Publisher ID not set in package.json', colors.red);
    log('  Please update "publisher" field with your VS Code Marketplace publisher ID', colors.yellow);
    log('  Create one at: https://marketplace.visualstudio.com/manage', colors.cyan);
    process.exit(1);
  }

  // Check for .vsix file
  const vsixFiles = fs.readdirSync('.').filter(f => f.endsWith('.vsix'));
  
  log('\nPublishing Options:', colors.yellow);
  log('  1. Package and publish (recommended)', colors.white);
  log('  2. Publish existing .vsix', colors.white);
  log('  3. Publish from source', colors.white);
  
  const choice = await prompt('\nSelect option (1-3): ');

  if (choice === '1') {
    log('\n📦 Step 1: Packaging extension...', colors.blue);
    if (!exec('npm run package', 'Packaging')) {
      process.exit(1);
    }
  } else if (choice === '2') {
    if (vsixFiles.length === 0) {
      log('\n✗ No .vsix files found. Run "npm run package" first.', colors.red);
      process.exit(1);
    }
    log(`\n📦 Found .vsix files:`, colors.cyan);
    vsixFiles.forEach((file, i) => log(`  ${i + 1}. ${file}`, colors.white));
  }

  // Check if Personal Access Token is available
  log('\n🔑 Authentication Check:', colors.yellow);
  log('  You need a Personal Access Token (PAT) from Azure DevOps', colors.white);
  log('  Create one at: https://dev.azure.com/ (select "Marketplace" scope)', colors.cyan);
  
  const hasPat = await prompt('\nDo you have a PAT ready? (yes/no): ');
  
  if (hasPat.toLowerCase() !== 'yes' && hasPat.toLowerCase() !== 'y') {
    log('\n📝 To create a PAT:', colors.yellow);
    log('  1. Go to https://dev.azure.com/', colors.white);
    log('  2. Click on User Settings > Personal Access Tokens', colors.white);
    log('  3. Create a new token with "Marketplace (Manage)" scope', colors.white);
    log('  4. Save the token securely', colors.white);
    log('\n  Then run: vsce login <publisher-name>', colors.cyan);
    log('  Or run this script again\n', colors.cyan);
    process.exit(0);
  }

  // Confirm publish
  log('\n⚠️  WARNING: This will publish to the VS Code Marketplace!', colors.yellow);
  const confirm = await prompt('Are you sure you want to continue? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    log('\n✗ Publishing cancelled', colors.yellow);
    process.exit(0);
  }

  // Publish
  log('\n📤 Publishing to marketplace...', colors.blue);
  if (exec('vsce publish', 'Publishing extension')) {
    log('\n╔════════════════════════════════════════════════╗', colors.green);
    log('║        PUBLISHING SUCCESSFUL! ✓                ║', colors.green);
    log('╚════════════════════════════════════════════════╝', colors.green);
    log(`\n🎉 Extension published to VS Code Marketplace!`, colors.cyan);
    log(`\n📦 View at: https://marketplace.visualstudio.com/items?itemName=${packageJson.publisher}.${packageJson.name}`, colors.cyan);
    log(`\n⏱️  Note: It may take a few minutes to appear in the marketplace\n`, colors.yellow);
  } else {
    log('\n✗ Publishing failed', colors.red);
    log('\nCommon issues:', colors.yellow);
    log('  • Not logged in: Run "vsce login <publisher-name>"', colors.white);
    log('  • Invalid PAT: Create a new token with "Marketplace" scope', colors.white);
    log('  • Version conflict: Update version in package.json', colors.white);
    log('  • Publisher mismatch: Check publisher ID matches your account\n', colors.white);
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n✗ Error: ${error.message}`, colors.red);
  process.exit(1);
});

