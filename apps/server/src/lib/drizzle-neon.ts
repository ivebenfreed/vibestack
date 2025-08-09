/**
 * Drizzle ORM setup with Neon for proof of concept
 * This uses the HTTP adapter which is compatible with latest @neondatabase/serverless
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@repo/dataforge/drizzle-schema';

// Get database URL from environment
const getDatabaseUrl = () => {
  // Use the same logic as existing TypeORM setup
  const envPrefix = process.env.NODE_ENV === 'production' ? 'PROD' :
                    process.env.NODE_ENV === 'preview' ? 'STAGING' :
                    'DEV';
  
  const databaseUrl = process.env[`DATABASE_URL_${envPrefix}`] || 
                      process.env.DATABASE_URL ||
                      process.env.DEV_DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('No database URL found in environment variables');
  }
  
  return databaseUrl;
};

// Create Neon HTTP client
const sql = neon(getDatabaseUrl());

// Create Drizzle instance with schema
export const drizzleDb = drizzle(sql, { schema });

// Export schema for type inference
export { schema };