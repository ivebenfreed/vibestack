import "reflect-metadata";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import path from "path";
import { fileURLToPath } from 'url';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import client entities dynamically for ESM
import { clientEntities } from "../generated/client-entities.js";

// Import PGlite driver and uuid_ossp extension
import { PGliteDriver } from "typeorm-pglite";
// @ts-ignore - TypeScript doesn't know about this import
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

// Determine the current environment
const currentEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
config({ path: path.resolve(__dirname, `../../.env.${currentEnv}`) });

// Load general .env file (environment-specific variables will take precedence)
config({ path: path.resolve(__dirname, '../../.env'), override: false });

// Create client datasource
// For client-side, we use PGlite instead of regular Postgres
const clientDataSource = new DataSource({
  type: "postgres", // Use postgres type for TypeORM compatibility
  database: `vibestack_client_${currentEnv}`,
  
  // Entities - use pre-generated client entities
  entities: clientEntities,
  
  // Migration settings
  migrations: ["src/migrations/client/*.ts"],
  
  // Use migrations instead of synchronize
  synchronize: false,
  logging: true,
  
  // Use PGlite driver with uuid_ossp extension
  // @ts-ignore - TypeScript doesn't know about PGlite options
  driver: new PGliteDriver({
    extensions: { uuid_ossp },
    dataDir: `./pgdata/${currentEnv}` // Add environment-specific filesystem persistence, environment folder directly in pgdata
  }).driver
});

/**
 * Get the underlying PGlite instance from the client datasource
 * This can be useful for direct operations with PGlite
 */
export async function getClientPGliteInstance() {
  if (!clientDataSource.isInitialized) {
    await clientDataSource.initialize();
  }
  
  const driver = clientDataSource.driver as any;
  if (driver && driver.pglite) {
    return driver.pglite;
  }
  
  throw new Error('PGlite instance not available');
}

// For debug purposes
// For debug purposes (original, can be restored if needed, or kept minimal)
// if (process.env.DEBUG) {
//   console.log("Client entities loaded:", clientEntities && clientEntities.length > 0);
//   console.log("Client datasource initialized");
// }

export default clientDataSource;