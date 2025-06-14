import { useMemo } from 'react'
// Remove authClient.useSession() import to stop duplicate HTTP requests
// import { authClient } from '@/lib/auth' 
import { useAuth as useOrchestratorAuth } from '@/state-machines/orchestrator-hooks'
import type { UserInfo } from '@/state-machines/types'

export function useAuth() {
  // Only use orchestrator auth state - no more duplicate HTTP requests
  const { 
    user,
    displayName: xstateDisplayName,
    initials: xstateInitials,
    authToken,
    isAuthenticated,
    isSigningIn,
    isSigningOut,
    authError,
    signIn,
    signOut
  } = useOrchestratorAuth()
  
  // Computed properties based on orchestrator state only
  const isAdmin = useMemo(() => 
    user?.role === 'admin' || user?.role === 'super_admin', 
    [user?.role]
  )
  
  const displayName = useMemo(() => 
    user?.name || user?.email?.split('@')[0] || xstateDisplayName || 'User',
    [user?.name, user?.email, xstateDisplayName]
  )
  
  return {
    // User info from orchestrator
    user,
    displayUser: user,
    
    // Auth state from orchestrator
    isAuthenticated,
    isLoading: isSigningIn,
    error: authError,
    
    // Computed properties
    isAdmin,
    isSuperAdmin: user?.role === 'super_admin',
    isMember: user?.role === 'member',
    isViewer: user?.role === 'viewer',
    canAccessDebug: isAdmin,
    displayName,
    initials: user ? displayName.slice(0, 2).toUpperCase() : xstateInitials,
    
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