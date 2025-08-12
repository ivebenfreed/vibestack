import {
  Dialect,
  DialectAdapter,
  Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { NeonHTTPDriver } from './drivers/neon-http-driver';
import type { NeonHTTPDialectConfig } from './types';

export class NeonHTTPDialect implements Dialect {
  private config: NeonHTTPDialectConfig;

  constructor(config: NeonHTTPDialectConfig) {
    this.config = config;
  }

  createDriver(): Driver {
    return new NeonHTTPDriver(this.config);
  }

  createAdapter(): DialectAdapter {
    return new PostgresAdapter();
  }

  createIntrospector(db: Kysely<any>): PostgresIntrospector {
    return new PostgresIntrospector(db);
  }

  createQueryCompiler(): PostgresQueryCompiler {
    return new PostgresQueryCompiler();
  }
}