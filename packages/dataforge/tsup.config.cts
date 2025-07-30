// @ts-check
const { defineConfig } = require('tsup');

/** @type {import('tsup').Options} */
const config = {
  entry: [
    'src/generated/client-entities.ts', 
    'src/generated/server-entities.ts', 
    'src/generated/column-configurations.ts',
    'src/generated/rdg-column-configurations.ts',
    'src/generated/vibegridx-columns.ts',
    'src/generated/*-operations.ts',
    'src/generated/dexie-schema.ts',
    'src/generated/dexie-domain-services.ts',
    'src/generated/dexie-domain/*.ts'
  ],
  format: ['esm'],
  dts: false, // Skip type generation due to circular references
  clean: true,
  platform: 'node',
  target: 'es2020',
  bundle: false,  // Don't bundle dependencies
  splitting: false,
  treeshake: false,
  minify: false,
  sourcemap: false,
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