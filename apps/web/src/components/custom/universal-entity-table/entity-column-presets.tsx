import { ColumnDef } from '@tanstack/react-table'
import { Task, TaskStatus, TaskPriority, Project, ProjectStatus, User } from '@repo/dataforge/client-entities'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * Preset Task Columns
 */
export function createTaskColumns(options?: {
  enableOptimisticUpdates?: boolean
  updateMutation?: any
  onTaskUpdated?: (task: Task) => void
}): ColumnDef<Task, any>[] {
  const { enableOptimisticUpdates = true, updateMutation, onTaskUpdated } = options || {}

  return [
    {
      accessorKey: 'title',
      header: 'Title',
      size: 200,
      minSize: 150,
      maxSize: 400,
      cell: ({ getValue, row }) => {
        const isOptimistic = enableOptimisticUpdates && 
          updateMutation?.isPending && 
          updateMutation?.variables?.id === row.original.id
        
        return (
          <div className={cn(
            "font-medium truncate",
            isOptimistic && "opacity-70"
          )}>
            {getValue() as string}
            {isOptimistic && <Loader2 className="ml-2 h-3 w-3 animate-spin inline" />}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      minSize: 100,
      maxSize: 150,
      cell: ({ getValue, row }) => {
        const status = getValue() as TaskStatus
        const isOptimistic = enableOptimisticUpdates && 
          updateMutation?.isPending && 
          updateMutation?.variables?.id === row.original.id &&
          'status' in (updateMutation?.variables?.data || {})
        
        const getStatusColor = (status: TaskStatus) => {
          switch (status) {
            case TaskStatus.OPEN:
              return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            case TaskStatus.IN_PROGRESS:
              return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            case TaskStatus.COMPLETED:
              return 'bg-green-100 text-green-800 hover:bg-green-200'
            default:
              return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }
        }
        
        return (
          <div className={cn(isOptimistic && "opacity-70")}>
            <Badge variant="secondary" className={getStatusColor(status)}>
              {status.replace('_', ' ')}
            </Badge>
            {isOptimistic && <Loader2 className="ml-2 h-3 w-3 animate-spin inline" />}
          </div>
        )
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      size: 100,
      minSize: 80,
      maxSize: 120,
      cell: ({ getValue }) => {
        const priority = getValue() as TaskPriority
        
        const getPriorityColor = (priority: TaskPriority) => {
          switch (priority) {
            case TaskPriority.LOW:
              return 'bg-gray-100 text-gray-800'
            case TaskPriority.MEDIUM:
              return 'bg-blue-100 text-blue-800'
            case TaskPriority.HIGH:
              return 'bg-orange-100 text-orange-800'
            default:
              return 'bg-gray-100 text-gray-800'
          }
        }
        
        return (
          <Badge variant="outline" className={getPriorityColor(priority)}>
            {priority}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      size: 120,
      cell: ({ getValue }) => {
        const date = getValue() as Date | null
        if (!date) return <span className="text-muted-foreground">-</span>
        
        const isOverdue = new Date(date) < new Date()
        const formattedDate = new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
        }).format(new Date(date))
        
        return (
          <span className={cn(
            isOverdue && "text-red-600 font-medium"
          )}>
            {formattedDate}
          </span>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      size: 120,
      cell: ({ getValue }) => {
        const date = getValue() as Date
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
        }).format(new Date(date))
      },
    },
  ]
}

/**
 * Preset Project Columns
 */
export function createProjectColumns(options?: {
  enableOptimisticUpdates?: boolean
  updateMutation?: any
  onProjectUpdated?: (project: Project) => void
}): ColumnDef<Project, any>[] {
  const { enableOptimisticUpdates = true, updateMutation } = options || {}

  return [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
      minSize: 150,
      maxSize: 400,
      cell: ({ getValue, row }) => {
        const isOptimistic = enableOptimisticUpdates && 
          updateMutation?.isPending && 
          updateMutation?.variables?.id === row.original.id
        
        return (
          <div className={cn(
            "font-medium truncate",
            isOptimistic && "opacity-70"
          )}>
            {getValue() as string}
            {isOptimistic && <Loader2 className="ml-2 h-3 w-3 animate-spin inline" />}
          </div>
        )
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 300,
      cell: ({ getValue }) => {
        const description = getValue() as string | null
        return (
          <div className="max-w-[300px] truncate text-muted-foreground">
            {description || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      cell: ({ getValue }) => {
        const status = getValue() as ProjectStatus
        
        const getStatusColor = (status: ProjectStatus) => {
          switch (status) {
            case ProjectStatus.ACTIVE:
              return 'bg-green-100 text-green-800'
            case ProjectStatus.IN_PROGRESS:
              return 'bg-blue-100 text-blue-800'
            case ProjectStatus.COMPLETED:
              return 'bg-gray-100 text-gray-800'
            case ProjectStatus.ON_HOLD:
              return 'bg-yellow-100 text-yellow-800'
            default:
              return 'bg-gray-100 text-gray-800'
          }
        }
        
        return (
          <Badge variant="secondary" className={getStatusColor(status)}>
            {status.replace('_', ' ')}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      size: 120,
      cell: ({ getValue }) => {
        const date = getValue() as Date
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(date))
      },
    },
  ]
}

/**
 * Preset User Columns
 */
export function createUserColumns(options?: {
  enableOptimisticUpdates?: boolean
  updateMutation?: any
  onUserUpdated?: (user: User) => void
}): ColumnDef<User, any>[] {
  const { enableOptimisticUpdates = true, updateMutation } = options || {}

  return [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
      minSize: 150,
      maxSize: 300,
      cell: ({ getValue, row }) => {
        const isOptimistic = enableOptimisticUpdates && 
          updateMutation?.isPending && 
          updateMutation?.variables?.id === row.original.id
        
        return (
          <div className={cn(
            "font-medium truncate",
            isOptimistic && "opacity-70"
          )}>
            {getValue() as string}
            {isOptimistic && <Loader2 className="ml-2 h-3 w-3 animate-spin inline" />}
          </div>
        )
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      size: 250,
      cell: ({ getValue }) => (
        <div className="max-w-[250px] truncate">
          {getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Joined',
      size: 120,
      cell: ({ getValue }) => {
        const date = getValue() as Date
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(date))
      },
    },
  ]
} 