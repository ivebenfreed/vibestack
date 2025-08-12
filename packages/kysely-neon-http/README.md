# kysely-neon-http

Modern Kysely dialect for Neon serverless PostgreSQL over HTTP, optimized for edge environments and serverless functions. Built for `@neondatabase/serverless` v1.0+.

## Features

- 🚀 **Pure HTTP connections** - Perfect for edge workers and serverless
- 🔄 **Auto-routing** - Automatically uses pooler for queries, direct for DDL
- 🏠 **Local development support** - Auto-detects local Neon proxy
- 📊 **Full metadata extraction** - Proper `numAffectedRows` support
- 🔧 **Zero configuration** - Works out of the box with sensible defaults
- 💪 **TypeScript native** - Full type safety and IntelliSense
- ⚡ **Optimized for Neon** - Leverages Neon's serverless architecture

## Why kysely-neon-http?

- **Replaces deprecated `kysely-neon`** - Full compatibility with `@neondatabase/serverless` v1.0+
- **Auto-routing** - Intelligently routes DDL to direct endpoints, queries to pooler
- **Zero config local dev** - Automatically detects and configures local proxy
- **Edge-optimized** - No WebSocket dependencies, pure HTTP for edge runtimes
- **Smaller bundle** - ~10KB vs ~16KB for original package

## Installation

```bash
npm install kysely-neon-http
# or
yarn add kysely-neon-http
# or
pnpm add kysely-neon-http
```

## Usage

```typescript
import { Kysely } from 'kysely';
import { NeonHTTPDialect } from 'kysely-neon-http';

const db = new Kysely<Database>({
  dialect: new NeonHTTPDialect({
    connectionString: process.env.DATABASE_URL,
    // That's it! Auto-routing and local dev detection included
  }),
});

// DDL automatically uses direct connection
await db.schema
  .createTable('users')
  .addColumn('id', 'serial', col => col.primaryKey())
  .addColumn('email', 'varchar', col => col.notNull())
  .execute();

// Queries automatically use pooler connection
const users = await db.selectFrom('users').selectAll().execute();
```

## Configuration

### Basic (recommended)

```typescript
new NeonHTTPDialect({
  connectionString: process.env.DATABASE_URL,
})
```

### Advanced Options

```typescript
new NeonHTTPDialect({
  connectionString: process.env.DATABASE_URL,
  
  // Auto-detect local development (default: true)
  autoDetect: true,
  
  // Auto-route queries to pooler, DDL to direct (default: true)
  autoRouting: true,
  
  // Local proxy settings (auto-detected)
  localProxyPort: 4444,
  localProxyPath: '/sql',
  
  // Enable debug logging
  debug: process.env.NODE_ENV === 'development',
  
  // Custom Neon configuration
  neonConfig: {
    fetchConnectionCache: true,
  },
})
```

## Auto-Routing

The dialect intelligently routes queries to the appropriate Neon endpoint:

| Query Type | Endpoint | Examples |
|------------|----------|----------|
| DDL | Direct | CREATE, ALTER, DROP, TRUNCATE |
| DML | Pooler | SELECT, INSERT, UPDATE, DELETE |
| System | Direct | VACUUM, ANALYZE, REINDEX |

Provide either a pooler or direct endpoint - the dialect handles routing automatically:

```typescript
// Using pooler endpoint
const db = new Kysely<Database>({
  dialect: new NeonHTTPDialect({
    connectionString: 'postgresql://user@ep-name-pooler.region.neon.tech/db',
  }),
});

// Or using direct endpoint
const db = new Kysely<Database>({
  dialect: new NeonHTTPDialect({
    connectionString: 'postgresql://user@ep-name.region.neon.tech/db',
  }),
});
```

## Local Development

Local connections are automatically detected and configured:

```typescript
// These are all auto-detected as local:
const db = new Kysely<Database>({
  dialect: new NeonHTTPDialect({
    connectionString: 'postgres://user@db.localtest.me:5432/db',
    // Automatically uses http://db.localtest.me:4444/sql
  }),
});
```

## Edge Runtime Support

Perfect for Cloudflare Workers, Vercel Edge Functions, and Deno Deploy:

```typescript
// Cloudflare Worker
export default {
  async fetch(request: Request, env: Env) {
    const db = new Kysely<Database>({
      dialect: new NeonHTTPDialect({
        connectionString: env.DATABASE_URL,
      }),
    });
    
    const users = await db.selectFrom('users').selectAll().execute();
    return Response.json(users);
  },
};
```

## Limitations

HTTP connections are stateless, so these features are not supported:

- ❌ **Transactions** - Use batch operations instead
- ❌ **Advisory locks** - Use application-level locking
- ❌ **LISTEN/NOTIFY** - Use polling or webhooks
- ❌ **Cursors** - Use pagination with LIMIT/OFFSET

These are architectural limitations of HTTP connections, not bugs.

## Comparison with kysely-neon

| Feature | kysely-neon | kysely-neon-http |
|---------|------------|------------------|
| Neon SDK | 0.6.x | 1.0+ |
| Auto-routing | ❌ | ✅ |
| Local auto-config | ❌ | ✅ |
| Metadata extraction | Limited | Full |
| WebSocket support | ✅ | ❌ (HTTP only) |
| Edge optimized | Limited | Full |
| Bundle size | ~16KB | ~10KB |
| Maintenance | Deprecated | Active |

## Migration Guide

```typescript
// From kysely-neon (deprecated)
import { NeonDialect } from 'kysely-neon';
const db = new Kysely<Database>({
  dialect: new NeonDialect({ connectionString }),
});

// To kysely-neon-http
import { NeonHTTPDialect } from 'kysely-neon-http';
const db = new Kysely<Database>({
  dialect: new NeonHTTPDialect({ connectionString }),
});
```

## Performance

- **Auto-routing optimization**: DDL operations use direct connections only when needed
- **Metadata caching**: Connection metadata is cached after first query
- **Minimal overhead**: ~10KB bundle size, no unnecessary dependencies
- **Fast cold starts**: Optimized for serverless with minimal initialization

### Best Practices

1. **Use batch operations** to reduce HTTP requests
2. **Use RETURNING clauses** to get data in single round-trip
3. **Let auto-routing work** - don't manually separate endpoints
4. **Cache at the edge** for frequently accessed data

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Credits

Built for [Neon](https://neon.tech) serverless PostgreSQL.  
Compatible with [Kysely](https://kysely.dev) SQL query builder.

## License

MIT