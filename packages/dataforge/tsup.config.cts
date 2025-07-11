// @ts-check
const { defineConfig } = require('tsup');

/** @type {import('tsup').Options} */
const config = {
  entry: [
    'src/index.ts', 
    'src/generated/client-entities.ts', 
    'src/generated/server-entities.ts', 
    'src/generated/column-configurations.ts', 
    'src/generated/rdg-column-configurations.ts',
    'src/generated/vibegridx-columns.ts',
    'src/generated/*-operations.ts'
  ],
  format: ['esm'],
  dts: true, // Changed from experimentalDts to generate individual .d.ts files
  clean: true,
  platform: 'node',
  target: 'es2020',
  noExternal: ['./src/**'],
  external: [
    'typeorm',
    'reflect-metadata',
    'class-validator',
    '@electric-sql/pglite',
    'pg',
  ],
  treeshake: false,
  esbuildOptions(options: import('esbuild').BuildOptions) {
    options.tsconfig = 'tsconfig.json';
  }
};

module.exports = defineConfig(config); 