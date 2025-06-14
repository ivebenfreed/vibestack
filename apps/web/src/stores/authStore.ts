import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Enhanced UserInfo interface for the simplified system
export interface UserInfo {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'member' | 'viewer' | 'super_admin';
  emailVerified: boolean;
  image?: string | null;
}

// Minimal auth store - only app preferences and offline support
interface AuthStoreState {
  // App preferences (persistent)
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    sidebarCollapsed: boolean;
  };
  
  // User caching for offline support
  lastKnownUser: UserInfo | null;
  isOfflineMode: boolean;
  
  // Simple actions
  updatePreferences: (prefs: Partial<AuthStoreState['preferences']>) => void;
  cacheUser: (user: UserInfo) => void;
  setOfflineMode: (offline: boolean) => void;
  clearCache: () => void;
  
  // Computed getters
  getDisplayName: () => string;
  getUserInitials: () => string;
}

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      // Default app preferences
      preferences: {
        theme: 'light',
        language: 'en',
        sidebarCollapsed: false,
      },
      
      // User caching
      lastKnownUser: null,
      isOfflineMode: false,
      
      // Actions
      updatePreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs }
        }));
      },
      
      cacheUser: (user) => {
        console.log('[AUTH_STORE] Caching user for offline access:', user.id);
        set({ 
          lastKnownUser: user,
          isOfflineMode: false // Clear offline mode when we have fresh user data
        });
      },
      
      setOfflineMode: (offline) => {
        if (offline !== get().isOfflineMode) {
          console.log('[AUTH_STORE] Setting offline mode:', offline);
          set({ isOfflineMode: offline });
        }
      },
      
      clearCache: () => {
        console.log('[AUTH_STORE] Clearing user cache');
        set({ 
          lastKnownUser: null,
          isOfflineMode: false 
        });
      },
      
      // Computed getters
      getDisplayName: () => {
        const { lastKnownUser } = get();
        if (!lastKnownUser) return 'User';
        
        return lastKnownUser.name || 
               lastKnownUser.email?.split('@')[0] || 
               'User';
      },
      
      getUserInitials: () => {
        const displayName = get().getDisplayName();
        return displayName.slice(0, 2).toUpperCase();
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist everything except computed functions
      partialize: (state) => ({
        preferences: state.preferences,
        lastKnownUser: state.lastKnownUser,
        isOfflineMode: state.isOfflineMode,
      }),
    }
  )
);

// console.log("[AUTH] Zustand auth store initialized. Initial state:", useAuthStore.getState());

// HMR: Accept hot updates for this module to preserve auth state
if (import.meta.hot) {
  import.meta.hot.accept();
}
