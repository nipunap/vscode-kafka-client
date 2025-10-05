#!/usr/bin/env node

/**
 * Package script that bundles the extension and temporarily switches to dist/extension.js
 * for the production VSIX, while keeping out/extension.js for development/testing.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const vscodeignorePath = path.join(__dirname, '..', '.vscodeignore');

console.log('📦 Building bundled extension...\n');

try {
    // Step 1: Build the bundle
    console.log('1️⃣ Running esbuild bundle...');
    execSync('npm run bundle', { stdio: 'inherit' });

    // Step 2: Read package.json
    console.log('\n2️⃣ Temporarily switching to bundled version...');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const originalMain = packageJson.main;

    // Step 3: Read and modify .vscodeignore to exclude out/
    const originalVscodeignore = fs.readFileSync(vscodeignorePath, 'utf8');
    const modifiedVscodeignore = originalVscodeignore.replace(
        /# Build artifacts\n# Note: out\/ is kept for development builds.*?out\/test\/\*\*/s,
        '# Build artifacts\nout/**'
    );
    fs.writeFileSync(vscodeignorePath, modifiedVscodeignore);
    console.log('   Temporarily excluding out/ from VSIX');

    // Step 4: Temporarily change main to dist
    packageJson.main = './dist/extension.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('   main: "./out/extension.js" → "./dist/extension.js"');

    try {
        // Step 5: Package with vsce
        console.log('\n3️⃣ Packaging VSIX with bundled code...');
        execSync('vsce package --no-update-package-json', { stdio: 'inherit' });
        console.log('\n✅ Package created successfully!');
    } finally {
        // Step 6: Always restore original files
        console.log('\n4️⃣ Restoring package.json and .vscodeignore...');
        packageJson.main = originalMain;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        fs.writeFileSync(vscodeignorePath, originalVscodeignore);
        console.log('   main: "./dist/extension.js" → "./out/extension.js"');
        console.log('   Restored .vscodeignore');
    }

    console.log('\n🎉 Done! Extension packaged with bundled code.');
    console.log('   Development/testing will continue to use ./out/extension.js');

} catch (error) {
    console.error('\n❌ Error during packaging:', error.message);
    process.exit(1);
}
