import "reflect-metadata";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import path from "path";
import { fileURLToPath } from 'url';
import { isServerEntity } from '../utils/context.js';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the current environment
const currentEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
config({ path: path.resolve(__dirname, `../../.env.${currentEnv}`) });

// Load general .env file (environment-specific variables will take precedence)
config({ path: path.resolve(__dirname, '../../.env'), override: false });

// Create server datasource
const serverDataSource = new DataSource({
  type: "postgres",
  // Use DATABASE_URL if available, otherwise use default connection settings
  url: process.env.DATABASE_URL,
  // If no URL is provided, use these settings
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "vibestack",
  ssl: process.env.DB_SSL === "true",
  // Dynamically load entities from the entities directory
  entities: [path.join(__dirname, '../entities/*.ts')],
  migrations: [path.join(__dirname, "../migrations/server/*.ts")],
  // Set default schema for all entities
  schema: "public",
  logging: true,
  // Use TypeORM's built-in filtering
  entitySkipConstructor: true,
  synchronize: false,
});

export default serverDataSource; 