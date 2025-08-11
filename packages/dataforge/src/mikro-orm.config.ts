import { defineConfig, UnderscoreNamingStrategy } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { TSMigrationGenerator } from '@mikro-orm/migrations';
import * as entities from './entities/index.js';

// Simple naming strategy that just converts to snake_case without pluralization
class SimpleNamingStrategy extends UnderscoreNamingStrategy {
  classToTableName(entityName: string): string {
    // Just convert to snake_case, no pluralization
    return entityName.replace(/([A-Z])/g, (match, letter, index) => 
      index === 0 ? letter.toLowerCase() : `_${letter.toLowerCase()}`
    );
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
  namingStrategy: SimpleNamingStrategy,  // Use simple singular naming
  metadataProvider: TsMorphMetadataProvider,
  metadataCache: { 
    enabled: true,
    pretty: true,
  },
  connect: false, // Don't auto-connect to database
  migrations: {
    path: './src/migrations',
    pathTs: './src/migrations',
    glob: '!(*.d).{js,ts}',
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    safe: true,
    emit: 'ts',
    generator: TSMigrationGenerator,
  },
});