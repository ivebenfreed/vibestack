import type { StateValue } from 'xstate';

// ===== USER TYPES =====

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'member' | 'viewer' | 'super_admin';
  emailVerified: boolean;
  image?: string | null;
}

// ===== ORGANIZATION TYPES =====

export interface OrganizationInfo {
  id: string;
  name: string;
  domain?: string;
  slug?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'inactive' | 'trial_expired';
  subscriptionTier: 'trial' | 'starter' | 'pro' | 'enterprise';
  subscription_tier?: 'trial' | 'starter' | 'pro' | 'enterprise'; // Alternative field name
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | 'trial';
  subscription_status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'trial'; // Alternative field name
  trialEndsAt?: string;
  trial_ends_at?: string; // Alternative field name
  memberCount?: number;
  maxMembers?: number;
  settings?: Record<string, any>;
}

export interface CreateOrganizationInput {
  name: string;
  domain?: string;
  subscriptionTier?: 'trial' | 'starter' | 'pro' | 'enterprise';
  billingEmail?: string;
}

// ===== CONTEXT TYPES =====

export interface AppContext {
  // Connection
  isOnline: boolean;
  lastConnectAttempt: number | null;
  connectionRetries: number;
  connectionAttempts: number;
  lastConnectionError: string | null;
  lastActivity: number;
  
  // Auth state (with persistence and offline support)
  user: UserInfo | null;
  authToken: string | null;
  lastKnownUser: UserInfo | null; // For offline caching
  isOfflineMode: boolean;
  authError: string | null;
  
  // Database state
  dbInitialized: boolean;
  dbError: string | null;
  isDatabaseInitialized: boolean;
  databaseError: string | null;
  
  // Sync state  
  currentSyncId: string | null;
  syncProgress: number;
  syncError: string | null;
  totalTasks: number;
  completedTasks: number;
  serverLSN: string | null;
  currentLSN: string;
  lastSyncTime: number | null;
  isSyncLive: boolean;
  
  // 🔥 NEW: Global sync granularity
  syncPhase: 'initial' | 'catchup' | 'live' | null;
  syncPhaseProgress: {
    initial: {
      completed: number;
      total: number;
      tables: string[];
      currentTable: string | null;
      completedTables: number;
      totalTables: number;
    };
    catchup: {
      completed: number;
      total: number;
      batches: number;
      currentBatch: number;
      estimatedRemaining: number;
    };
    live: {
      messagesProcessed: number;
      lastActivity: number | null;
      throughputPerSec: number;
    };
  };
  
  // Live changes
  liveChangesActive: boolean;
  liveChangesError: string | null;
  isLiveChangesEnabled: boolean;
  lastLiveChangeTime: number | null;
  
  // App readiness
  lastReadinessCheck: number | null;
  startupTime: number | null;
  
  // 🔥 NEW: Abstracted system readiness flags
  isSystemReady: boolean;        // Overall system ready (replaces complex state checking)
  canLoadRoutes: boolean;        // Routes can be loaded (replaces canLoadRoutes selector)
  isRouteLoading: boolean;       // Track if route loading is in progress
  currentRouteName: string | null;
  
  // Integrity reset state
  isIntegrityResetInProgress: boolean;  // Block app activity during reset
  integrityResetReason: string | null;  // Why reset was triggered
  integrityResetType: 'full_reset' | 'table_reset' | null;  // Type of reset
  integrityResetError: string | null;   // Reset error if any
  isIntegrityValidationInProgress: boolean;  // Validation in progress
  gapValidationReason: string | null;  // Reason for gap-triggered validation
}

// ===== EVENT TYPES =====

export type AppEvent =
  // Connection events
  | { type: 'GO_ONLINE' }
  | { type: 'GO_OFFLINE' }
  | { type: 'CONNECTION_RETRY' }
  | { type: 'CONNECTION_SUCCESS' }
  | { type: 'CONNECTION_FAILED'; error: string }
  
  // Auth events (for coordination and persistence)
  | { type: 'SIGN_IN'; email: string; password: string }
  | { type: 'SIGN_OUT' }
  | { type: 'CHECK_AUTH' }
  | { type: 'LOGIN_SUCCESS'; user: UserInfo; token: string }
  | { type: 'LOGOUT' }
  | { type: 'AUTH_ERROR'; error: string }
  | { type: 'TOKEN_EXPIRED' }
  | { type: 'AUTH_TOKEN_RECEIVED'; token: string }
  | { type: 'CACHE_USER'; user: UserInfo }
  | { type: 'SET_OFFLINE_MODE'; offline: boolean }
  | { type: 'CLEAR_USER_CACHE' }
  | { type: 'RESTORE_AUTH_STATE'; user?: UserInfo; token?: string; lastKnownUser?: UserInfo }
  
  // Database events
  | { type: 'DB_INIT_START' }
  | { type: 'DB_INIT_SUCCESS' }
  | { type: 'DB_INIT_FAILED'; error: string }
  | { type: 'DB_RESET' }
  | { type: 'DATABASE_ERROR'; error: string }
  
  // Sync events
  | { type: 'SYNC_START'; syncId: string }
  | { type: 'SYNC_PROGRESS'; completed: number; total: number }
  | { type: 'SYNC_SUCCESS' }
  | { type: 'SYNC_FAILED'; error: string }
  | { type: 'SYNC_RESET' }
  | { type: 'SYNC_TO_LIVE' }
  | { type: 'SYNC_CONNECTED'; serverLSN: string }
  | { type: 'INITIAL_SYNC_COMPLETE'; finalLSN: string }
  | { type: 'CATCHUP_COMPLETE'; finalLSN: string }
  | { type: 'LSN_UPDATE'; lsn: string }
  | { type: 'SYNC_ERROR'; error: string }
  
  // 🔥 NEW: Granular sync phase events
  | { type: 'SYNC_PHASE_CHANGED'; phase: 'initial' | 'catchup' | 'live' }
  | { 
      type: 'INITIAL_SYNC_PROGRESS'; 
      completed?: number; 
      total?: number; 
      currentTable?: string; 
      completedTables?: number; 
      totalTables?: number; 
      tables?: string[] 
    }
  | { 
      type: 'CATCHUP_SYNC_PROGRESS'; 
      completed?: number; 
      total?: number; 
      currentBatch?: number; 
      batches?: number; 
      estimatedRemaining?: number 
    }
  | { 
      type: 'LIVE_SYNC_ACTIVITY'; 
      increment?: number; 
      throughputPerSec?: number 
    }
  
  // Live changes events
  | { type: 'LIVE_CHANGES_START' }
  | { type: 'LIVE_CHANGES_STOP' }
  | { type: 'LIVE_CHANGES_SUCCESS' }
  | { type: 'LIVE_CHANGES_FAILED'; error: string }
  
  // Integrity reset events
  | { type: 'INTEGRITY_RESET_START'; reason: string; resetType: 'full_reset' | 'table_reset' }
  | { type: 'INTEGRITY_RESET_COMPLETE'; result: any }
  | { type: 'INTEGRITY_RESET_ERROR'; error: string }
  | { type: 'INTEGRITY_VALIDATION_START' }
  | { type: 'INTEGRITY_VALIDATION_COMPLETE'; isValid: boolean; issues: any[]; recommendedAction?: string }
  
  // Gap-triggered integrity events
  | { type: 'GAP_INTEGRITY_VALIDATION_START'; reason: string }
  | { type: 'GAP_INTEGRITY_VALIDATION_COMPLETE'; validated: boolean; shouldReset?: boolean; resetReason?: string; result?: any; error?: string }
  
  // Heartbeat and gap detection events
  | { type: 'LSN_DRIFT_DETECTED'; clientLSN: string; serverLSN: string }
  | { type: 'TIME_GAP_DETECTED'; gapMs: number; reason: string }
  | { type: 'CONNECTION_RECOVERED'; wasOffline: boolean; durationMs?: number }
  
  // Sync status events
  | { type: 'SYNC_STATUS_CHANGED'; status: string; timestamp?: number }
  
  // App readiness
  | { type: 'CHECK_READINESS' }
  
  // Route loading coordination
  | { type: 'ROUTE_LOADING_START'; routeName: string }
  | { type: 'ROUTE_LOADING_COMPLETE'; routeName: string };

// ===== STATE VALUE TYPES =====

export type ConnectionState = 'offline' | 'connecting' | 'online' | 'failed';
export type AuthState = 'checking' | 'unauthenticated' | 'authenticated';
export type DatabaseState = 'idle' | 'initializing' | 'ready' | 'error';
export type SyncState = 'idle' | 'syncing' | 'live' | 'error';
export type LiveChangesState = 'inactive' | 'starting' | 'active' | 'error';
export type AppReadinessState = 'loading' | 'ready' | 'error';

// ===== STATE TYPES =====

export type AppState = StateValue;

// ===== UTILITY TYPES =====

export interface AppStateSnapshot {
  connection: ConnectionState;
  auth: AuthState;
  database: DatabaseState;
  sync: SyncState;
  liveChanges: LiveChangesState;
  appReadiness: AppReadinessState;
  context: AppContext;
}

// Selector return types
export interface AppReadinessInfo {
  isReady: boolean;
  isLoading: boolean;
  readyPhase: 'offline' | 'database_only' | 'sync_ready' | 'fully_ready';
  blockingReasons: string[];
}

export interface RouteLoadingInfo {
  canLoad: boolean;
  mode: 'online' | 'offline' | 'degraded';
  reason: string;
}

// Auth-specific return types (from authStore)
export interface UserDisplayInfo {
  displayName: string;
  initials: string;
  isOffline: boolean;
  hasCache: boolean;
} 