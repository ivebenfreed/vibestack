import { defineConfig } from '@mikro-orm/postgresql';
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
});