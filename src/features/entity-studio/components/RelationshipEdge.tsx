/**
 * RelationshipEdge Component
 * Custom edge styling for entity relationships
 */

import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow'

export const RelationshipEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  })

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 10,
            pointerEvents: 'all'
          }}
          className="nodrag nopan bg-background/90 px-1.5 py-0.5 rounded border border-border text-muted-foreground"
        >
          {data?.label || ''}
        </div>
      </EdgeLabelRenderer>
    </>
  )
})

RelationshipEdge.displayName = 'RelationshipEdge'
