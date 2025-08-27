# Migration Plan: Neon Proxy to Cloudflare Hyperdrive

## Executive Summary
Migrate from Neon's HTTP/WebSocket proxy to Cloudflare Hyperdrive for database connections while maintaining Kysely as the query builder. This migration will provide better performance through Hyperdrive's global connection pooling and query caching.

## Current Architecture Analysis

### Database Connection Points
1. **Kysely Instance** (`/apps/server/src/lib/kysely.ts`)
   - Uses custom `kysely-neon-http` package with `NeonHTTPDialect`
   - Auto-detects local development from connection string
   - Singleton pattern for connection reuse

2. **Direct Client Usage** (`/apps/server/src/lib/db.ts`)
   - Uses `@neondatabase/serverless` Client
   - Configures neonConfig for local proxy (port 4444)
   - Used for raw SQL queries and health checks

3. **Better Auth Integration**
   - Uses Kysely adapter with database connection
   - Session storage optionally uses KV (USE_KV_SESSIONS flag)

### Key Dependencies
- `@neondatabase/serverless`: ^1.0.1
- `kysely-neon-http`: Custom package in `/packages/`
- `kysely`: Via kysely-neon-http package

## Migration Strategy

### Phase 1: Infrastructure Setup

#### 1.1 Create Hyperdrive Configuration
```bash
# Create Hyperdrive config for each environment
wrangler hyperdrive create vibestack-db-prod --connection-string="<PROD_DB_URL>"
wrangler hyperdrive create vibestack-db-staging --connection-string="<STAGING_DB_URL>"
```

#### 1.2 Update wrangler.toml
```toml
# Add to wrangler.toml
[[hyperdrive]]
binding = "HYPERDRIVE_DB"
id = "<hyperdrive-config-id>"

# For local development
[[hyperdrive]]
binding = "HYPERDRIVE_DB"
id = "<hyperdrive-config-id>"
localConnectionString = "postgres://user:password@localhost:5432/vibestack"
```

#### 1.3 Update Environment Types
```typescript
// apps/server/src/types/env.ts
export interface Env {
  // ... existing fields ...
  
  // Add Hyperdrive binding
  HYPERDRIVE_DB: Hyperdrive;
  
  // Keep DATABASE_URL for backwards compatibility during migration
  DATABASE_URL: string;
}
```

### Phase 2: Driver Selection and Dialect Strategy

#### 2.1 Driver Comparison Analysis

**postgres.js vs pg driver for Hyperdrive:**

| Aspect | postgres.js | node-postgres (pg) |
|--------|-------------|-------------------|
| **Minimum Version** | 3.4.5+ | 8.16.3+ |
| **Performance** | Faster with auto-prepared statements | Good with manual prepared statement config |
| **Bundle Size** | Smaller, more modern | Larger, mature ecosystem |
| **Features** | Real-time subscriptions, lazy connections | Robust ecosystem, wide adoption |
| **Cloudflare Workers** | Native support, optimal for serverless | Requires nodejs_compat flag |
| **Existing Kysely Support** | `kysely-postgres-js` package available | Built-in `PostgresDialect` |

**Recommendation: postgres.js** for the following reasons:
- Better performance with automatic prepared statements
- Smaller bundle size for Workers environment
- Native Cloudflare Workers compatibility
- Existing `kysely-postgres-js` dialect available

#### 2.2 Implementation Strategy Options

**Option A: Use Existing kysely-postgres-js with Hyperdrive**
```typescript
// apps/server/src/lib/kysely.ts
import { Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

export function getKysely(env: Env): Kysely<Database> {
  if (kyselyInstance) return kyselyInstance;
  
  if (env.HYPERDRIVE_DB) {
    const sql = postgres(env.HYPERDRIVE_DB.connectionString, {
      max: 5, // Cloudflare Workers connection limit
      fetch_types: false, // Reduce latency
    });
    
    kyselyInstance = new Kysely<Database>({
      dialect: new PostgresJSDialect({ postgres: sql }),
      log: (event) => { /* existing logging */ }
    });
  }
  // ... fallback to Neon
}
```

**Option B: Create Custom Hyperdrive Dialect**
Create `/packages/kysely-hyperdrive/` for more control:

```typescript
// packages/kysely-hyperdrive/src/hyperdrive-dialect.ts
import { Dialect, DialectAdapter, Driver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import postgres from 'postgres';

export interface HyperdriveDialectConfig {
  hyperdrive: Hyperdrive;
  // postgres.js specific options
  options?: {
    max?: number;
    fetch_types?: boolean;
    prepare?: boolean;
  };
}

export class HyperdriveDialect implements Dialect {
  private config: HyperdriveDialectConfig;

  constructor(config: HyperdriveDialectConfig) {
    this.config = config;
  }

  createDriver(): Driver {
    return new PostgresJSHyperdriveDriver(this.config);
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
```

#### 2.3 Recommended Implementation: Option A with postgres.js

**Rationale:** Use existing `kysely-postgres-js` package for faster implementation and proven compatibility.

```typescript
// packages/kysely-hyperdrive/src/postgres-js-hyperdrive-driver.ts
import postgres from 'postgres';

export class PostgresJSHyperdriveDriver implements Driver {
  private sql: postgres.Sql;
  private config: HyperdriveDialectConfig;

  constructor(config: HyperdriveDialectConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.sql = postgres(this.config.hyperdrive.connectionString, {
      max: this.config.options?.max || 5, // Cloudflare Workers limit
      fetch_types: this.config.options?.fetch_types || false, // Reduce latency
      prepare: this.config.options?.prepare !== false, // Enable prepared statements
      idle_timeout: 0,
      connect_timeout: 10,
      ...this.config.options,
    });
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return new PostgresJSConnection(this.sql);
  }

  // ... standard transaction methods using postgres.js APIs
}

export class PostgresJSConnection implements DatabaseConnection {
  constructor(private sql: postgres.Sql) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql: queryText, parameters } = compiledQuery;
    
    try {
      // postgres.js automatically handles prepared statements
      const result = await this.sql.unsafe(queryText, parameters as any[]);
      
      return {
        rows: result as R[],
        numAffectedRows: BigInt(result.count || 0),
      };
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    _chunkSize?: number
  ): AsyncIterableIterator<QueryResult<R>> {
    // postgres.js supports streaming via cursor
    const result = await this.executeQuery<R>(compiledQuery);
    yield result;
  }
}
```

#### 2.4 Package Dependencies Update

```json
// Add to apps/server/package.json
{
  "dependencies": {
    "postgres": "^3.4.5",
    "kysely-postgres-js": "^2.0.0"
  }
}

// Remove after migration
{
  "dependencies": {
    "@neondatabase/serverless": "^1.0.1",
    "kysely-neon-http": "workspace:*"
  }
}
```

### Phase 3: Update Database Connection Logic

#### 3.1 Update Kysely Instance
```typescript
// apps/server/src/lib/kysely.ts
import { Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import { NeonHTTPDialect } from 'kysely-neon-http';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';

let kyselyInstance: Kysely<Database> | null = null;

export function getKysely(env: Env): Kysely<Database> {
  if (kyselyInstance) {
    return kyselyInstance;
  }
  
  // Use Hyperdrive with postgres.js if available
  if (env.HYPERDRIVE_DB) {
    const sql = postgres(env.HYPERDRIVE_DB.connectionString, {
      max: 5, // Cloudflare Workers connection limit
      fetch_types: false, // Reduce latency for better performance
      prepare: true, // Enable prepared statements for performance
      idle_timeout: 0, // Don't disconnect idle connections
      connect_timeout: 10, // 10 second connection timeout
    });
    
    kyselyInstance = new Kysely<Database>({
      dialect: new PostgresJSDialect({ postgres: sql }),
      log: (event) => {
        if (event.level === 'query') {
          console.log('🔍 KYSELY QUERY (Hyperdrive):', event.query.sql);
          console.log('📝 PARAMETERS:', event.query.parameters);
          dbLogger.debug('Kysely Hyperdrive Query', {
            sql: event.query.sql,
            parameters: event.query.parameters,
            duration: event.queryDurationMillis
          }, 'kysely-hyperdrive');
        } else if (event.level === 'error') {
          console.log('❌ KYSELY HYPERDRIVE ERROR:', event.error);
          dbLogger.error('Kysely Hyperdrive Error', event.error, undefined, 'kysely-hyperdrive');
        }
      }
    });
  } else {
    // Fallback to existing Neon implementation
    kyselyInstance = new Kysely<Database>({
      dialect: new NeonHTTPDialect({
        connectionString: env.DATABASE_URL,
        debug: env.LOG_LEVEL === 'debug',
      }),
      log: (event) => {
        if (event.level === 'query') {
          console.log('🔍 KYSELY QUERY (Neon):', event.query.sql);
          console.log('📝 PARAMETERS:', event.query.parameters);
          dbLogger.debug('Kysely Neon Query', {
            sql: event.query.sql,
            parameters: event.query.parameters,
            duration: event.queryDurationMillis
          }, 'kysely-neon');
        } else if (event.level === 'error') {
          console.log('❌ KYSELY NEON ERROR:', event.error);
          dbLogger.error('Kysely Neon Error', event.error, undefined, 'kysely-neon');
        }
      }
    });
  }
  
  return kyselyInstance;
}
```

#### 3.2 Update Direct Client Usage

**Option A: Migrate to postgres.js for consistency**
```typescript
// apps/server/src/lib/db.ts
import postgres from 'postgres';
import { Client as NeonClient, neonConfig } from '@neondatabase/serverless';
import type { Env } from '../types/env';

// Create postgres.js client with Hyperdrive
export const getPostgresClient = (c: AppContext | MinimalContext | { env: Env }) => {
  const env = 'env' in c ? c.env : undefined;
  
  if (env?.HYPERDRIVE_DB) {
    return postgres(env.HYPERDRIVE_DB.connectionString, {
      max: 5,
      fetch_types: false,
      prepare: true,
      idle_timeout: 0,
    });
  }
  
  // Fallback to Neon for raw SQL operations
  const url = env?.DATABASE_URL;
  if (!url) {
    throw new Error('No database connection available');
  }
  
  // Return postgres.js client with Neon URL for consistency
  return postgres(url, {
    max: 5,
    prepare: true,
  });
};

// Wrapper for backwards compatibility
export const sql = async <T extends QueryResultRow = QueryResultRow>(
  c: AppContext | MinimalContext,
  query: string,
  params: any[] = []
): Promise<T[]> => {
  const client = getPostgresClient(c);
  try {
    const result = await client.unsafe(query, params);
    return result as T[];
  } catch (error) {
    console.error('SQL query error:', error);
    throw error;
  }
};
```

**Option B: Keep hybrid approach with both drivers**
```typescript
// apps/server/src/lib/db.ts
import postgres from 'postgres';
import { Client as NeonClient, neonConfig } from '@neondatabase/serverless';
import type { Env } from '../types/env';

export const getDBClient = (c: AppContext | MinimalContext | { env: Env }) => {
  const env = 'env' in c ? c.env : undefined;
  
  // Use postgres.js with Hyperdrive if available
  if (env?.HYPERDRIVE_DB) {
    return {
      type: 'postgres-js',
      client: postgres(env.HYPERDRIVE_DB.connectionString, {
        max: 5,
        fetch_types: false,
        prepare: true,
      }),
    };
  }
  
  // Fallback to existing Neon setup
  const url = env?.DATABASE_URL;
  if (!url) {
    throw new Error('No database connection available');
  }
  
  // ... existing Neon configuration ...
  return {
    type: 'neon',
    client: new NeonClient({ connectionString: url }),
  };
};

export async function sql<T extends QueryResultRow = QueryResultRow>(
  c: AppContext | MinimalContext,
  query: string,
  params: any[] = []
): Promise<T[]> {
  const dbConnection = getDBClient(c);
  
  if (dbConnection.type === 'postgres-js') {
    const result = await dbConnection.client.unsafe(query, params);
    return result as T[];
  } else {
    // Existing Neon logic
    const client = dbConnection.client;
    try {
      await client.connect();
      const result = await client.query<T>(query, params);
      return result.rows;
    } finally {
      try {
        await client.end();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}
```

### Phase 4: Testing Strategy

#### 4.1 Local Testing
1. Set up local PostgreSQL database
2. Configure Hyperdrive with local connection string
3. Test all database operations:
   - CRUD operations via Kysely
   - Raw SQL queries
   - Transaction handling
   - Connection pooling

#### 4.2 Staging Environment Testing
1. Deploy to staging with Hyperdrive binding
2. Run comprehensive test suite:
   - Authentication flows
   - Data sync operations
   - Replication features
   - Performance benchmarks

#### 4.3 Performance Comparison
- Measure query latency before/after
- Monitor connection pool utilization
- Check cache hit rates in Hyperdrive dashboard

### Phase 5: Rollout Plan

#### 5.1 Gradual Migration
1. **Week 1**: Deploy dual-mode support (Hyperdrive + Neon fallback)
2. **Week 2**: Enable Hyperdrive in staging environment
3. **Week 3**: Enable for 10% of production traffic
4. **Week 4**: Gradual rollout to 100% production

#### 5.2 Rollback Strategy
- Keep Neon configuration as fallback
- Environment variable to force Neon usage
- Quick revert via wrangler.toml update

### Phase 6: Cleanup

#### 6.1 Remove Neon Dependencies
- Remove `@neondatabase/serverless` package
- Archive `kysely-neon-http` package
- Clean up neonConfig references

#### 6.2 Update Documentation
- Update README with Hyperdrive setup
- Document local development setup
- Update deployment guides

## Updated Configuration Changes Summary

### Driver Decision: postgres.js
**Selected postgres.js over node-postgres (pg) for:**
- Better performance with automatic prepared statements
- Smaller bundle size for Cloudflare Workers
- Native serverless environment support
- Existing `kysely-postgres-js` dialect available
- Optimal for Hyperdrive integration

### Environment Variables
- Remove: `DATABASE_URL` (after full migration)
- Remove: `NEON_API_KEY`
- Add: Hyperdrive connection managed via wrangler.toml

### Package Dependencies
```json
// Add to apps/server/package.json
{
  "dependencies": {
    "postgres": "^3.4.5",
    "kysely-postgres-js": "^2.0.0"
  }
}

// Remove after migration
{
  "dependencies": {
    "@neondatabase/serverless": "^1.0.1",
    "kysely-neon-http": "workspace:*"
  }
}
```

### Wrangler Configuration
```toml
# Add Hyperdrive binding
[[hyperdrive]]
binding = "HYPERDRIVE_DB"
id = "<your-hyperdrive-id>"

# Remove after migration
# DATABASE_URL from .dev.vars
```

## Benefits of Migration

1. **Performance**
   - Global connection pooling
   - Query result caching
   - Reduced connection overhead
   - Lower latency for global users

2. **Cost**
   - Reduced database connections
   - Lower database CPU usage
   - Potential cost savings on database tier

3. **Reliability**
   - Automatic connection retry
   - Built-in connection pooling
   - Better handling of connection limits

4. **Developer Experience**
   - Simpler configuration
   - Native Cloudflare Workers integration
   - Better local development support

## Risks and Mitigations

### Risk 1: Compatibility Issues
- **Mitigation**: Extensive testing in staging, gradual rollout

### Risk 2: Performance Regression
- **Mitigation**: Performance benchmarking, rollback plan

### Risk 3: Connection Pool Exhaustion
- **Mitigation**: Configure pool size limits, monitoring

## Timeline

- **Week 1**: Infrastructure setup and dialect development
- **Week 2**: Integration and local testing
- **Week 3**: Staging deployment and testing
- **Week 4**: Production rollout (gradual)
- **Week 5**: Monitoring and optimization
- **Week 6**: Cleanup and documentation

## Success Metrics

1. Query latency reduction: Target 30% improvement
2. Connection pool efficiency: >80% reuse rate
3. Zero downtime during migration
4. Cache hit rate: >60% for read queries
5. Cost reduction: 20% on database resources

## Next Steps

1. ✅ Research completed
2. ✅ Migration plan created
3. ⏳ Get approval for Hyperdrive setup
4. ⏳ Create Hyperdrive configurations
5. ⏳ Develop kysely-hyperdrive package
6. ⏳ Test in staging environment
7. ⏳ Deploy to production