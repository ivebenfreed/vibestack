import React from 'react'
import { NodeProps } from '@xyflow/react'

export interface TimeMarkerNodeData {
  date: Date
  label: string
}

export function TimeMarkerNode({ data }: NodeProps<TimeMarkerNodeData>) {
  return (
    <div className="flex flex-col items-center pointer-events-none">
      {/* Vertical grid line */}
      <div className="w-px h-screen bg-border/30 absolute top-0"></div>
      
      {/* Date label */}
      <div className="bg-muted/80 backdrop-blur-sm border rounded px-2 py-1 text-xs font-medium text-muted-foreground z-10">
        {data.label}
      </div>
    </div>
  )
}