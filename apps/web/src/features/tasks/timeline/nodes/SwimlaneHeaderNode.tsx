import React from 'react'
import { NodeProps } from '@xyflow/react'

export interface SwimlaneHeaderNodeData {
  title: string
  description?: string
  nodeCount: number
}

export function SwimlaneHeaderNode({ data }: NodeProps<SwimlaneHeaderNodeData>) {
  return (
    <div className="bg-muted/50 border rounded-l-lg p-3 w-48 pointer-events-none">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{data.title}</h3>
        <span className="text-xs bg-background border rounded px-1.5 py-0.5">
          {data.nodeCount}
        </span>
      </div>
      
      {data.description && (
        <p className="text-xs text-muted-foreground mt-1">
          {data.description}
        </p>
      )}
    </div>
  )
}