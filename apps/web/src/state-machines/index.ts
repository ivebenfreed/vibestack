// Main exports for XState universal state management
export { appMachine } from './app-machine';
export { orchestrator } from './orchestrator';

// 🔥 NEW: Orchestrator hooks (preferred)
export { 
  OrchestratorProvider, 
  useOrchestrator, 
  useAuth, 
  useConnection,
  useDatabase,
  useSync,
  useLiveChanges,
  useIntegrity,
  useSystemReadiness,
  useSimpleReadiness as useOrchestratorSimpleReadiness // Renamed to avoid conflict
} from './orchestrator-hooks';

// 🔴 LEGACY: Old app-machine hooks (deprecated)
export * from './hooks';
export * from './types';

// Export selectors for existing code that needs them
export { 
  isConnectionOnline, 
  isAuthenticated, 
  isDatabaseReady, 
  isSyncLive, 
  areLiveChangesActive,
  isAppReady,
  getAppReadinessInfo,
  canLoadRoutes,
  getRouteLoadingInfo,
  getSyncProgress,
  getDebugInfo,
  getUserDisplayInfo,
  getCurrentUser,
  getLastKnownUser,
  isOfflineMode,
  hasUserCache,
  isIntegrityResetInProgress,
  isIntegrityValidationInProgress,
  getIntegrityResetInfo
} from './selectors'; 