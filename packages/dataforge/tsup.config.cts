// @ts-check
const { defineConfig } = require('tsup');

/** @type {import('tsup').Options} */
const config = {
  entry: {
    // Map generated files to root of dist
    'client-entities': 'src/generated/client-entities.ts',
    'server-entities': 'src/generated/server-entities.ts',
    'crud-operations': 'src/generated/crud-operations.ts',
    'dexie-schema': 'src/generated/dexie-schema.ts',
    'dexie-domain/index': 'src/generated/dexie-domain/index.ts',
    // Dexie domain services
    'dexie-domain/comment-dexie-service': 'src/generated/dexie-domain/comment-dexie-service.ts',
    'dexie-domain/entitydependency-dexie-service': 'src/generated/dexie-domain/entitydependency-dexie-service.ts',
    'dexie-domain/project-dexie-service': 'src/generated/dexie-domain/project-dexie-service.ts',
    'dexie-domain/statusdefinition-dexie-service': 'src/generated/dexie-domain/statusdefinition-dexie-service.ts',
    'dexie-domain/statusset-dexie-service': 'src/generated/dexie-domain/statusset-dexie-service.ts',
    'dexie-domain/tag-dexie-service': 'src/generated/dexie-domain/tag-dexie-service.ts',
    'dexie-domain/tagset-dexie-service': 'src/generated/dexie-domain/tagset-dexie-service.ts',
    'dexie-domain/task-dexie-service': 'src/generated/dexie-domain/task-dexie-service.ts',
    'dexie-domain/user-dexie-service': 'src/generated/dexie-domain/user-dexie-service.ts',
    // Utils files
    'utils/context': 'src/utils/context.ts',
    'utils/decorators': 'src/utils/decorators.ts',
    'utils/metadata-extraction': 'src/utils/metadata-extraction.ts',
    'utils/metadata-filter': 'src/utils/metadata-filter.ts',
    'utils/table-category': 'src/utils/table-category.ts',
    'utils/table-registry': 'src/utils/table-registry.ts',
    'utils/validation': 'src/utils/validation.ts'
  },
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