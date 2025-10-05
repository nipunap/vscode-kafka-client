#!/usr/bin/env node

/**
 * Package script that bundles the extension and temporarily switches to dist/extension.js
 * for the production VSIX, while keeping out/extension.js for development/testing.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

console.log('📦 Building bundled extension...\n');

try {
    // Step 1: Build the bundle
    console.log('1️⃣ Running esbuild bundle...');
    execSync('npm run bundle', { stdio: 'inherit' });
    
    // Step 2: Read package.json
    console.log('\n2️⃣ Temporarily switching to bundled version...');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const originalMain = packageJson.main;
    
    // Step 3: Temporarily change main to dist
    packageJson.main = './dist/extension.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('   main: "./out/extension.js" → "./dist/extension.js"');
    
    try {
        // Step 4: Package with vsce
        console.log('\n3️⃣ Packaging VSIX with bundled code...');
        execSync('vsce package --no-update-package-json', { stdio: 'inherit' });
        console.log('\n✅ Package created successfully!');
    } finally {
        // Step 5: Always restore original main
        console.log('\n4️⃣ Restoring package.json...');
        packageJson.main = originalMain;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log('   main: "./dist/extension.js" → "./out/extension.js"');
    }
    
    console.log('\n🎉 Done! Extension packaged with bundled code.');
    console.log('   Development/testing will continue to use ./out/extension.js');
    
} catch (error) {
    console.error('\n❌ Error during packaging:', error.message);
    process.exit(1);
}
