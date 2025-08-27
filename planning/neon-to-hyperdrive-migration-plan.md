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

### Phase 2: Create Hyperdrive-Compatible Kysely Dialect

#### 2.1 Create New Dialect Package
Create `/packages/kysely-hyperdrive/` with:

```typescript
// packages/kysely-hyperdrive/src/hyperdrive-dialect.ts
import { Dialect, DialectAdapter, Driver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { Pool } from 'pg';

export interface HyperdriveDialectConfig {
  hyperdrive: Hyperdrive;
  // Optional: for local development fallback
  localConnectionString?: string;
}

export class HyperdriveDialect implements Dialect {
  private config: HyperdriveDialectConfig;

  constructor(config: HyperdriveDialectConfig) {
    this.config = config;
  }

  createDriver(): Driver {
    return new HyperdriveDriver(this.config);
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

#### 2.2 Create Hyperdrive Driver
```typescript
// packages/kysely-hyperdrive/src/hyperdrive-driver.ts
import { Driver, CompiledQuery, DatabaseConnection } from 'kysely';
import { Pool, Client } from 'pg';

export class HyperdriveDriver implements Driver {
  private pool: Pool | null = null;
  private config: HyperdriveDialectConfig;

  constructor(config: HyperdriveDialectConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const connectionString = this.config.hyperdrive.connectionString;
    
    this.pool = new Pool({
      connectionString,
      max: 5, // Cloudflare Workers limit
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 10000,
    });
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const client = await this.pool!.connect();
    return new HyperdriveConnection(client);
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('BEGIN'));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('COMMIT'));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('ROLLBACK'));
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    await (connection as HyperdriveConnection).release();
  }

  async destroy(): Promise<void> {
    await this.pool?.end();
  }
}
```

### Phase 3: Update Database Connection Logic

#### 3.1 Update Kysely Instance
```typescript
// apps/server/src/lib/kysely.ts
import { Kysely } from 'kysely';
import { HyperdriveDialect } from 'kysely-hyperdrive';
import { NeonHTTPDialect } from 'kysely-neon-http';
import type { Env } from '../types/env';

let kyselyInstance: Kysely<Database> | null = null;

export function getKysely(env: Env): Kysely<Database> {
  if (kyselyInstance) {
    return kyselyInstance;
  }
  
  // Use Hyperdrive if available, fallback to Neon
  if (env.HYPERDRIVE_DB) {
    kyselyInstance = new Kysely<Database>({
      dialect: new HyperdriveDialect({
        hyperdrive: env.HYPERDRIVE_DB,
      }),
      log: (event) => {
        // ... existing logging ...
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
        // ... existing logging ...
      }
    });
  }
  
  return kyselyInstance;
}
```

#### 3.2 Update Direct Client Usage
```typescript
// apps/server/src/lib/db.ts
import { Client } from 'pg';
import { Client as NeonClient, neonConfig } from '@neondatabase/serverless';
import type { Env } from '../types/env';

export const getDBClient = (c: AppContext | MinimalContext | { env: Env }) => {
  const env = 'env' in c ? c.env : undefined;
  
  // Use Hyperdrive if available
  if (env?.HYPERDRIVE_DB) {
    return new Client({
      connectionString: env.HYPERDRIVE_DB.connectionString,
    });
  }
  
  // Fallback to Neon
  const url = env?.DATABASE_URL;
  if (!url) {
    throw new Error('No database connection available');
  }
  
  // ... existing Neon configuration ...
  return new NeonClient({ connectionString: url });
};
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

## Configuration Changes Summary

### Environment Variables
- Remove: `DATABASE_URL` (after full migration)
- Remove: `NEON_API_KEY`
- Add: Hyperdrive connection managed via wrangler.toml

### Package Dependencies
```json
// Add to apps/server/package.json
{
  "dependencies": {
    "pg": "^8.16.3",
    "kysely-hyperdrive": "workspace:*"
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