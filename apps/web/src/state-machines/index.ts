// Main exports for XState universal state management
export { authMachine } from './machines/auth-machine';
export { appInitMachine } from './machines/app-init-machine';

// 🔥 NEW: Direct machine hooks (no orchestrator needed)
export { 
  useAuth, 
  useAppInit,
  useSystem
} from './orchestrator-hooks-v2';

// 🔴 LEGACY: Old orchestrator (LEGACY - replaced by orchestrator-v2)
export { orchestrator } from './orchestrator-legacy';

// 🔴 LEGACY: Old app-machine hooks (DELETED - replaced by orchestrator-hooks)
export * from './types';

// 🔴 LEGACY: Selectors from deleted app-machine (use orchestrator hooks instead) 