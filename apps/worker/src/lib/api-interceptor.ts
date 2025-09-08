/**
 * Global API Response Interceptor
 * 
 * Handles common API errors across the application:
 * - 402 Payment Required: Redirects to billing page for trial expiration
 * - 401 Unauthorized: Redirects to sign-in
 * - Other errors: Standard error handling
 */

import { toast } from 'sonner';

// Store the original fetch
const originalFetch = window.fetch;

// Track if we've already shown the trial expired message
let hasShownTrialExpiredMessage = false;

// Override fetch to add global error handling
window.fetch = async (...args) => {
  try {
    const response = await originalFetch(...args);
    
    // Check for 402 Payment Required (trial expired)
    if (response.status === 402) {
      // Parse the error response
      const errorData = await response.json().catch(() => ({
        error: 'Trial expired',
        details: {
          message: 'Your trial has expired. Please upgrade to continue.',
          upgrade_url: '/settings/billing'
        }
      }));
      
      // Show toast only once per session
      if (!hasShownTrialExpiredMessage) {
        hasShownTrialExpiredMessage = true;
        
        toast.error('Trial Expired', {
          description: errorData.details?.message || 'Your trial has expired. Please upgrade to continue using VibeStack.',
          duration: 10000, // Show for 10 seconds
          action: {
            label: 'Upgrade Now',
            onClick: () => {
              window.location.href = '/settings/billing';
            }
          }
        });
        
        // Redirect to billing page after a short delay
        setTimeout(() => {
          window.location.href = '/settings/billing';
        }, 2000);
      }
      
      // Return the response so the calling code can handle it
      return response;
    }
    
    // Check for 401 Unauthorized
    if (response.status === 401) {
      // Only redirect if not already on sign-in page
      if (!window.location.pathname.includes('/sign-in')) {
        toast.error('Session Expired', {
          description: 'Please sign in to continue.',
        });
        
        // Store the current location to redirect back after sign-in
        sessionStorage.setItem('redirectAfterSignIn', window.location.pathname);
        
        setTimeout(() => {
          window.location.href = '/sign-in';
        }, 1000);
      }
    }
    
    return response;
  } catch (error) {
    // Network errors or other exceptions
    throw error;
  }
};

// Export a function to reset the trial expired flag (useful for testing)
export function resetTrialExpiredFlag() {
  hasShownTrialExpiredMessage = false;
}

// Export a helper to make API calls with proper error handling
export async function apiCall<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      ...options
    });
    
    // Handle 402 specially - don't try to parse as normal response
    if (response.status === 402) {
      return {
        success: false,
        error: 'Trial expired. Please upgrade to continue.'
      };
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      return {
        success: false,
        error: errorData.error || errorData.message || `Request failed: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}