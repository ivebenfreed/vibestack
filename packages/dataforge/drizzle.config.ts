import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.development for initial introspection
dotenv.config({ path: path.resolve(__dirname, '.env.development') });

export default {
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  introspect: {
    casing: 'camel', // Convert snake_case to camelCase
  },
  verbose: true,
  strict: true,
} satisfies Config;