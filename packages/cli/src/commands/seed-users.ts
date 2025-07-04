// packages/cli/src/commands/seed-users.ts
import fetch from 'node-fetch'; // Keep for API calls
import { UserRole } from '@repo/dataforge/server-entities';
import { loadToken, performLoginAndStoreToken } from '../utils/auth.js';

// --- API Response Type Definitions ---
interface ApiResponse {
  message?: string;
   
  [key: string]: any; // Allow other properties
}

interface UserShape {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
}

interface UserResponse extends ApiResponse {
  user?: UserShape;
}

interface BatchUserData {
  email: string;
  password?: string; // Password might be optional if set by admin or system
  name: string;
  role: string; // UserRole enum string value
  data?: Record<string, any>; // For any additional user data
}

/**
 * Creates a batch user via the admin API
 * @param userData The user data to create
 * @param token The session token for authentication
 * @returns The created user or null if creation failed
 */
async function createBatchUserApi(userData: BatchUserData, token: string): Promise<UserShape | null> {
  // Get environment variables at runtime
  const API_URL = process.env.API_URL;
  
  if (!API_URL) throw new Error("API_URL not configured for createBatchUserApi");
  const adminCreateUserUrl = `${API_URL}/api/auth/admin/users`; // VERIFY THIS PATH
  console.log(`Attempting to create batch user: ${userData.email} via ${adminCreateUserUrl}`);
  try {
    const response = await fetch(adminCreateUserUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': token,
      },
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const errorText = await response.text(); // Read error response as text
      console.error(`Failed to create batch user ${userData.email}: ${response.status} - ${response.statusText}`, errorText);
      // Do not throw here, allow loop to continue or decide in seedTestUsersLoop
      return null;
    }
    // Only attempt to parse JSON if response.ok is true
    const responseBody = await response.json() as UserResponse;
    console.log(`Successfully created batch user: ${responseBody?.user?.email || userData.email}`);
    return responseBody.user || null;
  } catch (error) {
    console.error(`Exception creating batch user ${userData.email}:`, error);
    return null; // Do not throw here, allow loop to continue
  }
}

/**
 * Seeds test users using the provided token
 * @param token The session token for authentication
 * @returns Object containing success and failure counts
 */
async function seedTestUsersLoop(token: string): Promise<{successCount: number, failureCount: number}> {
  // Get environment variables at runtime
  const BATCH_USER_COUNT = parseInt(process.env.SEED_BATCH_USER_COUNT || "10", 10);
  const BATCH_USER_EMAIL_PATTERN = process.env.SEED_BATCH_USER_EMAIL_PATTERN || 'testuser{index}@example.com';
  const BATCH_USER_NAME_PATTERN = process.env.SEED_BATCH_USER_NAME_PATTERN || 'Test User {index}';
  const BATCH_USER_PASSWORD = process.env.SEED_BATCH_USER_PASSWORD || 'testpassword';
  const BATCH_USER_ROLE = process.env.SEED_BATCH_USER_ROLE || UserRole.MEMBER;
  
  if (!token) {
    throw new Error("Session token not available. Cannot seed test users.");
  }
  console.log(`Starting to seed ${BATCH_USER_COUNT} test users...`);
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < BATCH_USER_COUNT; i++) {
    const userIndex = i + 1; // For 1-based indexing in patterns
    const email = BATCH_USER_EMAIL_PATTERN.replace('{index}', userIndex.toString());
    const name = BATCH_USER_NAME_PATTERN.replace('{index}', userIndex.toString());
    const userData: BatchUserData = {
      email,
      password: BATCH_USER_PASSWORD,
      name,
      role: BATCH_USER_ROLE,
      data: {}, // As per plan
    };

    try {
      const createdUser = await createBatchUserApi(userData, token);
      if (createdUser) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      // This catch is mostly for unexpected errors if createBatchUserApi itself throws
      console.error(`Unhandled error in createBatchUserApi loop for ${email}:`, error);
      failureCount++;
    }
    // Optional: Add a small delay if hitting API rate limits
    // await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log(`Finished seeding test users. Success: ${successCount}, Failures: ${failureCount}`);
  if (failureCount > 0) {
    // Decide if this should be a hard fail for the script
    console.warn(`${failureCount} batch users could not be created.`);
    // Optionally, throw an error if any failure is unacceptable
    // throw new Error(`${failureCount} batch users could not be created.`);
  }
  
  return { successCount, failureCount };
}

/**
 * Main command function for seeding users
 * Handles authentication and orchestration of the seeding process
 */
export async function seedUsersCommand(): Promise<void> {
  try {
    console.log("Starting batch user seeding process...");
    
    // Check for required environment variables
    if (!process.env.API_URL) {
      console.error("Error: API_URL environment variable is not set for the seeding script.");
      throw new Error("API_URL environment variable is not set.");
    }
    
    // Get token from storage
    let token = await loadToken();
    
    // If no token, try to login
    if (!token) {
      console.log("No active session found. Attempting to log in...");
      const loginSuccess = await performLoginAndStoreToken();
      
      if (!loginSuccess) {
        console.error("Login failed. Cannot proceed with seeding users. Please ensure super admin credentials are correct or run 'create-super-admin' if no super admin exists.");
        return;
      }
      
      // Get the newly stored token
      token = await loadToken();
      
      if (!token) {
        console.error("Login seemed successful, but failed to retrieve token. Aborting.");
        return;
      }
    }
    
    // Proceed with seeding users
    console.log("Active session found. Proceeding to seed batch users...");
    const result = await seedTestUsersLoop(token);
    
    console.log(`User seeding completed. Successfully created: ${result.successCount}, Failed: ${result.failureCount}`);
    
  } catch (error) {
    console.error("An error occurred during the seeding process:", error);
    throw error; // Re-throw to be caught by the commander action
  }
}