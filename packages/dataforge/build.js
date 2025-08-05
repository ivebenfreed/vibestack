#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function build() {
  console.log('Building with tsc...');
  
  // Use tsc to compile TypeScript files
  try {
    execSync('tsc --outDir dist --module esnext --target es2020 --declaration false src/generated/**/*.ts', {
      stdio: 'inherit',
      cwd: __dirname
    });
    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

build().catch(console.error);