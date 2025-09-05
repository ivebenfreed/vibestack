import React from 'react'
import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  Database, 
  Users, 
  Briefcase, 
  CheckSquare, 
  Clock, 
  FileText, 
  File, 
  MessageCircle,
  FolderOpen,
  Calendar,
  CreditCard,
  Package,
  Settings,
  Activity,
  Layers,
  MoreVertical,
  Trash2,
  Edit
} from 'lucide-react'

interface EntityCardProps {
  entityName: string
  entityDef: any
  count: number | string
  archetype?: string
  orgId?: string // Organization ID for routing context
  isUniverseMode?: boolean // Whether we're in universe view
  onDelete?: (entityName: string) => void
}

// DataForge archetype icons and colors
const ARCHETYPE_CONFIG = {
  project: { icon: FolderOpen, color: 'bg-blue-500/10 text-blue-600', label: 'Project' },
  task: { icon: CheckSquare, color: 'bg-green-500/10 text-green-600', label: 'Task' },
  record: { icon: Database, color: 'bg-purple-500/10 text-purple-600', label: 'Record' },
  document: { icon: FileText, color: 'bg-yellow-500/10 text-yellow-600', label: 'Document' },
  file: { icon: File, color: 'bg-orange-500/10 text-orange-600', label: 'File' },
  activity: { icon: Activity, color: 'bg-red-500/10 text-red-600', label: 'Activity' },
  discussion: { icon: MessageCircle, color: 'bg-pink-500/10 text-pink-600', label: 'Discussion' },
  collection: { icon: Layers, color: 'bg-indigo-500/10 text-indigo-600', label: 'Collection' },
}

export function EntityCard({ entityName, entityDef, count, archetype: propArchetype, orgId, isUniverseMode, onDelete }: EntityCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  
  const archetype = propArchetype || entityDef?.archetype || entityDef?.extends || 'record'
  const archetypeConfig = ARCHETYPE_CONFIG[archetype.toLowerCase() as keyof typeof ARCHETYPE_CONFIG] || ARCHETYPE_CONFIG.record
  const Icon = archetypeConfig.icon

  const handleDelete = async () => {
    if (!onDelete) return
    
    setIsDeleting(true)
    try {
      await onDelete(entityName)
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error('Failed to delete entity:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  
  // Get the clean display name for use in descriptions and icon detection
  const displayName = entityDef?._originalName || entityName;

  // Override icon for specific entity names
  const getEntityIcon = () => {
    const entityLower = displayName.toLowerCase()
    
    // Special cases based on entity name
    if (entityLower.includes('client') || entityLower.includes('customer')) {
      return <Users className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('time') || entityLower.includes('timesheet')) {
      return <Clock className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('invoice') || entityLower.includes('billing')) {
      return <CreditCard className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('product') || entityLower.includes('item')) {
      return <Package className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('event') || entityLower.includes('calendar')) {
      return <Calendar className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('setting') || entityLower.includes('config')) {
      return <Settings className="text-muted-foreground h-4 w-4" />
    } else {
      // Use archetype icon
      return <Icon className="text-muted-foreground h-4 w-4" />
    }
  }

  const getEntityDescription = () => {
    const entityLower = displayName.toLowerCase()
    if (entityLower.includes('client') || entityLower.includes('customer')) return 'Business clients'
    if (entityLower.includes('project')) return 'Project records'
    if (entityLower.includes('task')) return 'Task records'
    if (entityLower.includes('time')) return 'Time entries'
    if (entityLower.includes('invoice')) return 'Invoice records'
    if (entityLower.includes('product')) return 'Product items'
    if (entityLower.includes('event')) return 'Calendar events'
    if (entityLower.includes('folder')) return 'Folder categories'
    if (entityLower.includes('document')) return 'Document records'
    if (entityLower.includes('file')) return 'File records'
    if (entityLower.includes('discussion')) return 'Discussion records'
    if (entityLower.includes('setting')) return 'Configuration settings'
    return `${displayName} records`
  }

  // Navigate to universe view with entity filter
  const getEntityRoute = () => {
    // In universe mode, extract org ID and original name from the prefixed entity name
    const targetOrgId = entityDef?._orgId
    const cleanEntityName = entityDef?._originalEntityName || entityName
    
    // Always use universe route - org filtering is just a view parameter
    // The entity name in universe mode includes the org prefix for uniqueness
    return {
      to: "/universe" as const,
      params: {},
      // Could add search params for filtering in the future
      // search: { entity: entityName, org: targetOrgId }
    }
  }

  const route = getEntityRoute()

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer relative group overflow-visible">
        <Link to={route.to} params={route.params} className="block">
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className="flex items-center gap-2">
              <CardTitle className='text-sm font-medium'>
                {displayName}
              </CardTitle>
              <Badge variant="secondary" className={archetypeConfig.color}>
                {archetypeConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {getEntityIcon()}
              {onDelete && (
                <div onClick={handleActionClick}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={5} className="z-50">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDeleteDialogOpen(true)
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Entity Type
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{count.toLocaleString()}</div>
            <p className='text-muted-foreground text-xs'>
              {getEntityDescription()}
            </p>
            <div className='text-muted-foreground text-xs mt-2'>
              <p>Table: <span className='font-medium'>{entityDef.tableName?.split('_').pop() || 'unknown'}</span></p>
            </div>
          </CardContent>
        </Link>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entity Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{displayName}" entity type? This action will:
              <br />
              <br />
              • Remove the entity definition from your organization
              <br />
              • Delete all data in the {entityDef.tableName?.split('_').pop() || 'entity'} table
              <br />
              • Remove the entity from all menus and dashboards
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Entity Type'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}