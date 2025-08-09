// @ts-check
const { defineConfig } = require('tsup');
const fs = require('fs');
const path = require('path');

/**
 * Dynamically discover entry points from src/generated/
 */
function getEntryPoints() {
  const entries = {};
  
  // Core generated files (always include these)
  const coreFiles = [
    'client-entities',
    'server-entities', 
    'dexie-schema',
    'drizzle-schema'
  ];
  
  for (const file of coreFiles) {
    const srcPath = `src/generated/${file}.ts`;
    if (fs.existsSync(srcPath)) {
      entries[file] = srcPath;
    }
  }
  
  // Utils files
  const utilsDir = 'src/utils';
  if (fs.existsSync(utilsDir)) {
    const utilsFiles = fs.readdirSync(utilsDir).filter(f => f.endsWith('.ts'));
    for (const file of utilsFiles) {
      const name = file.replace('.ts', '');
      entries[`utils/${name}`] = `${utilsDir}/${file}`;
    }
  }
  
  // Dynamically discover all *-operations.ts files
  const generatedDir = 'src/generated';
  if (fs.existsSync(generatedDir)) {
    const generatedFiles = fs.readdirSync(generatedDir);
    
    // Operation files
    const operationFiles = generatedFiles.filter(f => f.endsWith('-operations.ts'));
    for (const file of operationFiles) {
      const name = file.replace('.ts', '');
      entries[name] = `${generatedDir}/${file}`;
    }
    
    // Dexie domain directory
    const dexieDomainDir = path.join(generatedDir, 'dexie-domain');
    if (fs.existsSync(dexieDomainDir)) {
      // Index file
      const indexFile = path.join(dexieDomainDir, 'index.ts');
      if (fs.existsSync(indexFile)) {
        entries['dexie-domain/index'] = 'src/generated/dexie-domain/index.ts';
      }
      
      // Service files
      const serviceFiles = fs.readdirSync(dexieDomainDir).filter(f => f.endsWith('-dexie-service.ts'));
      for (const file of serviceFiles) {
        const name = file.replace('.ts', '');
        entries[`dexie-domain/${name}`] = `${dexieDomainDir}/${file}`;
      }
    }
  }
  
  return entries;
}

/** @type {import('tsup').Options} */
const config = {
  entry: getEntryPoints(),
  format: ['esm'],
  dts: false, // Use separate tsc for DTS generation
  clean: true,
  platform: 'node',
  target: 'es2020',
  bundle: false,  // Don't bundle dependencies
  splitting: false,
  treeshake: false,
  minify: false,
  sourcemap: false,
  swc: false, // Disable SWC to avoid native binding issues
  esbuildOptions(options: import('esbuild').BuildOptions) {
    options.tsconfig = 'tsconfig.json';
    // Skip platform-specific optional dependencies
    options.platform = 'node';
    options.loader = {
      '.node': 'empty'
    };
  },
  // Skip these dependencies entirely
  noExternal: [],
  external: ['fsevents']
};

module.exports = defineConfig(config);