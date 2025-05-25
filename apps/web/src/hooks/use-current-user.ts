import { useState, useEffect } from 'react';
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource';
import { useAuthStore } from '@/stores/authStore';
import type { UserInfo } from '@/stores/authStore';
import { User } from '@repo/dataforge/client-entities';

export type CurrentUserState = {
  data: User | null;
  loading: boolean;
  error: Error | null;
};

/**
 * Custom hook to fetch the authenticated user's full profile from the local database
 * 
 * @returns {CurrentUserState} The user data, loading state, and any error
 */
export function useCurrentUser(): CurrentUserState {
console.log(`[LAG_INVESTIGATION] ${new Date().toISOString()} - useCurrentUser: Start`);
  const { user: authUser, isAuthenticated } = useAuthStore();
  const [state, setState] = useState<CurrentUserState>({
    data: null,
    loading: isAuthenticated, // Only start loading if authenticated
    error: null
  });

console.log(`[LAG_INVESTIGATION] ${new Date().toISOString()} - useCurrentUser.useEffect: Start. isAuthenticated: ${isAuthenticated}, authUser.id: ${authUser?.id}`);
  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      setState({
        data: null,
        loading: false,
        error: null
      });
      return;
    }

    const fetchUserProfile = async () => {
      try {
        console.log('[useCurrentUser] Fetching user profile for ID:', authUser.id);
        setState(prev => ({ ...prev, loading: true, error: null }));
        
console.log(`[LAG_INVESTIGATION] ${new Date().toISOString()} - useCurrentUser.fetchUserProfile: Before getNewPGliteDataSource()`);
        // Get the TypeORM data source
console.log(`[LAG_INVESTIGATION] ${new Date().toISOString()} - useCurrentUser.fetchUserProfile: After getNewPGliteDataSource()`);
        const dataSource = await getNewPGliteDataSource();
        
        // Get the user repository - use the actual table name from database
        const userRepo = dataSource.getRepository<User>('users');
        
        // Find the user by ID
        const user = await userRepo.findOne({
          where: { id: authUser.id }
        });
        
        console.log('[useCurrentUser] User profile found:', user);
        
        if (user) {
          // --- BEGIN MODIFICATION ---
          // The following block has been removed as per instructions
          // to prevent useCurrentUser from updating authStore.
          // --- END MODIFICATION ---
        }
        
        setState({
          data: user as User,
          loading: false,
          error: null
        });
      } catch (error) {
        console.error('[useCurrentUser] Error fetching user profile:', error);
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    };

    fetchUserProfile();
  }, [isAuthenticated, authUser?.id]);

  return state;
} 