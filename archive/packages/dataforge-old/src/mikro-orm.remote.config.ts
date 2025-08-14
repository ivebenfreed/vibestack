import { defineConfig, UnderscoreNamingStrategy } from '@mikro-orm/postgresql';
import * as entities from './entities/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Custom naming strategy that uses plural table names
class PluralNamingStrategy extends UnderscoreNamingStrategy {
  classToTableName(entityName: string): string {
    // Convert entity name to underscore
    const underscored = super.classToTableName(entityName);
    
    // Special cases - these are already effectively plural
    if (['local_changes', 'sync_metadata', 'change_history'].includes(underscored)) {
      return underscored;
    }
    
    // Don't pluralize if already ends with 's'
    if (underscored.endsWith('s')) {
      return underscored;
    }
    
    // Simple pluralization rules
    if (underscored.endsWith('y') && !underscored.endsWith('ay') && !underscored.endsWith('ey') && !underscored.endsWith('oy') && !underscored.endsWith('uy')) {
      return underscored.slice(0, -1) + 'ies';
    } else if (underscored.endsWith('x') || underscored.endsWith('ch') || underscored.endsWith('sh')) {
      return underscored + 'es';
    } else {
      return underscored + 's';
    }
  }
}

// Remote Neon database configuration
export default defineConfig({
  entities: Object.values(entities),
  clientUrl: 'postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  driverOptions: {
    connection: {
      ssl: true
    }
  },
  discovery: {
    warnWhenNoEntities: false,
  },
  namingStrategy: PluralNamingStrategy,
  migrations: {
    tableName: 'mikro_orm_migrations',
    path: join(__dirname, 'migrations'),
    pathTs: join(__dirname, 'migrations'),
    glob: '!(*.d).{js,ts}',
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    dropTables: false,
    safe: true,
    snapshot: true,
    emit: 'ts',
  },
  schemaGenerator: {
    disableForeignKeys: false,
    createForeignKeyConstraints: true,
  },
});