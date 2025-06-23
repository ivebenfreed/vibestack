import { useAuth } from '@/state-machines/orchestrator-hooks-v2';

/**
 * Simple sign-out hook that leverages the auth machine.
 * The route guard will handle navigation when auth state changes.
 */
export function useSignOut() {
  const { signOut, isSigningOut } = useAuth();

  const handleSignOut = async () => {
    try {
      // Simply trigger sign out in auth machine
      signOut();
      // Route guard will detect auth change and redirect
      return true;
    } catch (error) {
      console.error('[useSignOut] Sign-out failed:', error);
      return false;
    }
  };

  return { 
    signOut: handleSignOut,
    isSigningOut
  };
} 