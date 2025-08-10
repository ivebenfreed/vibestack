import { defineConfig, UnderscoreNamingStrategy } from '@mikro-orm/postgresql';
import * as entities from './entities/index.js';

// Custom naming strategy that uses plural table names but singular column names
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

  // Override to use singular form for junction table column names
  joinKeyColumnName(entityName: string, referencedColumnName?: string): string {
    // MikroORM passes the table name here (already pluralized via classToTableName)
    // We need to convert it back to singular for the column name
    let singular = entityName;
    
    // Convert plural back to singular
    if (entityName === 'tasks') singular = 'task';
    else if (entityName === 'tags') singular = 'tag';
    else if (entityName === 'tag_sets') singular = 'tag_set';
    else if (entityName === 'status_sets') singular = 'status_set';
    else if (entityName === 'projects') singular = 'project';
    else if (entityName === 'status_definitions') singular = 'status_definition';
    else if (entityName.endsWith('ies') && entityName.length > 3) {
      singular = entityName.slice(0, -3) + 'y';
    } else if (entityName.endsWith('es') && (entityName.endsWith('xes') || entityName.endsWith('ches') || entityName.endsWith('shes'))) {
      singular = entityName.slice(0, -2);
    } else if (entityName.endsWith('s') && !entityName.endsWith('ss') && !entityName.includes('_')) {
      singular = entityName.slice(0, -1);
    }
    
    // Now use the parent method with the singular form
    return super.joinKeyColumnName(singular, referencedColumnName);
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