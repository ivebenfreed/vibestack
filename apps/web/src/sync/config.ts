/**
 * Sync Configuration
 * 
 * Centralizes configuration for the sync system, including server URLs
 * and environment-specific settings.
 */

// Environment detection
const isProduction = import.meta.env.PROD;
const isDeployedPreview = import.meta.env.VITE_PREVIEW === 'true';

// Default development URLs
const DEV_API_HOST = '127.0.0.1:8787';
const DEV_WS_PROTOCOL = 'ws';

// Production URLs
const PROD_API_HOST = 'api.vibestack.app';
const PROD_WS_PROTOCOL = 'wss';

// Production preview URLs
const PREVIEW_API_HOST = 'preview.api.vibestack.app';

// Get configured API URL from environment if available
// This supports different local development setups
const envApiUrl = import.meta.env.VITE_API_URL;
const envWsUrl = import.meta.env.VITE_WS_URL;

/**
 * Get the base API URL based on environment
 */
export function getApiBaseUrl(): string {
  // First check for explicitly configured API URL
  if (envApiUrl) {
    // Extract just the host and protocol
    try {
      const url = new URL(envApiUrl);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      console.warn('Invalid API URL format in environment variables:', envApiUrl);
      // Fall back to default behavior
    }
  }
  
  // Otherwise use environment detection
  if (isProduction) {
    return `https://${PROD_API_HOST}`;
  }
  
  if (isDeployedPreview) {
    return `https://${PREVIEW_API_HOST}`;
  }
  
  // Default to local development
  return `https://${DEV_API_HOST}`;
}

/**
 * Get the WebSocket URL for sync based on environment
 */
export function getSyncWebSocketUrl(): string {
  // First check for explicit WebSocket URL
  if (envWsUrl) {
    return envWsUrl;
  }
  
  // Otherwise use environment detection
  if (isProduction) {
    return `${PROD_WS_PROTOCOL}://${PROD_API_HOST}/api/sync`;
  }
  
  if (isDeployedPreview) {
    return `${PROD_WS_PROTOCOL}://${PREVIEW_API_HOST}/api/sync`;
  }
  
  // Default to local development using Vite proxy
  try {
    // Use the same origin as the current page (Vite will proxy to the server)
    // This matches the behavior of getDefaultServerUrl() that was working before
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/api/sync`;
  } catch (e) {
    // Fallback for environments without window
    return `${DEV_WS_PROTOCOL}://${DEV_API_HOST}/api/sync`;
  }
}

/**
 * Get the Sync API REST endpoint URL
 */
export function getSyncApiUrl(): string {
  return `${getApiBaseUrl()}/api/sync`;
}

/**
 * Sync configuration object
 */
export const syncConfig = {
  // How often to send heartbeats to the server (ms)
  heartbeatInterval: isProduction ? 30000 : 15000,
  
  // How long to wait before considering a connection dead (ms)
  connectionTimeout: isProduction ? 60000 : 30000,
  
  // Maximum reconnection attempts
  maxReconnectAttempts: isProduction ? 10 : 5,
  
  // Base reconnection delay before applying backoff (ms)
  reconnectBaseDelay: isProduction ? 1000 : 500,
  
  // Whether to use UUIDs for primary keys
  useUuidKeys: true,
  
  // Sync mechanism to use: 'websocket', 'http', or 'hybrid'
  syncMechanism: 'websocket',
  
  // How many operations to batch before sending to server
  batchSize: isProduction ? 50 : 25,
  
  // URLs
  webSocketUrl: getSyncWebSocketUrl(),
  apiUrl: getSyncApiUrl()
};

// Export default config
export default syncConfig;

/**
 * Get default server URL from config
 */
export function getDefaultServerUrl(): string {
  // Try to get URL from window location
  try {
    // Dynamically use the same protocol that the page is loaded with
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use the same host as the current page (which includes Vite proxy)
    const host = window.location.host;
    return `${protocol}//${host}/api/sync`;
  } catch (e) {
    // Fallback for environments without window
    return 'ws://127.0.0.1:8787/api/sync';
  }
} 