import { createAuthClient } from "better-auth/react"; // Use React client
import { adminClient, emailOTPClient } from "better-auth/client/plugins";
import { log } from '@/logger';
const myLog = log('lib/auth.ts');

// Define the base URL for the Better Auth server
// Using same-origin architecture - everything from same domain
const currentHostname = window.location.hostname;
const isLocalDev = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

// Debug logging to see what's happening
myLog.info('[AUTH] Environment detection:', {
  hostname: currentHostname,
  isLocalDev,
  origin: window.location.origin,
  importMetaEnv: import.meta.env,
  NODE_ENV: import.meta.env.NODE_ENV,
  PROD: import.meta.env.PROD
});

// Use same origin for all environments - no cross-origin requests needed
const authApiBaseUrl = window.location.origin;
myLog.info('[AUTH] Using same-origin API URL:', authApiBaseUrl);

// Create the Better Auth client instance
export const authClient = createAuthClient({
  baseURL: `${authApiBaseUrl}/api/auth`,
  plugins: [
    adminClient(),
    emailOTPClient()
  ]
});

// No longer need redirectUri for PKCE
// export const redirectUri = `${window.location.origin}/auth/callback`;

/**
 * Initiates the sign-in process using Better Auth.
 * Replace with specific sign-in logic (e.g., opening a modal, navigating to a page)
 */
export const initiateSignIn = async (/* Add necessary parameters like email, password */) => {
  try {
    myLog.info(`[AUTH] Attempting sign-in via: ${authApiBaseUrl}`);
    // Example: Call Better Auth sign-in method
    // const result = await authClient.signIn('email', { email, password });
    // myLog.info("[AUTH] Sign-in successful:", result);
    // Handle success (e.g., redirect, update state)
    alert("Sign-in logic needs implementation using authClient.signIn");
  } catch (error) {
    myLog.error("[AUTH] Failed to initiate sign-in:", error);
    alert("Sign-in failed. Please check the console.");
  }
};

/**
 * Initiates the sign-up process using Better Auth.
 * Replace with specific sign-up logic
 */
export const initiateSignUp = async (/* Add necessary parameters */) => {
  try {
    myLog.info(`[AUTH] Attempting sign-up via: ${authApiBaseUrl}`);
    // Example: Call Better Auth sign-up method
    // const result = await authClient.signUp('email', { email, password, name });
    // myLog.info("[AUTH] Sign-up successful:", result);
    // Handle success
    alert("Sign-up logic needs implementation using authClient.signUp");
  } catch (error) {
    myLog.error("[AUTH] Failed to initiate sign-up:", error);
    alert("Sign-up failed. Please check the console.");
  }
};

// Re-export useAuth hook from state machines
export { useAuth } from '@/state-machines/hooks'

// Add other necessary functions like signOut, useSession hook integration, etc.
// Example:
// export const signOut = async () => { 
//   await authClient.signOut(); 
//   // Handle post-sign-out logic (e.g., redirect)
// }; 