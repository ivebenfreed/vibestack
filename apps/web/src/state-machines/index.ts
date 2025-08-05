// Main exports for XState universal state management
export { authMachine } from './machines/auth-machine';
export { appInitMachine } from './machines/app-init-machine';

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