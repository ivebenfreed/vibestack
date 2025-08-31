import { createFileRoute } from '@tanstack/react-router'
import React, { useState, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// Simple task node component
function TaskNode({ data }: { data: { title: string } }) {
  return (
    <div className="px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium">
      {data.title}
    </div>
  )
}

// Simple object - no need for useMemo outside component
const nodeTypes = {
  task: TaskNode,
}

function ReactFlowPositioningDebug() {
  const reactFlow = useReactFlow()
  
  // Single test node at various positions
  const [testY, setTestY] = useState(0)
  
  const initialNodes: Node[] = [
    {
      id: 'test-task',
      type: 'task',
      position: { x: 200, y: testY },
      data: { title: `Test Task Y=${testY}` },
    },
  ]

  const [nodes, setNodes] = useNodesState(initialNodes)
  const [edges] = useEdgesState([])

  // Update node position when testY changes
  useEffect(() => {
    setNodes([
      {
        id: 'test-task',
        type: 'task',
        position: { x: 200, y: testY },
        data: { title: `Test Task Y=${testY}` },
      },
    ])
  }, [testY, setNodes])

  const handleFitView = () => {
    reactFlow.fitView()
  }

  const handleResetViewport = () => {
    reactFlow.setViewport({ x: 0, y: 0, zoom: 1 })
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Controls */}
      <div className="p-4 border-b bg-muted/50">
        <h1 className="text-xl font-bold mb-4">React Flow Positioning Debug</h1>
        
        <div className="flex gap-4 items-center mb-4">
          <label className="flex items-center gap-2">
            Y Position:
            <input
              type="range"
              min="-500"
              max="500"
              value={testY}
              onChange={(e) => setTestY(Number(e.target.value))}
              className="w-48"
            />
            <span className="w-16 text-sm font-mono">{testY}px</span>
          </label>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleFitView}
            className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
          >
            Fit View
          </button>
          <button 
            onClick={handleResetViewport}
            className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/90"
          >
            Reset Viewport (0,0,1)
          </button>
        </div>
      </div>

      {/* Reference markers */}
      <div className="flex-1 relative">
        {/* Reference line at top */}
        <div 
          className="absolute left-0 right-0 h-1 bg-red-500 z-10"
          style={{ top: 50 }}
        >
          <span className="absolute left-2 top-1 text-xs font-mono text-red-600">
            Reference Line at 50px from container top
          </span>
        </div>
        
        {/* Reference line at middle */}
        <div 
          className="absolute left-0 right-0 h-1 bg-green-500 z-10"
          style={{ top: '50%' }}
        >
          <span className="absolute left-2 top-1 text-xs font-mono text-green-600">
            Container center (50%)
          </span>
        </div>
        
        {/* React Flow */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          className="w-full h-full"
          // No constraints or extensions - pure React Flow
        >
        </ReactFlow>
      </div>
      
      {/* Debug info */}
      <div className="p-2 bg-muted text-xs font-mono">
        <div>Task Position: x=200, y={testY}</div>
        <div>Expected: Task should appear at Y={testY} pixels from React Flow's internal origin</div>
        <div>Compare task position to reference lines above</div>
      </div>
    </div>
  )
}

function ReactFlowPositioningDebugPage() {
  return (
    <ReactFlowProvider>
      <ReactFlowPositioningDebug />
    </ReactFlowProvider>
  )
}

export const Route = createFileRoute('/_authenticated/debug/reactflow-positioning')({
  component: ReactFlowPositioningDebugPage,
})