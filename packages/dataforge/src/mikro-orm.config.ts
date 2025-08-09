import { defineConfig, UnderscoreNamingStrategy } from '@mikro-orm/postgresql';
import * as entities from './entities/index.js';

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

export default defineConfig({
  entities: Object.values(entities),
  dbName: 'vibestack_dev',
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  discovery: {
    warnWhenNoEntities: false,
  },
  namingStrategy: PluralNamingStrategy,
});