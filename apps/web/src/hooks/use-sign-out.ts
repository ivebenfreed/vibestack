import { useAuth } from '@/state-machines/orchestrator-hooks';

/**
 * Custom hook for handling the sign-out process through the orchestrator.
 * The orchestrator coordinates all sign-out steps including:
 * 1. Sync teardown
 * 2. Authentication provider sign-out
 * 3. State machine coordination
 * 4. Navigation is handled by route guards/auth providers
 */
export function useSignOut() {
  const { signOut: orchestratorSignOut, isSigningOut } = useAuth();

  const signOut = async () => {
    try {
      console.log('[AUTH] Beginning orchestrator-coordinated sign-out...');
      
      // Use orchestrator sign-out - it will coordinate everything
      orchestratorSignOut();
      
      return true;
    } catch (error) {
      console.error('[AUTH] Error during sign-out process:', error);
      return false;
    }
  };

  return { 
    signOut,
    isSigningOut 
  };
} 