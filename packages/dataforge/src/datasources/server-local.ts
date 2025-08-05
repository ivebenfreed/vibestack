import "reflect-metadata";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import path from "path";
import { fileURLToPath } from 'url';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local specifically for local development
config({ path: path.resolve(__dirname, '../../.env.local') });

// Create local server datasource
const serverLocalDataSource = new DataSource({
  type: "postgres",
  // Use direct PostgreSQL connection for local development
  url: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vibestack_dev",
  // If no URL is provided, use these settings as fallback
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "vibestack_dev",
  ssl: false, // No SSL for local development
  // Dynamically load entities from the entities directory
  entities: [path.join(__dirname, '../entities/*.ts')],
  migrations: [path.join(__dirname, "../migrations/server-local/*.ts")],
  // Set default schema for all entities
  schema: "public",
  logging: true,
  // Use TypeORM's built-in filtering
  entitySkipConstructor: true,
  synchronize: false,
});

export default serverLocalDataSource;