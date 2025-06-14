import { createAuthClient } from "better-auth/react"; // Use React client

// Define the base URL for the Better Auth server
// In local development, we'll use the current origin instead of an empty string
// This works with Vite's proxy configuration
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const authApiBaseUrl = isLocalDev 
  ? window.location.origin // Use current origin for local development
  : (import.meta.env.VITE_API_URL || "http://127.0.0.1:8787");

// Create the Better Auth client instance
export const authClient = createAuthClient({
  baseURL: `${authApiBaseUrl}/api/auth`,
  credentials: 'include', // Ensure credentials are sent with requests
  headers: {
    'Content-Type': 'application/json',
  },
  mode: 'cors',
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
        if (response === null) return true;
        
        // Retry on 5xx server errors
        if (response.status >= 500) return true;
        
        // Don't retry on 4xx client errors (auth failures, validation errors, etc.)
        return false;
      }
    },
    
    // Better error handling and logging
    onError: (context) => {
      const { error, response } = context;
      
      // Log the error details for debugging
      console.log("[AUTH] Request failed:", { 
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
        console.warn("[AUTH] Network/server error - will retry:", error?.message || `HTTP ${response?.status}`);
      }
    },
    
    // Custom fetch implementation to handle network errors for retries
    customFetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        return await fetch(input, init);
      } catch (error) {
        // Convert network errors to Response.error() so Better Fetch can retry them
        console.log("[AUTH] Network error caught, converting for retry:", error);
        return Response.error();
      }
    }
  },
  fetch: (url: string, options: RequestInit) => {
    console.log(`[AUTH] Fetch request to: ${url}`);
    console.log('[AUTH] Request options:', JSON.stringify({
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
      console.log(`[AUTH] Response status: ${response.status}`);
      console.log(`[AUTH] Response headers:`, Object.fromEntries(response.headers.entries()));
      return response;
    }).catch(error => {
      console.error('[AUTH] Fetch error:', error);
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
    console.log(`[AUTH] Attempting sign-in via: ${authApiBaseUrl}`);
    // Example: Call Better Auth sign-in method
    // const result = await authClient.signIn('email', { email, password });
    // console.log("[AUTH] Sign-in successful:", result);
    // Handle success (e.g., redirect, update state)
    alert("Sign-in logic needs implementation using authClient.signIn");
  } catch (error) {
    console.error("[AUTH] Failed to initiate sign-in:", error);
    alert("Sign-in failed. Please check the console.");
  }
};

/**
 * Initiates the sign-up process using Better Auth.
 * Replace with specific sign-up logic
 */
export const initiateSignUp = async (/* Add necessary parameters */) => {
  try {
    console.log(`[AUTH] Attempting sign-up via: ${authApiBaseUrl}`);
    // Example: Call Better Auth sign-up method
    // const result = await authClient.signUp('email', { email, password, name });
    // console.log("[AUTH] Sign-up successful:", result);
    // Handle success
    alert("Sign-up logic needs implementation using authClient.signUp");
  } catch (error) {
    console.error("[AUTH] Failed to initiate sign-up:", error);
    alert("Sign-up failed. Please check the console.");
  }
};

// Add other necessary functions like signOut, useSession hook integration, etc.
// Example:
// export const signOut = async () => { 
//   await authClient.signOut(); 
//   // Handle post-sign-out logic (e.g., redirect)
// }; 