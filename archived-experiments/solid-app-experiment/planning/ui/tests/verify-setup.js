#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying UI Test Setup...\n');

// Check directory structure
const requiredDirs = [
  'playwright',
  'playwright/auth',
  'playwright/dashboard',
  'playwright/entities',
  'playwright/organization',
  'playwright/settings',
  'playwright/fixtures',
  'playwright/helpers',
  'playwright/screenshots',
  'unit',
  'integration',
  'e2e',
  'config',
];

const requiredFiles = [
  'package.json',
  'README.md',
  'TEST_STRUCTURE.md',
  'config/playwright.config.ts',
  'config/global-setup.ts',
  'config/global-teardown.ts',
  'playwright/helpers/test-utils.ts',
  'playwright/fixtures/auth-context.ts',
  'playwright/auth/signin.spec.ts',
];

let allChecksPass = true;

console.log('📁 Checking directory structure:');
for (const dir of requiredDirs) {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${dir}/`);
  } else {
    console.log(`  ❌ ${dir}/ - Missing`);
    allChecksPass = false;
  }
}

console.log('\n📄 Checking required files:');
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    const size = (stats.size / 1024).toFixed(2);
    console.log(`  ✅ ${file} (${size} KB)`);
  } else {
    console.log(`  ❌ ${file} - Missing`);
    allChecksPass = false;
  }
}

// Check package.json scripts
console.log('\n📦 Checking package.json scripts:');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
const requiredScripts = [
  'test',
  'test:playwright',
  'test:playwright:ui',
  'test:unit',
  'test:e2e',
];

for (const script of requiredScripts) {
  if (packageJson.scripts && packageJson.scripts[script]) {
    console.log(`  ✅ ${script}: "${packageJson.scripts[script]}"`);
  } else {
    console.log(`  ❌ ${script} - Missing`);
    allChecksPass = false;
  }
}

// Check dependencies
console.log('\n📚 Checking dependencies:');
const requiredDeps = [
  '@playwright/test',
  'vitest',
];

for (const dep of requiredDeps) {
  const hasDep = 
    (packageJson.dependencies && packageJson.dependencies[dep]) ||
    (packageJson.devDependencies && packageJson.devDependencies[dep]);
  
  if (hasDep) {
    const version = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
    console.log(`  ✅ ${dep}: ${version}`);
  } else {
    console.log(`  ❌ ${dep} - Not installed`);
    allChecksPass = false;
  }
}

// Summary
console.log('\n' + '='.repeat(50));
if (allChecksPass) {
  console.log('✅ All checks passed! Test setup is complete.');
  console.log('\nNext steps:');
  console.log('1. Install dependencies: pnpm install');
  console.log('2. Install browsers: pnpm install:browsers');
  console.log('3. Run tests: pnpm test:playwright');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please fix the issues above.');
  console.log('\nTo fix missing directories:');
  console.log('  mkdir -p ' + requiredDirs.filter(d => !fs.existsSync(path.join(__dirname, d))).join(' '));
  process.exit(1);
}