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
  dts: {
    // Skip type generation for dexie-domain files to avoid circular reference issues
    entry: [
      'src/generated/client-entities.ts', 
      'src/generated/server-entities.ts', 
      'src/generated/column-configurations.ts',
      'src/generated/rdg-column-configurations.ts',
      'src/generated/vibegridx-columns.ts',
      'src/generated/comment-operations.ts',
      'src/generated/project-operations.ts',
      'src/generated/statusdefinition-operations.ts',
      'src/generated/statusset-operations.ts',
      'src/generated/tag-operations.ts',
      'src/generated/tagset-operations.ts',
      'src/generated/task-operations.ts',
      'src/generated/user-operations.ts',
      'src/generated/crud-operations.ts',
      'src/generated/dexie-schema.ts',
      'src/generated/dexie-domain-services.ts'
    ]
  },
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
    'dexie',
  ],
  treeshake: false,
  esbuildOptions(options: import('esbuild').BuildOptions) {
    options.tsconfig = 'tsconfig.json';
  }
};

module.exports = defineConfig(config); 