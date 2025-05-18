// packages/cli/src/commands/clear-users.ts
import fetch from 'node-fetch'; // Headers might not be needed if not explicitly used

// --- API Response Type Definitions ---
interface ApiResponse {
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow other properties
}

// Specific response type for the clear-all-users bootstrap endpoint
interface ClearUsersBootstrapResponse extends ApiResponse {
  clearedCount?: number;
  failedCount?: number;
  totalUsersBeforeDelete?: number;
}

async function clearAllUsersViaBootstrap() {
  const API_URL = process.env.API_URL;
  const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET;

  if (!API_URL) {
    console.error("API_URL not configured. Cannot clear users.");
    throw new Error("API_URL not configured for clearing users.");
  }
  if (!BOOTSTRAP_SECRET) {
    console.error("BOOTSTRAP_SECRET not configured. Cannot clear users.");
    throw new Error("BOOTSTRAP_SECRET not configured for clearing users.");
  }

  console.log("Attempting to clear all users via bootstrap API...");
  const clearUsersUrl = `${API_URL}/api/bootstrap/clear-all-users`;

  try {
    const response = await fetch(clearUsersUrl, {
      method: 'POST',
      headers: {
        'X-Bootstrap-Key': BOOTSTRAP_SECRET,
        'Content-Type': 'application/json', // Though no body is sent, it's good practice
      },
      // No body is needed for this request as per the server endpoint design
    });

    if (!response.ok) {
      const errorText = await response.text(); // Read error as text first
      console.error(`Failed to clear users via bootstrap API: ${response.status} - ${response.statusText}`);
      console.error('Server response:', errorText);
      // Attempt to parse as JSON for a structured error message if possible, otherwise use text
      try {
        const errorJson = JSON.parse(errorText) as ClearUsersBootstrapResponse;
        throw new Error(errorJson.message || errorText);
      } catch (e) {
        throw new Error(errorText || `Failed to clear users: ${response.statusText}`);
      }
    }

    // If response.ok is true, then we expect a JSON response
    const responseBody = await response.json() as ClearUsersBootstrapResponse;

    console.log('Successfully cleared users via bootstrap API.');
    console.log('Response:', responseBody); // Log the details from the server
    return true;

  } catch (error) {
    console.error("An exception occurred during the process of clearing users via bootstrap API:", error);
    throw error; // Re-throw
  }
}

export async function clearUsersCommand() {
  console.log("Starting clear all users script via @repo/cli...");

  if (!process.env.BOOTSTRAP_SECRET) {
    console.error("Error: BOOTSTRAP_SECRET environment variable is not set for the clear users script.");
    throw new Error("BOOTSTRAP_SECRET environment variable is not set.");
  }
  if (!process.env.API_URL) {
    console.error("Error: API_URL environment variable is not set for the clear users script.");
    throw new Error("API_URL environment variable is not set.");
  }

  try {
    // No need to create or sign in super admin, just call the bootstrap endpoint
    await clearAllUsersViaBootstrap();
    console.log("Clear all users script logic completed successfully.");
  } catch (error) {
    console.error("An error occurred during the clear all users process in clearUsersCommand:", error);
    throw error; // Re-throw to be caught by the commander action
  }
}