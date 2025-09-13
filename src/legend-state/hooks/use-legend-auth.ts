/**
 * Legend State Auth Hook - Integrates Better Auth with Legend State observables
 */

import { useEffect } from 'react'
import { useSession } from 'better-auth/react'
import { authClient } from '@/lib/auth'
import { log } from '@/logger'

const fileLog = log('legend-state/hooks/use-legend-auth')

export interface LegendAuthState {
  hasUser: boolean
  userEmail?: string
  organizationName?: string
  userOrganizationsCount: number
  isAuthenticated: boolean
  userId?: string
}

/**
 * Hook that provides auth state for Legend State system
 * Bridges Better Auth session data with Legend State observables
 */
export function useLegendAuth(): LegendAuthState {
  const { data: session, isPending } = useSession()
  
  fileLog.info('[useLegendAuth] Hook called with state:', {
    hasSession: !!session,
    sessionId: session?.session?.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    isPending
  })
  
  const hasUser = !!session?.user
  const userEmail = session?.user?.email
  const userId = session?.user?.id
  const organizationName = session?.user?.activeOrganization?.name || 'Throwaway Inc' // Default org name
  const userOrganizationsCount = session?.user?.organizations?.length || 0
  const isAuthenticated = hasUser && !isPending
  
  // Log auth state to Legend State AUTH$ observable
  useEffect(() => {
    if (isAuthenticated && userId) {
      fileLog.info('[AUTH$] User authenticated:', {
        userId,
        organizationName
      })
    }
  }, [isAuthenticated, userId, organizationName])
  
  return {
    hasUser,
    userEmail,
    organizationName,
    userOrganizationsCount,
    isAuthenticated,
    userId
  }
}