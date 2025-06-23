// Main exports for XState universal state management
export { orchestratorV2 } from './orchestrator-v2';

// 🔥 NEW: Orchestrator V2 hooks (preferred)
export { 
  OrchestratorV2Provider, 
  useAuth, 
  useAppInit,
  useSystem,
  OrchestratorV2Context
} from './orchestrator-hooks-v2';

// 🔴 LEGACY: Old orchestrator (LEGACY - replaced by orchestrator-v2)
export { orchestrator } from './orchestrator-legacy';

// 🔴 LEGACY: Old app-machine hooks (DELETED - replaced by orchestrator-hooks)
export * from './types';

// 🔴 LEGACY: Selectors from deleted app-machine (use orchestrator hooks instead) 