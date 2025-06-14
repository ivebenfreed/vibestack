import React from 'react'
import { useAuth } from '@/hooks/useSimpleAuth'
import { VibestackPGliteProvider } from '../../db/pglite-provider'
import { AbilityProvider } from '@/contexts/AbilityContext'
import { NavigationProgress } from '@/components/navigation-progress'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'
// 🔥 UPDATED: No longer need to create actor here - it's provided at root level
import { useOrchestrator } from '@/state-machines/orchestrator-hooks'

// Auth-aware wrapper component for database and sync services
export function AuthAwareProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth() // Use new simple hook (one clean dependency)
  
  if (isAuthenticated) {
    return (
      <VibestackPGliteProvider>
        <AbilityProvider>
          <AppLayout>{children}</AppLayout>
        </AbilityProvider>
      </VibestackPGliteProvider>
    )
  }
  
  // Unauthenticated: Simpler layout without database/sync providers
  return (
    <AbilityProvider>
      <PublicLayout>
        {children}
      </PublicLayout>
    </AbilityProvider>
  )
}

// Authenticated app layout
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <NavigationProgress />
      <UnifiedLoadingScreen />
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