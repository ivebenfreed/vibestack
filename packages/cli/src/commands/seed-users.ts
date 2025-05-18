// packages/cli/src/commands/seed-users.ts
import fetch, { Headers } from 'node-fetch'; // Or your preferred fetch polyfill for Node
import { UserRole } from '@repo/dataforge/server-entities';
import inquirer from 'inquirer';

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


// --- No module-level configuration constants - access process.env at runtime instead ---
// We'll access process.env directly inside each function to avoid initialization timing issues

let adminSessionCookie = ''; // To store the authenticated admin's session cookie

async function promptSuperAdminCredentials() {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Enter Super Admin Name:',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Enter Super Admin Email:',
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
      message: 'Enter Super Admin Password:',
      mask: '*',
      validate: function(value: string) {
        const rules = [
          { regex: /.{12,}/, message: 'Password must be at least 12 characters long.' },
          { regex: /[A-Z]/, message: 'Password must contain at least one uppercase letter.' },
          { regex: /[a-z]/, message: 'Password must contain at least one lowercase letter.' },
          { regex: /[0-9]/, message: 'Password must contain at least one number.' },
          { regex: /[^A-Za-z0-9]/, message: 'Password must contain at least one special character (e.g., !@#$%^&*()_+-=[]{};\':"\\|,.<>/?~).' }
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

async function createSuperAdminViaBootstrap(name: string, email: string, password: string) {
  // Get environment variables at runtime
  const API_URL = process.env.API_URL;
  const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET;

  console.log(`Attempting to create super admin: ${email} via bootstrap endpoint...`);
  if (!API_URL) throw new Error("API_URL not configured for createSuperAdminViaBootstrap");
  const bootstrapUrl = `${API_URL}/api/bootstrap/create-super-admin`;
  try {
    const response = await fetch(bootstrapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bootstrap-Key': BOOTSTRAP_SECRET!,
      },
      body: JSON.stringify({
        email: email,
        password: password,
        name: name,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Read error response as text
      console.error(`Failed to create super admin ${email}: ${response.status} - ${response.statusText}`, errorText);
      // Check for 409 and specific message indicating user already exists
      if (response.status === 409 && (errorText.includes('Super admin already exists.') || errorText.includes('User with email') && errorText.includes('already exists'))) {
        console.log('Super admin already exists, proceeding to sign-in.');
        return true; // Indicate success or existing user
      }
      throw new Error(`Bootstrap super admin creation failed: ${errorText || response.statusText}`);
    }

    // Only attempt to parse JSON if response.ok is true
    const responseBody = await response.json() as UserResponse;
    console.log(`Successfully created or confirmed super admin: ${responseBody?.user?.email || email}`);
    return true;
  } catch (error) {
    console.error(`Exception during super admin creation for ${email}:`, error);
    throw error; // Re-throw
  }
}

async function signInSuperAdmin(email: string, password: string) {
  // Get environment variables at runtime
  const API_URL = process.env.API_URL;

  console.log(`Attempting to sign in as super admin: ${email}...`);
  if (!API_URL) throw new Error("API_URL not configured for signInSuperAdmin");
  const signInUrl = `${API_URL}/api/auth/sign-in/email`; // VERIFY THIS PATH for better-auth
  try {
    const response = await fetch(signInUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    const responseBody = await response.json() as UserResponse;

    if (!response.ok) {
      console.error(`Failed to sign in super admin ${email}: ${response.status}`, responseBody);
      throw new Error(`Super admin sign-in failed: ${responseBody.message || response.statusText}`);
    }

    const setCookieHeader = response.headers.raw()['set-cookie'];
    if (!setCookieHeader || setCookieHeader.length === 0) {
      console.error('No Set-Cookie header found in sign-in response.');
      throw new Error('Super admin sign-in failed: No session cookie received.');
    }

    // Extract and combine all cookies if multiple are set
    adminSessionCookie = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
    console.log(`Successfully signed in as super admin: ${email}. Session cookie stored.`);
    return true;

  } catch (error) {
    console.error(`Exception during super admin sign-in for ${email}:`, error);
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
  // Get environment variables at runtime
  const API_URL = process.env.API_URL;
  
  if (!API_URL) throw new Error("API_URL not configured for createBatchUser");
  const adminCreateUserUrl = `${API_URL}/api/auth/admin/users`; // VERIFY THIS PATH
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
    if (!response.ok) {
      const errorText = await response.text(); // Read error response as text
      console.error(`Failed to create batch user ${userData.email}: ${response.status} - ${response.statusText}`, errorText);
      // Do not throw here, allow loop to continue or decide in seedTestUsers
      return null;
    }
    // Only attempt to parse JSON if response.ok is true
    const responseBody = await response.json() as UserResponse;
    console.log(`Successfully created batch user: ${responseBody?.user?.email || userData.email}`);
    return responseBody.user;
  } catch (error) {
    console.error(`Exception creating batch user ${userData.email}:`, error);
    return null; // Do not throw here, allow loop to continue
  }
}

async function seedTestUsers() {
  // Get environment variables at runtime
  const BATCH_USER_COUNT = parseInt(process.env.SEED_BATCH_USER_COUNT || "10", 10);
  const BATCH_USER_EMAIL_PATTERN = process.env.SEED_BATCH_USER_EMAIL_PATTERN || 'testuser{index}@example.com';
  const BATCH_USER_NAME_PATTERN = process.env.SEED_BATCH_USER_NAME_PATTERN || 'Test User {index}';
  const BATCH_USER_PASSWORD = process.env.SEED_BATCH_USER_PASSWORD || 'testpassword';
  const BATCH_USER_ROLE = process.env.SEED_BATCH_USER_ROLE || UserRole.MEMBER;
  
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
    // Optionally, throw an error if any failure is unacceptable
    // throw new Error(`${failureCount} batch users could not be created.`);
  }
}

export async function seedUsersCommand() {
  console.log("Starting user seeding script via @repo/cli...");
  if (!process.env.BOOTSTRAP_SECRET) { // BOOTSTRAP_SECRET is loaded by dotenv in cli.ts
    console.error("Error: BOOTSTRAP_SECRET environment variable is not set for the seeding script.");
    throw new Error("BOOTSTRAP_SECRET environment variable is not set.");
  }
  if (!process.env.API_URL) { // API_URL is loaded by dotenv in cli.ts
    console.error("Error: API_URL environment variable is not set for the seeding script.");
    throw new Error("API_URL environment variable is not set.");
  }

  try {
    const { name, email, password } = await promptSuperAdminCredentials();
    await createSuperAdminViaBootstrap(name, email, password);
    await signInSuperAdmin(email, password);
    await seedTestUsers();
    console.log("User seeding script logic completed successfully.");
  } catch (error) {
    console.error("An error occurred during the seeding process in seedUsersCommand:", error);
    throw error; // Re-throw to be caught by the commander action
  }
}