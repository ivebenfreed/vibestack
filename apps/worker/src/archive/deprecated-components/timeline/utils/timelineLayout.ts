import { Node } from '@xyflow/react'
import { TimelineGrid, createTimelineGrid, GridLane } from './timelineGrid'

export interface TimelineLayoutConfig {
  startDate: Date
  endDate: Date
  pixelsPerDay: number
  rowHeight: number
  headerHeight: number
  leftMargin: number
  swimlaneGap: number
}

// Legacy interface - now maps to GridLane
export interface TimelineSwimlane {
  id: string
  name: string
  y: number
  nodes: Node[]
}

const DEFAULT_CONFIG: TimelineLayoutConfig = {
  startDate: new Date(),
  endDate: new Date(),
  pixelsPerDay: 20,
  rowHeight: 120,
  headerHeight: 100,
  leftMargin: 200,
  swimlaneGap: 40,
}

/**
 * Calculate X position based on date (relative to timeline grid, not left margin)
 */
function getXPositionFromDate(date: Date, config: TimelineLayoutConfig): number {
  const daysDiff = Math.floor((date.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24))
  return daysDiff * config.pixelsPerDay // Remove leftMargin since swimlane labels are now separate
}

/**
 * Calculate timeline bounds from all nodes
 */
function calculateTimelineBounds(nodes: Node[]): { startDate: Date; endDate: Date } {
  let earliestDate = new Date()
  let latestDate = new Date()

  nodes.forEach(node => {
    if (node.type === 'task') {
      const taskData = node.data as TaskNodeData
      const startDate = new Date(taskData.startDate)
      const endDate = new Date(taskData.endDate)
      
      if (startDate < earliestDate) earliestDate = startDate
      if (endDate > latestDate) latestDate = endDate
    } else if (node.type === 'milestone') {
      const milestoneData = node.data as MilestoneNodeData
      const dueDate = new Date(milestoneData.dueDate)
      
      if (dueDate < earliestDate) earliestDate = dueDate
      if (dueDate > latestDate) latestDate = dueDate
    }
  })

  // Add padding
  earliestDate.setDate(earliestDate.getDate() - 7)
  latestDate.setDate(latestDate.getDate() + 7)

  return { startDate: earliestDate, endDate: latestDate }
}

/**
 * Create swimlanes - one for milestones, one lane per task
 */
function createSwimlanes(nodes: Node[], config: TimelineLayoutConfig): TimelineSwimlane[] {
  const swimlanes: TimelineSwimlane[] = []
  const taskNodes = nodes.filter(n => n.type === 'task')
  const milestoneNodes = nodes.filter(n => n.type === 'milestone')

  // Add milestones to dedicated lane first (if any)
  if (milestoneNodes.length > 0) {
    const milestoneSwimlane: TimelineSwimlane = {
      id: 'milestones',
      name: 'Milestones',
      y: 20, // Place at top of grid area
      nodes: milestoneNodes
    }
    swimlanes.push(milestoneSwimlane)
  }

  // Sort tasks by start date for logical ordering
  const sortedTasks = taskNodes.sort((a, b) => {
    const aStart = new Date((a.data as TaskNodeData).startDate)
    const bStart = new Date((b.data as TaskNodeData).startDate)
    return aStart.getTime() - bStart.getTime()
  })

  // Create one swimlane per task - no overlap logic needed
  sortedTasks.forEach((node, index) => {
    const taskData = node.data as TaskNodeData
    const baseY = milestoneNodes.length > 0 ? (config.rowHeight + config.swimlaneGap) : 20
    
    const taskSwimlane: TimelineSwimlane = {
      id: `task-${node.id}`,
      name: taskData.title, // Use actual task name
      y: baseY + (index * (config.rowHeight + config.swimlaneGap)),
      nodes: [node] // Each lane has exactly one task
    }
    
    swimlanes.push(taskSwimlane)
  })

  return swimlanes
}

/**
 * Apply timeline layout using unified grid system
 */
export function applyTimelineLayout(
  nodes: Node[], 
  customConfig?: Partial<TimelineLayoutConfig>
): { positionedNodes: Node[]; swimlanes: TimelineSwimlane[]; grid: TimelineGrid } {
  if (nodes.length === 0) return { positionedNodes: [], swimlanes: [], grid: createTimelineGrid() }

  const bounds = calculateTimelineBounds(nodes)
  
  // Create unified grid with proper configuration
  const grid = createTimelineGrid({
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    pixelsPerDay: customConfig?.pixelsPerDay || 25,
    laneHeight: customConfig?.rowHeight || 28,
    laneGap: customConfig?.swimlaneGap || 2,
    headerHeight: customConfig?.headerHeight || 48,
    topPadding: 20
  })

  // Configure lanes using the grid system
  const gridLanes = grid.configureLanes(nodes)

  // Position all nodes using grid coordinates
  const positionedNodes: Node[] = []
  const nodeIdToPositionedNode = new Map<string, Node>()

  gridLanes.forEach(lane => {
    lane.nodes.forEach(node => {
      const position = grid.positionNode(node, lane)
      const positionedNode = {
        ...node,
        position
      }
      positionedNodes.push(positionedNode)
      nodeIdToPositionedNode.set(node.id, positionedNode)
    })
  })

  // Update grid lanes to reference the positioned nodes (critical for constraint system)
  gridLanes.forEach(lane => {
    lane.nodes = lane.nodes.map(node => nodeIdToPositionedNode.get(node.id) || node)
  })

  // Convert GridLanes to legacy TimelineSwimlane format for compatibility
  const swimlanes: TimelineSwimlane[] = gridLanes.map(lane => ({
    id: lane.id,
    name: lane.name,
    y: lane.y,
    nodes: lane.nodes // Now references positioned nodes
  }))

  return { positionedNodes, swimlanes, grid }
}

/**
 * Generate time grid markers
 */
export function generateTimeGrid(config: TimelineLayoutConfig): Node[] {
  const gridNodes: Node[] = []
  const currentDate = new Date(config.startDate)
  
  while (currentDate <= config.endDate) {
    const x = getXPositionFromDate(currentDate, config)
    
    // Create time marker every week
    if (currentDate.getDay() === 1) { // Monday
      gridNodes.push({
        id: `time-marker-${currentDate.toISOString()}`,
        type: 'timeMarker',
        position: { x: x - 40, y: 20 },
        data: {
          date: new Date(currentDate),
          label: currentDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
        },
        draggable: false,
        selectable: false,
      })
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return gridNodes
}

/**
 * Calculate optimal zoom to fit timeline
 */
export function calculateOptimalViewport(config: TimelineLayoutConfig, containerWidth: number) {
  const totalWidth = config.leftMargin + 
    ((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24)) * config.pixelsPerDay + 200
  
  const optimalZoom = Math.min(1, containerWidth / totalWidth)
  
  return {
    x: 0,
    y: 0,
    zoom: optimalZoom
  }
}