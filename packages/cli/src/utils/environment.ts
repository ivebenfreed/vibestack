import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_ROOT = path.resolve(__dirname, '../..');

export type Environment = 'development' | 'staging' | 'production';

export const VALID_ENVIRONMENTS: Environment[] = ['development', 'staging', 'production'];

export interface EnvironmentConfig {
  API_URL: string;
  BOOTSTRAP_SECRET: string;
  SEED_SUPER_ADMIN_EMAIL: string;
  SEED_SUPER_ADMIN_PASSWORD: string;
  SEED_SUPER_ADMIN_NAME: string;
  SEED_BATCH_USER_COUNT: string;
  SEED_BATCH_USER_EMAIL_PATTERN: string;
  SEED_BATCH_USER_NAME_PATTERN: string;
  SEED_BATCH_USER_PASSWORD: string;
  SEED_BATCH_USER_ROLE: string;
  ENVIRONMENT: string;
}

/**
 * Load environment configuration for the specified environment
 */
export function loadEnvironment(environment: Environment = 'development'): EnvironmentConfig {
  const envFile = path.resolve(CLI_ROOT, `.env.${environment}`);
  
  console.log(`Loading environment: ${environment}`);
  console.log(`Environment file path: ${envFile}`);
  
  // Check if environment file exists
  if (!fs.existsSync(envFile)) {
    throw new Error(`Environment file not found: ${envFile}`);
  }
  
  // Load environment variables
  const result = dotenv.config({ 
    path: envFile, 
    override: true 
  });
  
  if (result.error) {
    throw new Error(`Failed to load environment file ${envFile}: ${result.error.message}`);
  }
  
  console.log(`Successfully loaded environment: ${environment}`);
  console.log(`API_URL: ${process.env.API_URL}`);
  console.log(`ENVIRONMENT: ${process.env.ENVIRONMENT}`);
  
  // Validate required environment variables
  const requiredVars: (keyof EnvironmentConfig)[] = [
    'API_URL',
    'BOOTSTRAP_SECRET',
    'SEED_SUPER_ADMIN_EMAIL',
    'SEED_SUPER_ADMIN_PASSWORD',
    'SEED_SUPER_ADMIN_NAME',
    'SEED_BATCH_USER_COUNT',
    'SEED_BATCH_USER_EMAIL_PATTERN',
    'SEED_BATCH_USER_NAME_PATTERN',
    'SEED_BATCH_USER_PASSWORD',
    'SEED_BATCH_USER_ROLE',
    'ENVIRONMENT'
  ];
  
  const missing: string[] = [];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return {
    API_URL: process.env.API_URL!,
    BOOTSTRAP_SECRET: process.env.BOOTSTRAP_SECRET!,
    SEED_SUPER_ADMIN_EMAIL: process.env.SEED_SUPER_ADMIN_EMAIL!,
    SEED_SUPER_ADMIN_PASSWORD: process.env.SEED_SUPER_ADMIN_PASSWORD!,
    SEED_SUPER_ADMIN_NAME: process.env.SEED_SUPER_ADMIN_NAME!,
    SEED_BATCH_USER_COUNT: process.env.SEED_BATCH_USER_COUNT!,
    SEED_BATCH_USER_EMAIL_PATTERN: process.env.SEED_BATCH_USER_EMAIL_PATTERN!,
    SEED_BATCH_USER_NAME_PATTERN: process.env.SEED_BATCH_USER_NAME_PATTERN!,
    SEED_BATCH_USER_PASSWORD: process.env.SEED_BATCH_USER_PASSWORD!,
    SEED_BATCH_USER_ROLE: process.env.SEED_BATCH_USER_ROLE!,
    ENVIRONMENT: process.env.ENVIRONMENT!
  };
}

/**
 * Get the current environment from NODE_ENV or default to development
 */
export function getCurrentEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  
  if (nodeEnv && VALID_ENVIRONMENTS.includes(nodeEnv as Environment)) {
    return nodeEnv as Environment;
  }
  
  return 'development';
}

/**
 * Get available environments by checking for .env files
 */
export function getAvailableEnvironments(): Environment[] {
  return VALID_ENVIRONMENTS.filter(env => {
    const envFile = path.resolve(CLI_ROOT, `.env.${env}`);
    return fs.existsSync(envFile);
  });
}

/**
 * Get environment-specific auth token file name
 */
export function getAuthTokenFileName(environment: Environment): string {
  return `.auth-token-${environment}.json`;
}