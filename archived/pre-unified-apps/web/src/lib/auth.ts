import { createAuthClient } from "better-auth/react"; // Use React client
import { adminClient, emailOTPClient } from "better-auth/client/plugins";
import { authLog } from '@/logger';
const log = authLog('lib/auth.ts');

// Define the base URL for the Better Auth server
// Using same-origin architecture - everything from same domain
const currentHostname = window.location.hostname;
const isLocalDev = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

// Debug logging to see what's happening
log.info('[AUTH] Environment detection:', {
  hostname: currentHostname,
  isLocalDev,
  origin: window.location.origin,
  importMetaEnv: import.meta.env,
  NODE_ENV: import.meta.env.NODE_ENV,
  PROD: import.meta.env.PROD
});

// Use same origin for all environments - no cross-origin requests needed
const authApiBaseUrl = window.location.origin;
log.info('[AUTH] Using same-origin API URL:', authApiBaseUrl);

// Create the Better Auth client instance
export const authClient = createAuthClient({
  baseURL: `${authApiBaseUrl}/api/auth`,
  credentials: 'include', // Ensure credentials are sent with requests
  headers: {
    'Content-Type': 'application/json',
  },
  mode: 'cors',
  plugins: [
    adminClient(),
    emailOTPClient()
  ],
  fetchOptions: {
    // Add timeout for requests
    timeout: 10000, // 10 seconds
    
    // Add retry logic for network failures and server errors
    // Since we have persistent auth storage, we can be aggressive with retries
    retry: {
      type: "exponential",
      attempts: import.meta.env.DEV ? 3 : 10, // More retries in production
      baseDelay: 1000, // 1 second base delay
      maxDelay: import.meta.env.DEV ? 5000 : 60000, // Longer max delay in production
      shouldRetry: (response: Response | null) => {
        // Always retry on network failures (response is null)
        if (response === null) {
          log.info('[AUTH] Network failure detected, will retry');
          return true;
        }
        
        // Retry on 5xx server errors
        if (response.status >= 500) {
          log.info(`[AUTH] Server error ${response.status} detected, will retry`);
          return true;
        }
        
        // Don't retry on 4xx client errors (auth failures, validation errors, etc.)
        if (response.status >= 400 && response.status < 500) {
          log.info(`[AUTH] Client error ${response.status} detected, will not retry`);
        }
        return false;
      }
    },
    
    // Better error handling and logging
    onError: (context) => {
      const { error, response } = context;
      
      // Log the error details for debugging
      log.info("[AUTH] Request failed:", { 
        error: error?.message, 
        status: response?.status,
        url: context.request?.url 
      });
      
      // Don't log expected auth errors as warnings in dev mode
      if (import.meta.env.DEV && response?.status && [401, 403].includes(response.status)) {
        return;
      }
      
      // Log network failures and server errors for debugging
      if (!response || response.status >= 500) {
        log.warn("[AUTH] Network/server error - will retry:", error?.message || `HTTP ${response?.status}`);
      }
    },
    
    // Custom fetch implementation to handle network errors for retries
    customFetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        return await fetch(input, init);
      } catch (error) {
        // Convert network errors to Response.error() so Better Fetch can retry them
        log.info("[AUTH] Network error caught, converting for retry:", error);
        return Response.error();
      }
    }
  },
  fetch: (url: string, options: RequestInit) => {
    log.info(`[AUTH] Fetch request to: ${url}`);
    log.info('[AUTH] Request options:', JSON.stringify({
      method: options.method,
      headers: options.headers,
      credentials: options.credentials,
      mode: options.mode
    }, null, 2));
    
    // Ensure cookies are sent
    const enhancedOptions = {
      ...options,
      credentials: 'include' as RequestCredentials,
    };
    
    return fetch(url, enhancedOptions).then(response => {
      log.info(`[AUTH] Response status: ${response.status}`);
      log.info(`[AUTH] Response headers:`, Object.fromEntries(response.headers.entries()));
      return response;
    }).catch(error => {
      log.error('[AUTH] Fetch error:', error);
      throw error;
    });
  }
});

// No longer need redirectUri for PKCE
// export const redirectUri = `${window.location.origin}/auth/callback`;

/**
 * Initiates the sign-in process using Better Auth.
 * Replace with specific sign-in logic (e.g., opening a modal, navigating to a page)
 */
export const initiateSignIn = async (/* Add necessary parameters like email, password */) => {
  try {
    log.info(`[AUTH] Attempting sign-in via: ${authApiBaseUrl}`);
    // Example: Call Better Auth sign-in method
    // const result = await authClient.signIn('email', { email, password });
    // log.info("[AUTH] Sign-in successful:", result);
    // Handle success (e.g., redirect, update state)
    alert("Sign-in logic needs implementation using authClient.signIn");
  } catch (error) {
    log.error("[AUTH] Failed to initiate sign-in:", error);
    alert("Sign-in failed. Please check the console.");
  }
};

/**
 * Initiates the sign-up process using Better Auth.
 * Replace with specific sign-up logic
 */
export const initiateSignUp = async (/* Add necessary parameters */) => {
  try {
    log.info(`[AUTH] Attempting sign-up via: ${authApiBaseUrl}`);
    // Example: Call Better Auth sign-up method
    // const result = await authClient.signUp('email', { email, password, name });
    // log.info("[AUTH] Sign-up successful:", result);
    // Handle success
    alert("Sign-up logic needs implementation using authClient.signUp");
  } catch (error) {
    log.error("[AUTH] Failed to initiate sign-up:", error);
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