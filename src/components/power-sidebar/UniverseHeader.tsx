import { observer } from '@legendapp/state/react'
import { Globe, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export const UniverseHeader = observer(function UniverseHeader({ 
  userId,
  totalPersonalWorlds,
  totalOrganizations,
  isCollapsed 
}: {
  userId?: string
  totalPersonalWorlds: number
  totalOrganizations: number
  isCollapsed?: boolean
}) {
  
  if (isCollapsed) {
    return null
  }
  
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="h-5 w-5 text-primary" />
        <span className="font-semibold text-lg">My Universe</span>
      </div>
      
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span>Personal</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {totalPersonalWorlds} worlds
        </Badge>
      </div>
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Organizations</span>
        <Badge variant="outline" className="text-xs">
          {totalOrganizations}
        </Badge>
      </div>
      
      <Separator className="mt-3" />
    </div>
  )
})