// Main exports for XState universal state management
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

// 🔴 LEGACY: Old app-machine hooks (DELETED - replaced by orchestrator-hooks)
export * from './types';

// 🔴 LEGACY: Selectors from deleted app-machine (use orchestrator hooks instead) 