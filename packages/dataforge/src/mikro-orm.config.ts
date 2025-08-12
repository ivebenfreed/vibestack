import { defineConfig, UnderscoreNamingStrategy } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { TSMigrationGenerator } from '@mikro-orm/migrations';
import * as entities from './entities/index.js';

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
  namingStrategy: UnderscoreNamingStrategy,  // Use default MikroORM naming strategy
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