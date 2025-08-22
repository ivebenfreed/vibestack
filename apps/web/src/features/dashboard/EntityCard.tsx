import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  Settings
} from 'lucide-react'

interface EntityCardProps {
  entityName: string
  entityDef: any
  count: number | string
}

export function EntityCard({ entityName, entityDef, count }: EntityCardProps) {
  const archetype = entityDef?.extends || 'record'
  
  // Get appropriate icon based on entity name or archetype
  const getEntityIcon = () => {
    const entityLower = entityName.toLowerCase()
    const archetypeLower = archetype.toLowerCase()
    
    if (entityLower.includes('client') || entityLower.includes('customer')) {
      return <Users className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('project') || archetypeLower.includes('project')) {
      return <Briefcase className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('task') || archetypeLower.includes('task')) {
      return <CheckSquare className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('time') || entityLower.includes('timesheet')) {
      return <Clock className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('invoice') || entityLower.includes('billing')) {
      return <CreditCard className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('product') || entityLower.includes('item')) {
      return <Package className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('event') || entityLower.includes('calendar')) {
      return <Calendar className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('folder') || entityLower.includes('category')) {
      return <FolderOpen className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('document') || archetypeLower.includes('document')) {
      return <FileText className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('file') || archetypeLower.includes('file')) {
      return <File className="text-muted-foreground h-4 w-4" />
    } else if (archetypeLower.includes('discussion') || entityLower.includes('comment')) {
      return <MessageCircle className="text-muted-foreground h-4 w-4" />
    } else if (entityLower.includes('setting') || entityLower.includes('config')) {
      return <Settings className="text-muted-foreground h-4 w-4" />
    } else {
      return <Database className="text-muted-foreground h-4 w-4" />
    }
  }

  const getEntityDescription = () => {
    const entityLower = entityName.toLowerCase()
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
    return `${entityName} records`
  }

  return (
    <Link to="/entities/$entityName" params={{ entityName }}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>
            {entityName}
          </CardTitle>
          {getEntityIcon()}
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{count.toLocaleString()}</div>
          <p className='text-muted-foreground text-xs'>
            {getEntityDescription()}
          </p>
          <div className='text-muted-foreground text-xs mt-2 space-y-1'>
            <p>Type: <span className='font-medium'>{archetype}</span></p>
            <p>Table: <span className='font-medium'>{entityDef.tableName?.split('_').pop() || 'unknown'}</span></p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}