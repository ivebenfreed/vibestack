import { useState, useEffect } from 'react'
import { useAuth } from '@/state-machines'

interface TrialStatus {
  isTrialOrg: boolean
  trialEndsAt: string | null
  organizationName: string | null
  organizationId: string | null
  daysLeft: number | null
}

const defaultStatus: TrialStatus = {
  isTrialOrg: false,
  trialEndsAt: null,
  organizationName: null,
  organizationId: null,
  daysLeft: null
}

export function useTrialStatus(): TrialStatus {
  const { currentOrganization, userOrganizations } = useAuth()
  const [status, setStatus] = useState<TrialStatus>(defaultStatus)
  
  useEffect(() => {
    // First, try to get trial info from currentOrganization if it has the data
    if (currentOrganization?.id) {
      // Check if we have the organization data in userOrganizations (which may have more details)
      const fullOrgData = userOrganizations?.find(org => org.id === currentOrganization.id)
      
      if (fullOrgData) {
        // Check if this organization has trial data
        const isTrialOrg = fullOrgData.subscription_tier === 'trial' && (fullOrgData.subscription_status === 'trial' || fullOrgData.subscription_status === 'trialing')
        const trialEndsAt = fullOrgData.trial_ends_at || (isTrialOrg ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null)
        
        let daysLeft = null
        if (trialEndsAt) {
          const now = new Date()
          const endDate = new Date(trialEndsAt)
          const difference = endDate.getTime() - now.getTime()
          daysLeft = Math.ceil(difference / (1000 * 60 * 60 * 24))
        }
        
        const newStatus = {
          isTrialOrg,
          trialEndsAt,
          organizationName: fullOrgData.name || currentOrganization.name,
          organizationId: currentOrganization.id,
          daysLeft
        }
        
        setStatus(newStatus)
        return
      }
      
      // Fallback: Use currentOrganization data if available
      if (currentOrganization.subscription_tier) {
        const isTrialOrg = currentOrganization.subscription_tier === 'trial' && (currentOrganization.subscription_status === 'trial' || currentOrganization.subscription_status === 'trialing')
        const trialEndsAt = currentOrganization.trial_ends_at || (isTrialOrg ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null)
        
        let daysLeft = null
        if (trialEndsAt) {
          const now = new Date()
          const endDate = new Date(trialEndsAt)
          const difference = endDate.getTime() - now.getTime()
          daysLeft = Math.ceil(difference / (1000 * 60 * 60 * 24))
        }
        
        const newStatus = {
          isTrialOrg,
          trialEndsAt,
          organizationName: currentOrganization.name,
          organizationId: currentOrganization.id,
          daysLeft
        }
        
        setStatus(newStatus)
        return
      }
    }
    
    // If no organization or no trial data, set to default
    setStatus(defaultStatus)
  }, [currentOrganization, userOrganizations])
  
  return status
}