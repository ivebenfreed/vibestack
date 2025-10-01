/**
 * EntityStudioView Component
 * React Flow container for entity graph visualization
 */

import React, { useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useEntityStudioData } from '../hooks/useEntityStudioData'
import { buildEntityGraph } from '../lib/graph-builder'
import { getHierarchicalLayout } from '../lib/layout-engine'
import { EntityNode } from './EntityNode'
import { RelationshipEdge } from './RelationshipEdge'

const nodeTypes = {
  entity: EntityNode
}

const edgeTypes = {
  relationship: RelationshipEdge
}

interface EntityStudioViewProps {
  orgId: string
}

export function EntityStudioView({ orgId }: EntityStudioViewProps) {
  const { schema, loading } = useEntityStudioData(orgId)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Build graph when schema changes
  useEffect(() => {
    if (!schema) return

    const { nodes: graphNodes, edges: graphEdges } = buildEntityGraph(schema)

    // Apply hierarchical layout (only option)
    const layoutedNodes = getHierarchicalLayout(graphNodes, graphEdges, 'BT')

    setNodes(layoutedNodes)
    setEdges(graphEdges)
  }, [schema, setNodes, setEdges])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading schema...</p>
        </div>
      </div>
    )
  }

  if (!schema || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">No entities found</p>
          <p className="text-sm text-muted-foreground">
            This organization doesn't have any entities yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'relationship',
          animated: false
        }}
      >
        <Background />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  )
}
