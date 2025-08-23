// Main exports for XState universal state management
export { authMachine } from './machines/auth-machine';
// App init machine removed - Legend State handles initialization directly

// Direct machine hooks
export { 
  useAuth, 
  useAppInit,
  useSystem,
  useSync
} from './hooks';

// 🔴 LEGACY: Old orchestrator (DELETED - replaced by orchestrator-v2)

// 🔴 LEGACY: Old app-machine hooks (DELETED - replaced by orchestrator-hooks)
export * from './types';

// 🔴 LEGACY: Selectors from deleted app-machine (use orchestrator hooks instead) 