import React from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Diamond, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface MilestoneNodeData {
  id: string
  title: string
  dueDate: string
  status: 'pending' | 'achieved' | 'overdue'
  description?: string
  importance: 'low' | 'medium' | 'high' | 'critical'
}

const statusColors = {
  pending: 'bg-yellow-500',
  achieved: 'bg-green-500',
  overdue: 'bg-red-500',
}

const importanceColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export function MilestoneNode({ data, selected }: NodeProps<MilestoneNodeData>) {
  const statusColor = data.status === 'achieved' ? '#10b981' : 
                     data.status === 'overdue' ? '#ef4444' : '#f59e0b'

  return (
    <div
      className={cn(
        'flex items-center cursor-grab active:cursor-grabbing transition-all duration-200',
        selected ? 'scale-105' : ''
      )}
      style={{ 
        height: '32px', // Same height as tasks
      }}
    >
      {/* Left handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-orange-500 !w-2 !h-2 !border !border-white !opacity-0 hover:!opacity-100"
        style={{ left: '-6px' }}
      />
      
      {/* Milestone diamond indicator */}
      <div 
        className={cn(
          'w-4 h-4 border-2 border-white rotate-45 shadow-sm',
          selected ? 'border-blue-300' : ''
        )}
        style={{ backgroundColor: statusColor }}
      />
      
      {/* Milestone title */}
      <div className="ml-3 flex-1">
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          {data.title}
        </span>
      </div>
      
      {/* Right handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-orange-500 !w-2 !h-2 !border !border-white !opacity-0 hover:!opacity-100"
        style={{ right: '-6px' }}
      />
    </div>
  )
}