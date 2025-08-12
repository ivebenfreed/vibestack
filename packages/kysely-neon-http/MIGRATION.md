# Migration Guide: From Custom Adapter to @repo/kysely-neon-http

This guide helps you migrate from the custom `kysely-neon-v1-adapter.ts` to the new `@repo/kysely-neon-http` package.

## Step 1: Install the Package

Add the new package to your server dependencies:

```bash
cd apps/server
pnpm add @repo/kysely-neon-http
```

## Step 2: Update Imports

Replace imports of the custom adapter with the new package:

```typescript
// Old
import { NeonHTTPDialectV1 } from './kysely-neon-v1-adapter';

// New
import { NeonHTTPDialect } from '@repo/kysely-neon-http';
```

## Step 3: Update Dialect Configuration

The new dialect has a cleaner configuration API:

```typescript
// Old
kyselyInstance = new Kysely<Database>({
  dialect: new NeonHTTPDialectV1({ connectionString }),
  // ...
});

// New
kyselyInstance = new Kysely<Database>({
  dialect: new NeonHTTPDialect({
    connectionString,
    fetchEndpoint: isLocal ? 'http://db.localtest.me:4444/sql' : undefined,
    debug: env.DEBUG === 'true',
  }),
  // ...
});
```

## Step 4: Update Neon Configuration

The new package handles Neon configuration internally, but you can still customize it:

```typescript
// Old - Global neonConfig modification
neonConfig.fetchEndpoint = (host) => {
  if (host === 'db.localtest.me') {
    return 'http://db.localtest.me:4444/sql';
  }
  return `https://${host}/sql`;
};

// New - Pass configuration to dialect
const dialect = new NeonHTTPDialect({
  connectionString,
  fetchEndpoint: isLocal ? 'http://db.localtest.me:4444/sql' : undefined,
  neonConfig: {
    fetchFunction: fetch,
    useSecureWebSocket: !isLocal,
  }
});
```

## Step 5: Remove Old Files

After migration, you can remove:
- `apps/server/src/lib/kysely-neon-v1-adapter.ts`
- `apps/server/src/lib/kysely-neon-patch.ts` (if exists)

## Step 6: Update All Import Locations

Search and replace in all files:

```bash
# Find all files using the old adapter
grep -r "kysely-neon-v1-adapter" apps/server/src/

# Files to update:
- apps/server/src/lib/kysely.ts
- apps/server/src/api/bootstrap.ts
- apps/server/src/lib/kysely-query-service.ts
- apps/server/src/sync/server-changes-generic.ts
- apps/server/src/sync/generic-sync-engine.ts
- apps/server/src/replication/process-changes.ts
```

## Benefits of Migration

1. **Maintained Package**: The new package is part of your monorepo and can be easily updated
2. **Multiple Connection Modes**: Choose between HTTP, WebSocket, or pooled connections
3. **Better Error Handling**: More descriptive errors with query context
4. **Streaming Support**: Efficient handling of large result sets
5. **Auto-reconnection**: WebSocket mode handles connection drops gracefully
6. **Cleaner API**: No need for global neonConfig modifications

## Example: Updated kysely.ts

```typescript
import { Kysely } from 'kysely';
import { NeonHTTPDialect } from '@repo/kysely-neon-http';
import type { Env } from '../types/env';
import type { Database } from '@repo/dataforge/kysely-types';

export function getKysely(env: Env): Kysely<Database> {
  const isLocal = env.DATABASE_URL.includes('db.localtest.me') || 
                  env.ENVIRONMENT === "local";
  
  return new Kysely<Database>({
    dialect: new NeonHTTPDialect({
      connectionString: env.DATABASE_URL,
      fetchEndpoint: isLocal ? 'http://db.localtest.me:4444/sql' : undefined,
      debug: env.DEBUG === 'true',
    }),
    log: (event) => {
      // Your existing logging
    }
  });
}
```

## Testing After Migration

1. Run type checking: `pnpm type-check`
2. Test database connections: `pnpm dev`
3. Run your test suite: `pnpm test`
4. Verify local proxy works: Check http://localhost:4444 connections