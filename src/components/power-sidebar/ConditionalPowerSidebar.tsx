import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { currentOrgFeatureFlags$ } from '@/legend-state/observables/feature-flags'
import { UnifiedPowerSidebar } from './UnifiedPowerSidebar'
import { TraditionalOrgSidebar } from './TraditionalOrgSidebar'

export const ConditionalPowerSidebar = observer(({
  isCollapsed
}: {
  isCollapsed?: boolean
}) => {
  const featureFlags = use$(currentOrgFeatureFlags$)
  const isUniverseMode = featureFlags.universe_mode === true

  console.log('[ConditionalSidebar] Feature flags:', featureFlags)
  console.log('[ConditionalSidebar] Universe mode:', isUniverseMode)

  return isUniverseMode
    ? <UnifiedPowerSidebar isCollapsed={isCollapsed} />
    : <TraditionalOrgSidebar isCollapsed={isCollapsed} />
})