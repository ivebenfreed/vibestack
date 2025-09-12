import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Layers, User, Briefcase } from 'lucide-react'
import { navigationMode$, type NavigationMode } from '@/legend-state/observables/navigation-mode'

export const ModeSwitcher = observer(function ModeSwitcher() {
  const mode = use$(navigationMode$)
  
  return (
    <div className="px-3 py-2">
      <ToggleGroup 
        type="single"
        value={mode} 
        onValueChange={(value) => {
          if (value) navigationMode$.set(value as NavigationMode)
        }}
        className="w-full justify-stretch"
      >
        <ToggleGroupItem value="all" className="flex-1 data-[state=on]:bg-sidebar-accent">
          <Layers className="h-3 w-3 mr-1" />
          <span className="text-xs">All</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="personal" className="flex-1 data-[state=on]:bg-sidebar-accent">
          <User className="h-3 w-3 mr-1" />
          <span className="text-xs">Personal</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="work" className="flex-1 data-[state=on]:bg-sidebar-accent">
          <Briefcase className="h-3 w-3 mr-1" />
          <span className="text-xs">Work</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
})