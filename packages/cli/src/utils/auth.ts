// packages/cli/src/utils/auth.ts
import * as fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import fetch from 'node-fetch'; // Or your preferred fetch polyfill for Node
import { getCurrentEnvironment, getAuthTokenFileName } from './environment.js';

// Token storage location: project-local file
// Using the same ESM path resolution approach as in cli.ts
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the token file path for the current environment
 */
function getTokenFilePath(): string {
  const currentEnv = getCurrentEnvironment();
  const tokenFileName = getAuthTokenFileName(currentEnv);
  return path.resolve(__dirname, '../../', tokenFileName);
}

/**
 * Saves an authentication token to the local storage file
 * @param token The token string to save
 */
export async function saveToken(token: string): Promise<void> {
  try {
    const tokenFilePath = getTokenFilePath();
    const currentEnv = getCurrentEnvironment();
    // Ensure the directory exists
    await fs.mkdir(path.dirname(tokenFilePath), { recursive: true });
    // Write the token to the file
    await fs.writeFile(tokenFilePath, JSON.stringify({ token, environment: currentEnv }), 'utf-8');
    console.log(`Authentication token saved successfully for ${currentEnv} environment.`);
  } catch (error) {
    console.error('Error saving authentication token:', error);
    throw new Error(`Failed to save authentication token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Loads the authentication token from the local storage file
 * @returns The token string if found, null otherwise
 */
export async function loadToken(): Promise<string | null> {
  try {
    const tokenFilePath = getTokenFilePath();
    const currentEnv = getCurrentEnvironment();
    const data = await fs.readFile(tokenFilePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Verify the token is for the current environment
    if (parsed.environment && parsed.environment !== currentEnv) {
      console.log(`Token found for ${parsed.environment} environment, but current environment is ${currentEnv}. Token will be ignored.`);
      return null;
    }
    
    return parsed.token || null;
  } catch (error) {
    // File not found or other error - token doesn't exist
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error('Error loading authentication token:', error);
    return null;
  }
}

/**
 * Clears the stored authentication token by deleting the file
 */
export async function clearToken(): Promise<void> {
  try {
    const tokenFilePath = getTokenFilePath();
    const currentEnv = getCurrentEnvironment();
    await fs.unlink(tokenFilePath);
    console.log(`Authentication token cleared successfully for ${currentEnv} environment.`);
  } catch (error) {
    // If file doesn't exist, consider this a success
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No authentication token to clear.');
      return;
    }
    console.error('Error clearing authentication token:', error);
    throw new Error(`Failed to clear authentication token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Prompts the user for sign-in credentials
 * @returns Object containing email and password
 */
export async function promptSignInCredentials(): Promise<{ email: string; password: string }> {
  const questions = [
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: function(value: string) {
        const pass = value.match(/^.+@.+\..+$/i);
        if (pass) {
          return true;
        }
        return 'Please enter a valid email address.';
      }
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*'
    }
  ];
  return inquirer.prompt(questions);
}

/**
 * Prompts the user for super admin creation credentials
 * @returns Object containing name, email, and password
 */
export async function promptSuperAdminCreationCredentials(): Promise<{ name: string; email: string; password: string }> {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Name:',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: function(value: string) {
        const pass = value.match(/^.+@.+\..+$/i);
        if (pass) {
          return true;
        }
        return 'Please enter a valid email address.';
      }
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*',
      validate: function(value: string) {
        const rules = [
          { regex: /.{12,}/, message: 'Password must be at least 12 characters long.' },
          { regex: /[A-Z]/, message: 'Password must contain at least one uppercase letter.' },
          { regex: /[a-z]/, message: 'Password must contain at least one lowercase letter.' },
          { regex: /[0-9]/, message: 'Password must contain at least one number.' },
          { regex: /[^A-Za-z0-9]/, message: 'Password must contain at least one special character.' }
        ];
        for (const rule of rules) {
          if (!rule.regex.test(value)) return rule.message;
        }
        return true;
      }
    }
  ];
  return inquirer.prompt(questions);
}

/**
 * Makes a sign-in API request for a super admin
 * @param email The super admin's email
 * @param password The super admin's password
 * @returns The session token if successful, null otherwise
 */
export async function signInSuperAdminApi(email: string, password: string): Promise<string | null> {
  const API_URL = process.env.API_URL;
  
  if (!API_URL) {
    console.error("API_URL not configured for signInSuperAdminApi");
    return null;
  }
  
  const signInUrl = `${API_URL}/api/auth/sign-in/email`;
  
  try {
    const response = await fetch(signInUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.json();
      console.error(`Failed to sign in as ${email}: ${response.status}`, responseBody);
      return null;
    }

    const setCookieHeader = response.headers.raw()['set-cookie'];
    if (!setCookieHeader || setCookieHeader.length === 0) {
      console.error('No Set-Cookie header found in sign-in response.');
      return null;
    }

    // Extract and combine all cookies if multiple are set
    const sessionToken = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
    console.log(`Successfully signed in as ${email}.`);
    return sessionToken;

  } catch (error) {
    console.error(`Exception during sign-in for ${email}:`, error);
    return null;
  }
}

/**
 * Creates a super admin via the bootstrap API
 * @param name The super admin's name
 * @param email The super admin's email
 * @param password The super admin's password
 * @returns true if successful, false otherwise
 */
export async function createSuperAdminViaBootstrapApi(
  name: string, 
  email: string, 
  password: string
): Promise<boolean> {
  const API_URL = process.env.API_URL;
  const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET;

  if (!API_URL || !BOOTSTRAP_SECRET) {
    console.error("API_URL or BOOTSTRAP_SECRET not configured for createSuperAdminViaBootstrapApi");
    return false;
  }

  console.log(`Attempting to create super admin: ${email} via bootstrap endpoint...`);
  const bootstrapUrl = `${API_URL}/api/bootstrap/create-super-admin`;
  
  try {
    const requestBody = {
      email,
      password,
      name,
      role: 'super_admin'
    };
    console.log('Sending payload to /api/bootstrap/create-super-admin:', JSON.stringify(requestBody, null, 2)); // Added log

    const response = await fetch(bootstrapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bootstrap-Key': BOOTSTRAP_SECRET,
      },
      body: JSON.stringify(requestBody),
    });

    // User already exists is considered success
    if (response.status === 409) {
      const errorText = await response.text();
      if (errorText.includes('Super admin already exists.') || 
          (errorText.includes('User with email') && errorText.includes('already exists'))) {
        console.log('Super admin already exists, proceeding.');
        return true;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create super admin ${email}: ${response.status} - ${response.statusText}`, errorText);
      return false;
    }

    console.log(`Successfully created super admin: ${email}`);
    return true;
  } catch (error) {
    console.error(`Exception during super admin creation for ${email}:`, error);
    return false;
  }
}

/**
 * Orchestration function for performing login and storing the token
 * @returns true if login and token storage were successful, false otherwise
 */
export async function performLoginAndStoreToken(): Promise<boolean> {
  try {
    const { email, password } = await promptSignInCredentials();
    const token = await signInSuperAdminApi(email, password);
    
    if (!token) {
      console.error('Failed to obtain authentication token.');
      return false;
    }
    
    await saveToken(token);
    console.log('Login successful and token stored.');
    return true;
  } catch (error) {
    console.error('Error during login process:', error);
    return false;
  }
}