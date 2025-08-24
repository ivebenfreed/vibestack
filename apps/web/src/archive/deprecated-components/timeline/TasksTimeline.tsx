import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  NodeTypes,
  applyNodeChanges,
  ConnectionLineComponentProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './styles/timeline.css'

import { TaskNode } from './nodes/TaskNode'
import { MilestoneNode } from './nodes/MilestoneNode'
import { SwimlaneHeaderNode } from './nodes/SwimlaneHeaderNode'
import { applyTimelineLayout, TimelineSwimlane } from './utils/timelineLayout'
import { TimelineGrid, createTimelineGrid } from './utils/timelineGrid'
import { 
  applyTimelineConstraints, 
  updateTaskDatesFromPosition,
  getNearestSwimlane,
  TimelineConstraintConfig 
} from './utils/timelineConstraints'

// Import domain atoms for real data
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import type { Task } from '@repo/dataforge/client-entities'

// Define custom node types
const nodeTypes: NodeTypes = {
  task: TaskNode,
  milestone: MilestoneNode,
  swimlaneHeader: SwimlaneHeaderNode,
}

function TasksTimelineInner() {
  // Get real tasks from XState atoms
  const tasks = useSelector(tasksAtom, (tasksRecord) => {
    if (!tasksRecord || typeof tasksRecord !== 'object') return []
    
    // Get tasks with both start and due dates, sorted by startDate (earliest first)
    return Object.values(tasksRecord)
      .filter(task => task.startDate && task.dueDate)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 10) // First 10 tasks
  }, shallowEqual)

  // MOVED: Early return check to prevent hooks violation
  if (tasks.length === 0) {
    return (
      <div className="w-full h-[800px] border rounded-lg bg-background overflow-hidden flex items-center justify-center">
        <div className="text-center p-8">
          <h3 className="text-lg font-semibold mb-2">No Tasks to Display</h3>
          <p className="text-muted-foreground">
            No tasks with both start and due dates were found. 
            Create or update tasks with date ranges to see them in the timeline view.
          </p>
        </div>
      </div>
    )
  }

  // Get users for assignee names
  const users = useSelector(usersAtom, (usersRecord) => {
    if (!usersRecord || typeof usersRecord !== 'object') return {}
    return usersRecord
  }, shallowEqual)

  // Convert tasks to timeline nodes
  const initialNodes = useMemo(() => {
    return tasks.map((task, index): Node => {
      // Calculate progress based on status
      let progress = 0
      if (task.status === 'completed') progress = 100
      else if (task.status === 'in_progress') progress = 50

      // Get assignee name
      const assigneeName = task.assigneeId && users[task.assigneeId]
        ? users[task.assigneeId].name
        : 'Unassigned'

      return {
        id: task.id,
        type: 'task',
        position: { x: 100, y: 100 + (index * 150) }, // Initial positions
        dragHandle: '.timeline-drag-handle',
        data: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority || 'medium',
          assignee: assigneeName,
          startDate: task.startDate,
          endDate: task.dueDate,
          progress,
          description: task.description || '',
        },
      }
    })
  }, [tasks, users])

  const initialEdges: Edge[] = [] // No dependencies for now
  
  // Timeline configuration
  const timelineConfig = useMemo(() => ({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(new Date().setDate(new Date().getDate() + 40)),
    pixelsPerDay: 25,
    rowHeight: 60,  // Taller rows for better breathing room around task cards
    headerHeight: 100,
    leftMargin: 200,
    swimlaneGap: 2, // Minimal gap
  }), [])

  // Constraint configuration - MUST lock tasks to their lanes
  const constraintConfig: TimelineConstraintConfig = useMemo(() => ({
    enableSnapping: true,
    snapToGrid: true,
    lockToSwimlanes: true, // CRITICAL: Keep tasks in their assigned lanes
    minTimeUnit: 'day',
    snapTolerance: 12, // 12px snap tolerance
  }), [])

  // Helper function to calculate initial bounds
  const calculateInitialBounds = useCallback(() => {
    if (tasks.length === 0) {
      const today = new Date()
      return {
        startDate: new Date(today.getFullYear(), today.getMonth() - 2, 1),
        endDate: new Date(today.getFullYear(), today.getMonth() + 4, 0)
      }
    }
    
    const allStartDates = tasks.map(task => new Date(task.startDate))
    const allEndDates = tasks.map(task => new Date(task.dueDate))
    
    const earliestTask = new Date(Math.min(...allStartDates.map(d => d.getTime())))
    const latestTask = new Date(Math.max(...allEndDates.map(d => d.getTime())))
    
    return {
      startDate: new Date(earliestTask.getFullYear(), earliestTask.getMonth() - 1, 1),
      endDate: new Date(latestTask.getFullYear(), latestTask.getMonth() + 3, 0)
    }
  }, [tasks])

  // Timeline bounds state
  const [timelineBounds, setTimelineBounds] = useState(() => calculateInitialBounds())

  // Create grid instance 
  const [grid, setGrid] = useState(() => {
    const initialBounds = calculateInitialBounds()
    
    console.log(`🏗️ CREATING GRID with virtualized bounds: ${initialBounds.startDate.toISOString().split('T')[0]} to ${initialBounds.endDate.toISOString().split('T')[0]}`)
    
    return createTimelineGrid({
      startDate: initialBounds.startDate,
      endDate: initialBounds.endDate,
      pixelsPerDay: timelineConfig.pixelsPerDay,
      laneHeight: timelineConfig.rowHeight,
      laneGap: timelineConfig.swimlaneGap,
      headerHeight: timelineConfig.headerHeight,
      topPadding: 20
    })
  })

  // Update grid bounds when timeline bounds change
  useEffect(() => {
    console.log(`🔄 UPDATING GRID BOUNDS: ${timelineBounds.startDate.toISOString().split('T')[0]} to ${timelineBounds.endDate.toISOString().split('T')[0]}`)
    grid.updateBounds(timelineBounds.startDate, timelineBounds.endDate)
  }, [timelineBounds, grid])

  // Calculate initial scroll position to center on earliest task
  const initialScrollPosition = useMemo(() => {
    if (tasks.length === 0) {
      // No tasks - center on current date
      const today = new Date()
      return grid.dateToX(today) - 400 // Offset to show some days before today
    }
    
    // Find earliest task start date
    const earliestStartDate = tasks.reduce((earliest, task) => {
      const taskStart = new Date(task.startDate)
      return taskStart < earliest ? taskStart : earliest
    }, new Date(tasks[0].startDate))
    
    // Position to show 1 week before the earliest task
    const viewportStart = new Date(earliestStartDate)
    viewportStart.setDate(viewportStart.getDate() - 7)
    
    const scrollX = grid.dateToX(viewportStart)
    console.log(`📍 INITIAL VIEWPORT: Starting at ${viewportStart.toISOString().split('T')[0]} (X=${scrollX})`)
    
    return Math.max(0, scrollX) // Don't scroll to negative position
  }, [tasks, grid])

  // Set initial scroll position when component loads
  useEffect(() => {
    if (contentRef.current) {
      console.log(`🎯 SETTING INITIAL SCROLL: ${initialScrollPosition}px`)
      contentRef.current.scrollLeft = initialScrollPosition
      if (headerRef.current) {
        headerRef.current.scrollLeft = initialScrollPosition
      }
    }
  }, [initialScrollPosition]) // Only run when initial position changes

  // Apply layout with stable grid
  const { layoutedNodes, swimlanesInfo } = useMemo(() => {
    if (initialNodes.length === 0) {
      return { layoutedNodes: [], swimlanesInfo: [] }
    }

    console.log(`📐 APPLYING LAYOUT with stable grid for ${initialNodes.length} nodes`)
    
    // Configure lanes using the grid (this will reorder lanes by start date)
    const gridLanes = grid.configureLanes(initialNodes)
    
    // Position nodes using the grid - this ensures nodes move to their correct lane positions
    const positionedNodes: any[] = []
    const nodeIdToPositionedNode = new Map<string, any>()

    gridLanes.forEach(lane => {
      lane.nodes.forEach(node => {
        const position = grid.positionNode(node, lane)
        const positionedNode = {
          ...node,
          position
        }
        positionedNodes.push(positionedNode)
        nodeIdToPositionedNode.set(node.id, positionedNode)
        console.log(`📍 POSITIONED: "${(node.data as any).title}" at X=${position.x}, Y=${position.y} in lane "${lane.name}"`)
      })
    })

    // Update grid lanes to reference the positioned nodes
    gridLanes.forEach(lane => {
      lane.nodes = lane.nodes.map(node => nodeIdToPositionedNode.get(node.id) || node)
    })

    // Convert to legacy format
    const swimlanes = gridLanes.map(lane => ({
      id: lane.id,
      name: lane.name,
      y: lane.y,
      nodes: lane.nodes
    }))
    
    console.log(`📊 LAYOUT COMPLETE: ${positionedNodes.length} positioned nodes, ${swimlanes.length} swimlanes`)
    
    return {
      layoutedNodes: positionedNodes,
      swimlanesInfo: swimlanes
    }
  }, [initialNodes, grid])

  const [nodes, setNodes] = useNodesState(layoutedNodes)
  
  // Force React Flow to update node positions when layout changes
  useEffect(() => {
    if (layoutedNodes.length > 0) {
      console.log(`🔄 FORCING NODE POSITION UPDATE: ${layoutedNodes.length} nodes`)
      setNodes(layoutedNodes)
    }
  }, [layoutedNodes, setNodes])
  
  
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [swimlanes] = useState<TimelineSwimlane[]>(swimlanesInfo)
  const [dragInfo, setDragInfo] = useState<{
    isDragging: boolean
    nodeId: string | null
    currentY: number
    targetSwimlane: TimelineSwimlane | null
  }>({
    isDragging: false,
    nodeId: null,
    currentY: 0,
    targetSwimlane: null
  })

  // Refs for synchronized scrolling
  const headerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Handle synchronized horizontal scrolling with dynamic expansion
  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current && contentRef.current) {
      headerRef.current.scrollLeft = contentRef.current.scrollLeft
      
      // Check if we need to expand timeline when scrolling near edges
      const scrollLeft = contentRef.current.scrollLeft
      const scrollWidth = contentRef.current.scrollWidth
      const clientWidth = contentRef.current.clientWidth
      
      const nearStart = scrollLeft < clientWidth * 0.5 // Within half a screen of start
      const nearEnd = scrollLeft > scrollWidth - clientWidth * 1.5 // Within 1.5 screens of end
      
      if (nearStart || nearEnd) {
        console.log(`🔄 EXPANDING TIMELINE ON SCROLL: nearStart=${nearStart}, nearEnd=${nearEnd}`)
        
        const currentBounds = timelineBounds
        let needsUpdate = false
        let newStartDate = currentBounds.startDate
        let newEndDate = currentBounds.endDate
        
        if (nearStart) {
          // Expand backwards by 2 months
          newStartDate = new Date(currentBounds.startDate.getFullYear(), currentBounds.startDate.getMonth() - 2, 1)
          needsUpdate = true
        }
        
        if (nearEnd) {
          // Expand forwards by 2 months
          newEndDate = new Date(currentBounds.endDate.getFullYear(), currentBounds.endDate.getMonth() + 2, 0)
          needsUpdate = true
        }
        
        if (needsUpdate) {
          setTimelineBounds({ startDate: newStartDate, endDate: newEndDate })
        }
      }
    }
  }, [timelineBounds])

  // Custom onNodesChange handler with timeline constraints and dynamic bounds
  const onNodesChange = useCallback((changes) => {
    // Track drag state for visual feedback
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        if (change.dragging) {
          // Update drag feedback using grid system
          const lanes = grid.getLanes()
          const nearest = getNearestSwimlane(change.position.y, lanes.map(l => ({ id: l.id, name: l.name, y: l.y, nodes: l.nodes })), timelineConfig)
          setDragInfo({
            isDragging: true,
            nodeId: change.id,
            currentY: change.position.y,
            targetSwimlane: nearest?.swimlane || null
          })

          // No bounds checking needed - endless canvas allows dragging anywhere
        } else {
          // Drag ended
          setDragInfo({
            isDragging: false,
            nodeId: null,
            currentY: 0,
            targetSwimlane: null
          })
        }
      }
    })

    // Apply timeline constraints to the changes using unified grid
    const constrainedChanges = applyTimelineConstraints(
      changes,
      nodes,
      grid,
      constraintConfig
    )

    // Update task dates and swimlane assignments when positions change
    constrainedChanges.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        // Position change is complete, update task data and swimlane assignment
        const node = nodes.find(n => n.id === change.id)
        if (node && node.type === 'task') {
          const updatedData = updateTaskDatesFromPosition(
            node as Node<any>,
            change.position.x,
            grid
          )
          
          // Update the node data with new dates
          setNodes(nds => 
            nds.map(n => 
              n.id === change.id 
                ? { ...n, data: { ...n.data, ...updatedData } }
                : n
            )
          )
          
          // Update the actual task in the database
          import('@/domain/task-service').then(({ updateTaskUI }) => {
            updateTaskUI(change.id, {
              startDate: updatedData.startDate,
              dueDate: updatedData.endDate
            })
          })
          
          // Note: No swimlane reassignment needed since each task has its own dedicated lane
        }
      }
    })

    // Apply the constrained changes to node positions
    setNodes(nds => applyNodeChanges(constrainedChanges, nds))
  }, [nodes, swimlanes, timelineConfig, constraintConfig, setNodes, grid])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  // Handle delete key for selected nodes/edges
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Delete selected nodes
      setNodes(nds => nds.filter(node => !node.selected))
      // Delete selected edges
      setEdges(eds => eds.filter(edge => !edge.selected))
    }
  }, [setNodes, setEdges])

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])



  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  return (
    <div className="w-full h-[800px] border rounded-lg bg-background overflow-hidden">
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Project Timeline</h2>
            <p className="text-sm text-muted-foreground">
              {tasks.length > 0 
                ? `Showing first ${tasks.length} tasks with start and due dates (sorted by start date)`
                : 'No tasks with both start and due dates found'
              }
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span>Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
              <span>Milestones</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 border-t-2 border-dashed border-orange-500"></div>
              <span>Dependencies</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Timeline Layout using CSS Grid */}
      <div className="flex h-[calc(800px-80px)] relative">
        {/* Swimlane Labels Column - Fixed position */}
        <div className="w-80 border-r relative flex-shrink-0 z-20 bg-background">
          {/* Header spacer */}
          <div className="h-12 border-b bg-background/50 flex items-center px-4">
            <span className="text-xs font-medium text-muted-foreground">Lanes</span>
          </div>
          
          {/* Lane background stripes for sidebar */}
          {grid.getLanes().map((lane, index) => {
            const position = grid.getLaneLabelPosition(lane)
            return (
            <div
              key={`sidebar-bg-${lane.id}`}
              className={`absolute left-0 right-0 border-b border-border/30 ${
                index % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'
              }`}
              style={{
                top: position.top,
                height: position.height,
              }}
            />
            )
          })}
          
          {/* Swimlane labels positioned using unified grid system */}
          {grid.getLanes().map((lane) => {
            const position = grid.getLaneLabelPosition(lane)
            return (
            <div 
              key={lane.id}
              className="absolute left-0 right-0 px-4 z-10"
              style={{ 
                top: position.top,
                height: position.height,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <div 
                className="font-medium text-sm truncate" 
                title={lane.name}
                style={{ 
                  margin: 0,
                  padding: 0,
                  lineHeight: 1
                }}
              >
                {lane.name}
              </div>
            </div>
            )
          })}
        </div>
        
        {/* Timeline Content Column - Scrollable */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline Header - Grid-based - Scrolls with content */}
          <div 
            ref={headerRef}
            className="h-12 bg-muted/80 border-b relative overflow-x-hidden"
            style={{ width: '100%' }}
          >
            <div style={{ width: grid.getDimensions().width, height: '100%', position: 'relative' }}>
            {/* Render grid lines using unified system */}
            {grid.generateGridLines()
              .filter(line => line.type === 'vertical')
              .map((line, index) => (
              <div
                key={`grid-line-${index}`}
                className="absolute top-0 h-full"
                style={{ left: line.position }}
              >
                {/* Vertical line */}
                <div className={`w-px h-full ${
                  line.isToday ? 'bg-blue-500' : 
                  line.isHeader ? 'bg-border/60' : 'bg-border/20'
                }`} />
                
                {/* Weekly labels */}
                {line.label && (
                  <div 
                    className={`absolute top-1 px-1.5 py-0.5 text-xs font-medium rounded ${
                      line.isToday ? 'bg-blue-500 text-white' : 'bg-background/80 text-muted-foreground'
                    } border shadow-sm`}
                    style={{ transform: 'translateX(-50%)' }}
                  >
                    {line.label}
                  </div>
                )}
              </div>
            ))}
            
            {/* Timeline scale info */}
            <div className="absolute top-1 left-4 text-xs text-muted-foreground font-medium">
              Unified Grid
            </div>
            </div>
          </div>
          
          {/* Timeline Content Area - With horizontal scroll */}
          <div 
            ref={contentRef}
            className="flex-1 relative overflow-x-auto overflow-y-hidden timeline-scrollable"
            onScroll={handleContentScroll}
            style={{ width: '100%' }}
          >
            {/* Lane Background Areas - Full width */}
            <div className="absolute pointer-events-none" style={{ width: grid.getDimensions().width, height: '100%' }}>
              {grid.getLanes().map((lane, index) => {
                const position = grid.getLaneBackgroundPosition(lane)
                return (
                <div
                  key={`lane-bg-${lane.id}`}
                  className={`absolute left-0 border-b border-border/30 ${
                    index % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                  style={{
                    top: position.top,
                    height: position.height,
                    width: grid.getDimensions().width,
                  }}
                />
                )
              })}
            </div>
            
            {/* Drag Feedback Overlay - Show original lane highlight */}
            {dragInfo.isDragging && dragInfo.nodeId && (
              (() => {
                // Find the original lane for the dragged node
                const originalLane = grid.getLanes().find(lane => 
                  lane.nodes.some(node => node.id === dragInfo.nodeId)
                )
                
                if (!originalLane) return null
                
                return (
                  <div 
                    className="absolute left-0 right-0 bg-blue-500/20 border-2 border-blue-500 border-dashed pointer-events-none z-50 transition-all duration-150"
                    style={{ 
                      top: originalLane.y,
                      height: grid.getLaneHeight(),
                    }}
                  >
                    <div className="absolute left-2 top-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                      {originalLane.name}
                    </div>
                  </div>
                )
              })()
            )}
            
            {/* DELETE OVERLAY FOR SELECTED EDGES */}
            <div className="absolute inset-0 pointer-events-none z-50">
              {edges.filter(edge => edge.selected).map((edge) => {
                // Find source and target nodes to calculate line position
                const sourceNode = nodes.find(n => n.id === edge.source)
                const targetNode = nodes.find(n => n.id === edge.target)
                
                if (!sourceNode || !targetNode) return null
                
                // Calculate actual task widths based on duration
                const sourceData = sourceNode.data as any
                const targetData = targetNode.data as any
                
                const sourceStartDate = new Date(sourceData.startDate)
                const sourceEndDate = new Date(sourceData.endDate)
                const sourceDurationDays = Math.ceil((sourceEndDate.getTime() - sourceStartDate.getTime()) / (1000 * 60 * 60 * 24))
                const sourceWidth = Math.max(120, sourceDurationDays * 25)
                
                // Calculate center point of connection line
                const sourceX = sourceNode.position.x + sourceWidth // Right edge of source
                const sourceY = sourceNode.position.y + 16 // Center height (32px task / 2)
                const targetX = targetNode.position.x // Left edge of target  
                const targetY = targetNode.position.y + 16 // Center height
                
                const centerX = (sourceX + targetX) / 2
                const centerY = (sourceY + targetY) / 2
                
                return (
                  <div
                    key={`delete-${edge.id}`}
                    className="absolute w-5 h-5 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center pointer-events-auto cursor-pointer hover:bg-red-50 hover:border-red-300 transition-all duration-200 border border-gray-300 shadow-sm hover:shadow-md group"
                    style={{
                      left: centerX - 10,
                      top: centerY - 10,
                    }}
                    onClick={() => setEdges(eds => eds.filter(e => e.id !== edge.id))}
                    title="Delete connection"
                  >
                    <svg 
                      width="10" 
                      height="10" 
                      viewBox="0 0 10 10" 
                      className="text-gray-500 group-hover:text-red-500 transition-colors duration-200"
                    >
                      <path 
                        d="M1 1L9 9M9 1L1 9" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )
              })}
            </div>

            {/* RESIZE HANDLES OVERLAY - Outside React Flow */}
            <div className="absolute inset-0 pointer-events-none z-60">
              {nodes.filter(n => n.type === 'task').map((node) => {
                const taskData = node.data as any
                const startDate = new Date(taskData.startDate)
                const endDate = new Date(taskData.endDate)
                const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                const width = Math.max(120, durationDays * 25)
                
                const handleResize = (e: React.MouseEvent, side: 'left' | 'right') => {
                  e.stopPropagation()
                  e.preventDefault()
                  
                  const startX = e.clientX
                  let lastAppliedDelta = 0  // Track last applied delta to prevent duplicates
                  console.log(`Starting ${side} resize for:`, taskData.title)
                  
                  const handleMouseMove = (e: MouseEvent) => {
                    const deltaX = e.clientX - startX
                    
                    // GRID SNAPPING: Only update when we cross a 25px boundary (1 day)
                    const snappedDeltaX = Math.round(deltaX / 25) * 25  // Snap to 25px grid
                    const deltaDays = snappedDeltaX / 25  // Convert to whole days
                    
                    // Only update if we've moved to a NEW grid position (prevent duplicate renders)
                    if (Math.abs(deltaDays) >= 1 && snappedDeltaX !== lastAppliedDelta) {
                      lastAppliedDelta = snappedDeltaX  // Remember this delta
                      console.log(`${side} resize SNAPPED: ${deltaDays} days (${snappedDeltaX}px from ${deltaX}px)`)
                      
                      // REAL-TIME VISUAL UPDATE: Update position AND dates for immediate feedback
                      const currentStart = new Date(taskData.startDate)
                      const currentEnd = new Date(taskData.endDate)
                      
                      let newStartDate = currentStart
                      let newEndDate = currentEnd
                      let newPosition = node.position
                      
                      if (side === 'left') {
                        // LEFT RESIZE: Update start date and position
                        newStartDate = new Date(currentStart.getTime() + deltaDays * 24 * 60 * 60 * 1000)
                        if (newStartDate >= currentEnd) {
                          newStartDate = new Date(currentEnd.getTime() - 24 * 60 * 60 * 1000)
                        }
                        // Keep left edge where user is dragging
                        const originalX = grid.dateToX(new Date(taskData.startDate))
                        newPosition = { ...node.position, x: originalX + snappedDeltaX }
                      } else {
                        // RIGHT RESIZE: Update end date only
                        newEndDate = new Date(currentEnd.getTime() + deltaDays * 24 * 60 * 60 * 1000)
                        if (newEndDate <= currentStart) {
                          newEndDate = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000)
                        }
                        // Position stays the same for right resize
                      }
                      
                      // Update both position AND dates for real-time feedback
                      setNodes(nodes => nodes.map(n => 
                        n.id === node.id 
                          ? { 
                              ...n,
                              position: newPosition,
                              data: { 
                                ...n.data, 
                                startDate: newStartDate.toISOString().split('T')[0],
                                endDate: newEndDate.toISOString().split('T')[0]
                              } 
                            }
                          : n
                      ))
                    }
                  }
                  
                  const handleMouseUp = () => {
                    console.log(`Ended ${side} resize for:`, taskData.title)
                    
                    // Get the final dates from the current node state
                    const finalNode = nodes.find(n => n.id === node.id)
                    if (finalNode) {
                      const finalData = finalNode.data as any
                      
                      // Update the actual task in the database with final dates
                      import('@/domain/task-service').then(({ updateTaskUI }) => {
                        updateTaskUI(node.id, {
                          startDate: finalData.startDate,
                          dueDate: finalData.endDate
                        })
                      })
                    }
                    
                    // Clean up event listeners
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }
                
                return (
                  <div
                    key={`resize-${node.id}`}
                    className="absolute"
                    style={{
                      left: node.position.x,
                      top: node.position.y,
                      width: width,
                      height: 32,
                    }}
                  >
                    {/* Left Resize Handle */}
                    <div 
                      className="absolute left-0 top-0 w-2 h-full bg-blue-500 cursor-ew-resize opacity-70 hover:opacity-100 pointer-events-auto"
                      onMouseDown={(e) => handleResize(e, 'left')}
                      title="Resize start date"
                    />
                    
                    {/* Right Resize Handle */}
                    <div 
                      className="absolute right-0 top-0 w-2 h-full bg-blue-500 cursor-ew-resize opacity-70 hover:opacity-100 pointer-events-auto"
                      onMouseDown={(e) => handleResize(e, 'right')}
                      title="Resize end date"
                    />
                  </div>
                )
              })}
            </div>
            
            
            {/* Vertical Grid Lines - Days */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {grid.generateGridLines()
                .filter(line => line.type === 'vertical')
                .map((line, index) => (
                <div 
                  key={`v-grid-${index}`}
                  className={`absolute h-full w-px ${
                    line.isToday ? 'bg-blue-500/40 z-20' : 
                    line.isHeader ? 'bg-border/30' : 'bg-border/10'
                  }`}
                  style={{ 
                    left: line.position,
                    top: grid.getConfig().timelineHeaderOffset
                  }}
                />
              ))}
            </div>

            

            {/* Container with full timeline width */}
            <div style={{ width: grid.getDimensions().width, height: '100%', position: 'relative' }}>
            
            {/* React Flow Timeline - WITH PROPER DRAG CONSTRAINTS */}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              proOptions={proOptions}
              viewport={{ x: 0, y: 0, zoom: 1 }}
              onViewportChange={() => {}} // Prevent any viewport changes
              // Remove all extent restrictions - let our constraint system handle everything
              minZoom={1}
              maxZoom={1}
              panOnDrag={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              preventScrolling={false}
              attributionPosition="bottom-right"
              selectionOnDrag
              multiSelectionKeyCode="Shift"
              fitView={false}
              // Connection settings - Simple and direct
              connectionLineType="straight"
              connectionLineStyle={{ 
                stroke: '#3b82f6', 
                strokeWidth: 3,
                strokeDasharray: '5,5'
              }}
              connectionMode="strict" // Only connect to exact handles
              // Connection validation - strict handle matching
              isValidConnection={(connection) => {
                // Only allow right-to-left connections (output to input)
                return connection.source !== connection.target && 
                       connection.sourceHandle?.endsWith('-output') && 
                       connection.targetHandle?.endsWith('-input')
              }}
            >
              <Controls showInteractive={false} showZoom={false} showFitView={false} />
            </ReactFlow>
            
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TasksTimeline() {
  return (
    <ReactFlowProvider>
      <TasksTimelineInner />
    </ReactFlowProvider>
  )
}