// @ts-check
const { defineConfig } = require('tsup');

/** @type {import('tsup').Options} */
const config = {
  entry: {
    // Map generated files to root of dist
    'client-entities': 'src/generated/client-entities.ts',
    'server-entities': 'src/generated/server-entities.ts',
    'comment-operations': 'src/generated/comment-operations.ts',
    'project-operations': 'src/generated/project-operations.ts',
    'statusdefinition-operations': 'src/generated/statusdefinition-operations.ts',
    'statusset-operations': 'src/generated/statusset-operations.ts',
    'tag-operations': 'src/generated/tag-operations.ts',
    'tagset-operations': 'src/generated/tagset-operations.ts',
    'task-operations': 'src/generated/task-operations.ts',
    'user-operations': 'src/generated/user-operations.ts',
    'crud-operations': 'src/generated/crud-operations.ts',
    'dexie-schema': 'src/generated/dexie-schema.ts',
    'dexie-domain/index': 'src/generated/dexie-domain/index.ts',
    'dexie-domain/comment-dexie-service': 'src/generated/dexie-domain/comment-dexie-service.ts',
    'dexie-domain/project-dexie-service': 'src/generated/dexie-domain/project-dexie-service.ts',
    'dexie-domain/statusdefinition-dexie-service': 'src/generated/dexie-domain/statusdefinition-dexie-service.ts',
    'dexie-domain/statusset-dexie-service': 'src/generated/dexie-domain/statusset-dexie-service.ts',
    'dexie-domain/tag-dexie-service': 'src/generated/dexie-domain/tag-dexie-service.ts',
    'dexie-domain/tagset-dexie-service': 'src/generated/dexie-domain/tagset-dexie-service.ts',
    'dexie-domain/task-dexie-service': 'src/generated/dexie-domain/task-dexie-service.ts',
    'dexie-domain/user-dexie-service': 'src/generated/dexie-domain/user-dexie-service.ts',
    // Entity files
    'entities/Account': 'src/entities/Account.ts',
    'entities/BaseDomainEntity': 'src/entities/BaseDomainEntity.ts',
    'entities/BaseSystemEntity': 'src/entities/BaseSystemEntity.ts',
    'entities/ChangeHistory': 'src/entities/ChangeHistory.ts',
    'entities/ClientMigration': 'src/entities/ClientMigration.ts',
    'entities/ClientMigrationStatus': 'src/entities/ClientMigrationStatus.ts',
    'entities/Comment': 'src/entities/Comment.ts',
    'entities/JWKS': 'src/entities/JWKS.ts',
    'entities/LocalChanges': 'src/entities/LocalChanges.ts',
    'entities/Project': 'src/entities/Project.ts',
    'entities/Session': 'src/entities/Session.ts',
    'entities/StatusDefinition': 'src/entities/StatusDefinition.ts',
    'entities/StatusSet': 'src/entities/StatusSet.ts',
    'entities/SyncMetadata': 'src/entities/SyncMetadata.ts',
    'entities/Tag': 'src/entities/Tag.ts',
    'entities/TagSet': 'src/entities/TagSet.ts',
    'entities/Task': 'src/entities/Task.ts',
    'entities/User': 'src/entities/User.ts',
    'entities/Verification': 'src/entities/Verification.ts',
    'entities/index': 'src/entities/index.ts',
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
  // Run after build to fix imports
  async onSuccess() {
    const { promises: fs } = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    
    console.log('Fixing import paths in generated files...');
    
    // Use sed to fix all JS files
    try {
      execSync('find dist -name "*.js" -type f -exec sed -i \'s|from "../entities/|from "./entities/|g\' {} \\;', {
        cwd: __dirname,
        stdio: 'inherit'
      });
      console.log('Fixed import paths in all JS files');
    } catch (e) {
      console.error('Failed to fix imports:', e);
    }
  },
  // Skip these dependencies entirely
  noExternal: [],
  external: ['fsevents']
};

module.exports = defineConfig(config); 