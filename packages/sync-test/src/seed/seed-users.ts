// packages/sync-test/src/seed/seed-users.ts
import fetch, { Headers } from 'node-fetch'; // Or your preferred fetch polyfill for Node
import { UserRole } from '@repo/dataforge/generated/server-entities';

// --- API Response Type Definitions ---
interface ApiResponse {
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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


// --- Configuration (use process.env with dotenv for actual values) ---
const API_BASE_URL = process.env.API_URL || 'http://localhost:8787'; // Match server dev protocol
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET; // Critical: Must match server
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@example.com';
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD || 'superadminpassword';
const SUPER_ADMIN_NAME = process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin';

const BATCH_USER_COUNT = parseInt(process.env.SEED_BATCH_USER_COUNT || "10", 10);
const BATCH_USER_EMAIL_PATTERN = process.env.SEED_BATCH_USER_EMAIL_PATTERN || 'testuser{index}@example.com';
const BATCH_USER_NAME_PATTERN = process.env.SEED_BATCH_USER_NAME_PATTERN || 'Test User {index}';
const BATCH_USER_PASSWORD = process.env.SEED_BATCH_USER_PASSWORD || 'testpassword';
const BATCH_USER_ROLE = process.env.SEED_BATCH_USER_ROLE || UserRole.MEMBER; // Use the enum string value

let adminSessionCookie = ''; // To store the authenticated admin's session cookie

async function createSuperAdminViaBootstrap() {
  console.log(`Attempting to create super admin: ${SUPER_ADMIN_EMAIL} via bootstrap endpoint...`);
  const bootstrapUrl = `${API_BASE_URL}/api/bootstrap/create-super-admin`;
  try {
    const response = await fetch(bootstrapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bootstrap-Key': BOOTSTRAP_SECRET!,
      },
      body: JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        name: SUPER_ADMIN_NAME,
      }),
    });

    const responseBody = await response.json() as UserResponse;

    if (!response.ok) {
      console.error(`Failed to create super admin ${SUPER_ADMIN_EMAIL}: ${response.status} - ${response.statusText}`, responseBody);
      if (responseBody.message === 'Super admin already exists.') {
        console.log('Super admin already exists, proceeding to sign-in.');
        return true; // Indicate success or existing user
      }
      throw new Error(`Bootstrap super admin creation failed: ${responseBody.message || response.statusText}`);
    }
    console.log(`Successfully created or confirmed super admin: ${responseBody?.user?.email || SUPER_ADMIN_EMAIL}`);
    return true;
  } catch (error) {
    console.error(`Exception during super admin creation for ${SUPER_ADMIN_EMAIL}:`, error);
    throw error; // Re-throw to be caught by main
  }
}

async function signInSuperAdmin() {
  console.log(`Attempting to sign in as super admin: ${SUPER_ADMIN_EMAIL}...`);
  const signInUrl = `${API_BASE_URL}/api/auth/sign-in/email`; // VERIFY THIS PATH for better-auth
  try {
    const response = await fetch(signInUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
      }),
    });

    const responseBody = await response.json() as UserResponse;

    if (!response.ok) {
      console.error(`Failed to sign in super admin ${SUPER_ADMIN_EMAIL}: ${response.status}`, responseBody);
      throw new Error(`Super admin sign-in failed: ${responseBody.message || response.statusText}`);
    }

    const setCookieHeader = response.headers.raw()['set-cookie'];
    if (!setCookieHeader || setCookieHeader.length === 0) {
      console.error('No Set-Cookie header found in sign-in response.');
      throw new Error('Super admin sign-in failed: No session cookie received.');
    }

    // Extract and combine all cookies if multiple are set
    adminSessionCookie = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
    console.log(`Successfully signed in as super admin: ${SUPER_ADMIN_EMAIL}. Session cookie stored.`);
    return true;

  } catch (error) {
    console.error(`Exception during super admin sign-in for ${SUPER_ADMIN_EMAIL}:`, error);
    throw error; // Re-throw
  }
}

interface BatchUserData {
  email: string;
  password?: string; // Password might be optional if set by admin or system
  name: string;
  role: string; // UserRole enum string value
  data?: Record<string, any>; // For any additional user data
}

async function createBatchUser(userData: BatchUserData, cookie: string) {
  const adminCreateUserUrl = `${API_BASE_URL}/api/auth/admin/users`; // VERIFY THIS PATH
  console.log(`Attempting to create batch user: ${userData.email} via ${adminCreateUserUrl}`);
  try {
    const response = await fetch(adminCreateUserUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify(userData),
    });
    const responseBody = await response.json() as UserResponse; // Attempt to parse JSON regardless of status for error details
    if (!response.ok) {
      console.error(`Failed to create batch user ${userData.email}: ${response.status} - ${response.statusText}`, responseBody);
      // Do not throw here, allow loop to continue or decide in seedTestUsers
      return null;
    }
    console.log(`Successfully created batch user: ${responseBody?.user?.email || userData.email}`);
    return responseBody.user;
  } catch (error) {
    console.error(`Exception creating batch user ${userData.email}:`, error);
    return null; // Do not throw here, allow loop to continue
  }
}

async function seedTestUsers() {
  if (!adminSessionCookie) {
    console.error("Admin session cookie not available. Cannot seed test users.");
    throw new Error("Admin session cookie not available for seeding test users.");
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
      const createdUser = await createBatchUser(userData, adminSessionCookie);
      if (createdUser) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      // This catch is mostly for unexpected errors if createBatchUser itself throws
      console.error(`Unhandled error in createBatchUser loop for ${email}:`, error);
      failureCount++;
    }
    // Optional: Add a small delay if hitting API rate limits
    // await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log(`Finished seeding test users. Success: ${successCount}, Failures: ${failureCount}`);
  if (failureCount > 0) {
    // Decide if this should be a hard fail for the script
    console.warn(`${failureCount} batch users could not be created.`);
  }
}

export async function main() {
  console.log("Starting user seeding script...");
  if (!BOOTSTRAP_SECRET) {
    console.error("Error: BOOTSTRAP_SECRET environment variable is not set for the seeding script.");
    process.exit(1);
  }
  if (!API_BASE_URL) {
    console.error("Error: API_URL environment variable is not set for the seeding script.");
    process.exit(1);
  }

  try {
    await createSuperAdminViaBootstrap();
    await signInSuperAdmin();
    await seedTestUsers();
    console.log("User seeding script completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("An error occurred during the seeding process:", error);
    process.exit(1);
  }
}

// main().catch(e => {
//   console.error("Unhandled error in main execution:", e);
//   process.exit(1);
// });