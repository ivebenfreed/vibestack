import { useMemo } from 'react'
// Remove authClient.useSession() import to stop duplicate HTTP requests
// import { authClient } from '@/lib/auth' 
import { useAuth as useOrchestratorAuth } from '@/state-machines'
import type { UserInfo } from '@/state-machines/types'

export function useAuth() {
  // Use orchestrator auth state with computed properties
  const { 
    user,
    authToken,
    isAuthenticated,
    isSigningIn,
    isSigningOut,
    authError,
    isAdmin,
    isSuperAdmin,
    displayName,
    initials,
    signIn,
    signOut
  } = useOrchestratorAuth()
  
  return {
    // User info from orchestrator
    user,
    displayUser: user,
    
    // Auth state from orchestrator
    isAuthenticated,
    isLoading: isSigningIn,
    error: authError,
    
    // Computed properties from v2 hook
    isAdmin,
    isSuperAdmin,
    isMember: user?.role === 'member',
    isViewer: user?.role === 'viewer',
    canAccessDebug: isAdmin,
    displayName,
    initials,
    
    // Actions from orchestrator
    signOut,
  }
}

// Simple role checking hook
export function useUserRole() {
  const { user } = useAuth()
  
  return {
    role: user?.role || 'member',
    isAdmin: user?.role === 'admin',
    isSuperAdmin: user?.role === 'super_admin', 
    isMember: user?.role === 'member',
    isViewer: user?.role === 'viewer',
    
    // Permission helpers
    canAccess: (feature: string): boolean => {
      if (!user) return false
      
      switch (feature) {
        case 'debug_features':
          return user.role === 'admin' || user.role === 'super_admin'
        case 'user_management':
          return user.role === 'admin' || user.role === 'super_admin'
        case 'project_create':
          return user.role !== 'viewer'
        case 'admin_panel':
          return user.role === 'admin' || user.role === 'super_admin'
        default:
          return true
      }
    }
  }
}

// Re-export UserInfo for compatibility
export type { UserInfo } from '@/state-machines/types' 