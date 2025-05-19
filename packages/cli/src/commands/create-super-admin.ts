// packages/cli/src/commands/create-super-admin.ts
import {
  promptSuperAdminCreationCredentials,
  createSuperAdminViaBootstrapApi,
  signInSuperAdminApi,
  saveToken
} from '../utils/auth.js';

/**
 * Command to guide the user through creating a new super admin,
 * then log in and store the session token.
 */
export async function createSuperAdminCommand(): Promise<void> {
  try {
    console.log('Starting super admin creation process...');
    
    // Get user credentials
    const credentials = await promptSuperAdminCreationCredentials();
    
    // Attempt to create the super admin
    const creationSuccess = await createSuperAdminViaBootstrapApi(
      credentials.name,
      credentials.email,
      credentials.password
    );
    
    // Handle creation failure
    if (!creationSuccess) {
      console.error('Failed to create super admin. Please check the logs for details.');
      return;
    }
    
    // Handle creation success
    console.log('Super admin account created/verified successfully. Attempting to log in...');
    
    // Try to log in with the new credentials
    const token = await signInSuperAdminApi(credentials.email, credentials.password);
    
    // Handle login result
    if (token) {
      await saveToken(token);
      console.log(`Super admin ${credentials.email} created and logged in successfully. Session token stored.`);
    } else {
      console.error(`Super admin account was created, but login failed. Please try logging out and then logging back in manually if issues persist, or check server logs.`);
    }
  } catch (error) {
    // Catch any unexpected errors
    console.error('Unexpected error during super admin creation process:', error);
    console.error('Super admin creation failed. Please try again or check logs for details.');
  }
}