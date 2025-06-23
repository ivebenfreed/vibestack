import React from 'react'
// import { useAuth } from '@/hooks/useSimpleAuth' // 🔥 REPLACED with V2 orchestrator hook
import { VibestackPGliteProvider } from '../../db/pglite-provider'
import { AbilityProvider } from '@/contexts/AbilityContext'
import { NavigationProgress } from '@/components/navigation-progress'
// 🔥 UPDATED: Use V2 orchestrator hooks
import { useAuth } from '@/state-machines/orchestrator-hooks-v2'

// Auth-aware wrapper component for database and sync services
export function AuthAwareProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isCheckingAuth, isSigningOut } = useAuth()
  
  // 🔥 SIMPLIFIED: Just check auth state - no triple checking with orchestrator
  // When auth completes, it directly triggers init via event
  console.log('[AuthAwareProviders] Auth state:', { 
    isAuthenticated, 
    isCheckingAuth,
    isSigningOut,
    shouldMountDatabase: isAuthenticated && !isCheckingAuth && !isSigningOut
  });
  
  // Simple rule: mount database when authenticated and not checking or signing out
  if (isAuthenticated && !isCheckingAuth && !isSigningOut) {
    return (
      <VibestackPGliteProvider>
        <AbilityProvider>
          <AppLayout>{children}</AppLayout>
        </AbilityProvider>
      </VibestackPGliteProvider>
    )
  }
  
  // Unauthenticated, auth check in progress, or signing out: Don't render children during sign-out
  return (
    <AbilityProvider>
      <PublicLayout>
        {isSigningOut ? null : children}
      </PublicLayout>
    </AbilityProvider>
  )
}

// Authenticated app layout
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <NavigationProgress />
      <div className="flex flex-1 relative">
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// Public/unauthenticated layout
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 relative">
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
} 