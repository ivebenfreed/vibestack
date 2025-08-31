import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ModeSwitcher } from './ModeSwitcher'
import { PowerSearch } from './PowerSearch'
import { UniverseSection } from './UniverseSection'
import { BusinessWorldsSection } from './BusinessWorldsSection'
import { EntitiesSection } from './EntitiesSection'
import { QuickLinks } from './QuickLinks'
import { filteredContent$, navigationMode$ } from '@/legend-state/observables/navigation-mode'

export const PowerSidebar = observer(function PowerSidebar({ isCollapsed }: { isCollapsed?: boolean }) {
  const content = use$(filteredContent$)
  const mode = use$(navigationMode$)
  
  if (!content) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      {!isCollapsed && (
        <div className="flex-shrink-0">
          <ModeSwitcher />
          <Separator />
          <PowerSearch mode={mode} />
          <Separator />
        </div>
      )}
      
      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-4">
          <QuickLinks mode={mode} isCollapsed={isCollapsed} />
          
          {content.showUniverse && content.universe && (
            <>
              <Separator className="my-2" />
              <UniverseSection 
                universe={content.universe}
                personalWorlds={content.personalWorlds}
                isCollapsed={isCollapsed}
              />
            </>
          )}
          
          {content.showBusinessWorlds && content.businessWorlds.length > 0 && (
            <>
              <Separator className="my-2" />
              <BusinessWorldsSection
                worlds={content.businessWorlds}
                isCollapsed={isCollapsed}
              />
            </>
          )}
          
          <Separator className="my-2" />
          <EntitiesSection 
            mode={mode}
            isCollapsed={isCollapsed}
          />
        </div>
      </ScrollArea>
    </div>
  )
})