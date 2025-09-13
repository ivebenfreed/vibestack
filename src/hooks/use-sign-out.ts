import { useLegendAuth } from '@/legend-state/hooks/use-legend-auth';
import { log } from '@/logger';
const fileLog = log('hooks/use-sign-out.ts');

/**
 * Simple sign-out hook that leverages Legend State auth.
 * The route guard will handle navigation when auth state changes.
 */
export function useSignOut() {
  const { signOut, loading: isSigningOut } = useLegendAuth();

  const handleSignOut = async () => {
    try {
      // Simply trigger sign out in Legend State auth
      signOut();
      // Route guard will detect auth change and redirect
      return true;
    } catch (error) {
      fileLog.error('[useSignOut] Sign-out failed:', error);
      return false;
    }
  };

  return { 
    signOut: handleSignOut,
    isSigningOut
  };
} 