import React, { useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Calendar, Clock, User, GripHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface TaskNodeData {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignee?: string
  startDate: string
  endDate: string
  progress: number
  description?: string
}

const statusColors = {
  todo: '#6b7280',     // gray-500
  in_progress: '#3b82f6', // blue-500
  completed: '#10b981',   // green-500
  blocked: '#ef4444',     // red-500
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
}

export function TaskNode({ data, selected }: NodeProps<TaskNodeData>) {
  const [isHovered, setIsHovered] = useState(false)
  const statusColor = statusColors[data.status]
  
  // Calculate task width based on duration
  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const width = Math.max(120, durationDays * 25) // 25px per day, minimum 120px

  return (
    <div
      className={cn(
        'bg-background border rounded shadow-sm transition-all duration-200 flex items-center relative group cursor-grab active:cursor-grabbing timeline-drag-handle',
        selected ? 'border-blue-500 shadow-md ring-2 ring-blue-200' : 'border-border hover:border-blue-300',
        isHovered && 'shadow-lg',
        data.status === 'in_progress' && 'task-node-in-progress'
      )}
      style={{ 
        width,
        height: '32px', // Better height for taller lanes
        backgroundColor: statusColor
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left Connection Handle (INPUT) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${data.id}-input`}
        className={cn(
          "!bg-green-500 !w-3 !h-3 !border-2 !border-white !shadow-sm transition-opacity duration-200",
          selected || isHovered ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100"
        )}
        style={{ left: -6 }}
        isConnectable={true}
      />
      
      {/* Task Content */}
      <div className="px-3 flex-1 overflow-hidden flex items-center justify-between">
        <span className="text-sm font-medium text-white truncate">
          {data.title}
        </span>
        
        {/* Duration indicator */}
        {(selected || isHovered) && (
          <span className="text-xs text-white/80 ml-2 shrink-0">
            {durationDays}d
          </span>
        )}
      </div>
      
      {/* Right Connection Handle (OUTPUT) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${data.id}-output`}
        className={cn(
          "!bg-orange-500 !w-3 !h-3 !border-2 !border-white !shadow-sm transition-opacity duration-200",
          selected || isHovered ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100"
        )}
        style={{ right: -6 }}
        isConnectable={true}
      />
      
      {/* Progress indicator (bottom bar) */}
      {data.progress > 0 && (
        <div 
          className="absolute bottom-0 left-0 h-1 bg-white/50 rounded-b"
          style={{ width: `${(data.progress / 100) * width}px` }}
        />
      )}
    </div>
  )
}