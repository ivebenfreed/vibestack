import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { currentOrgFeatureFlags$ } from '@/legend-state/observables/feature-flags'
import { UnifiedSidebar } from '@/components/layout/unified-sidebar'

export const ConditionalPowerSidebar = observer(({
  isCollapsed,
  onToggle
}: {
  isCollapsed?: boolean
  onToggle?: () => void
}) => {
  const featureFlags = use$(currentOrgFeatureFlags$)
  const isUniverseMode = featureFlags?.universe_mode === true

  console.log('[ConditionalSidebar] Feature flags:', featureFlags)
  console.log('[ConditionalSidebar] Universe mode:', isUniverseMode)

  // Check if we're on a universe route or org route to determine navigation mode
  const isOnUniverseRoute = typeof window !== 'undefined' &&
    (window.location.pathname === '/universe' || window.location.pathname.startsWith('/universe/'))

  // Use universe navigation only when on universe routes, regardless of feature flags
  const shouldShowUniverseNav = isUniverseMode && isOnUniverseRoute

  return <UnifiedSidebar isCollapsed={isCollapsed} isUniverseMode={shouldShowUniverseNav} onToggle={onToggle} />
})