/**
 * TaskCard - Task-specific card component for Kanban view
 * 
 * Displays task information in a card format with proper styling and interactions
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { CalendarDays, Clock, User2 } from 'lucide-react'
import { format } from 'date-fns'
// import type { Task } from '@repo/dataforge/client-entities' // DEPRECATED - now using @/db/client-entities
import type { Task } from '@/db/client-entities'

interface TaskCardProps {
  task: Task
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return null
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      return format(dateObj, 'MMM d')
    } catch {
      return null
    }
  }

  return (
    <div className="p-3">
      {/* Title only for now */}
      <div className="font-medium text-sm leading-tight">
        {task.title}
      </div>
    </div>
  )
}

export default TaskCard