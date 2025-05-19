// packages/cli/src/commands/logout.ts
import { clearToken } from '../utils/auth.js';

/**
 * Command to logout the user by clearing any stored authentication session
 */
export async function logoutCommand(): Promise<void> {
  try {
    await clearToken();
    console.log('You have been successfully logged out. Stored session token cleared.');
  } catch (error) {
    console.error('Error logging out:', error instanceof Error ? error.message : String(error));
  }
}