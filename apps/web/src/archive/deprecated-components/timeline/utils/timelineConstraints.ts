import { Node, NodeChange } from '@xyflow/react'
import { TaskNodeData } from '../nodes/TaskNode'
import { MilestoneNodeData } from '../nodes/MilestoneNode'
import { TimelineLayoutConfig, TimelineSwimlane } from './timelineLayout'
import { TimelineGrid } from './timelineGrid'

export interface ConstrainedPosition {
  x: number
  y: number
  snapped: boolean
  constraintApplied: 'swimlane' | 'timeGrid' | 'both' | 'none'
}

export interface TimelineConstraintConfig {
  enableSnapping: boolean
  snapToGrid: boolean
  lockToSwimlanes: boolean
  minTimeUnit: 'hour' | 'day' | 'week'
  snapTolerance: number // pixels
}

const DEFAULT_CONSTRAINT_CONFIG: TimelineConstraintConfig = {
  enableSnapping: true,
  snapToGrid: true,
  lockToSwimlanes: true,
  minTimeUnit: 'day',
  snapTolerance: 10,
}

/**
 * Convert date to X position on timeline using grid system
 */
export function dateToX(date: Date, grid: TimelineGrid): number {
  return grid.dateToX(date)
}

/**
 * Convert X position to date on timeline using grid system
 */
export function xToDate(x: number, grid: TimelineGrid): Date {
  const config = grid.getConfig()
  const daysDiff = Math.floor(x / config.pixelsPerDay)
  return new Date(config.startDate.getTime() + daysDiff * 24 * 60 * 60 * 1000)
}

/**
 * Snap X position to time grid using unified grid system
 */
export function snapToTimeGrid(
  x: number, 
  grid: TimelineGrid,
  constraintConfig: TimelineConstraintConfig = DEFAULT_CONSTRAINT_CONFIG
): { x: number; snapped: boolean } {
  if (!constraintConfig.snapToGrid) {
    return { x, snapped: false }
  }

  const config = grid.getConfig()
  const { pixelsPerDay } = config
  let snapWidth = pixelsPerDay // Default to daily snap

  // Adjust snap width based on minimum time unit
  switch (constraintConfig.minTimeUnit) {
    case 'hour':
      snapWidth = pixelsPerDay / 24
      break
    case 'week':
      snapWidth = pixelsPerDay * 7
      break
    default:
      snapWidth = pixelsPerDay // day
  }

  const snappedX = Math.round(x / snapWidth) * snapWidth

  const snapDistance = Math.abs(x - snappedX)
  const shouldSnap = snapDistance <= constraintConfig.snapTolerance

  return {
    x: shouldSnap ? snappedX : x,
    snapped: shouldSnap
  }
}

/**
 * Get the fixed Y position for a node based on its lane assignment using grid system
 */
export function getSwimlaneForNode(
  nodeId: string, 
  grid: TimelineGrid
): any | null {
  const lane = grid.getLaneForNode(nodeId)
  if (!lane) return null
  
  // Convert GridLane to legacy format for compatibility
  return {
    id: lane.id,
    name: lane.name,
    y: lane.y,
    nodes: lane.nodes
  }
}

/**
 * Find the nearest swimlane based on Y position for drag feedback
 */
export function getNearestSwimlane(
  y: number,
  swimlanes: TimelineSwimlane[],
  timelineConfig: TimelineLayoutConfig
): { swimlane: TimelineSwimlane; distance: number } | null {
  if (swimlanes.length === 0) return null
  
  let nearestSwimlane = swimlanes[0]
  let minDistance = Math.abs(y - swimlanes[0].y)
  
  for (const swimlane of swimlanes) {
    const distance = Math.abs(y - swimlane.y)
    if (distance < minDistance) {
      minDistance = distance
      nearestSwimlane = swimlane
    }
  }
  
  return { swimlane: nearestSwimlane, distance: minDistance }
}

/**
 * Apply timeline constraints to a position change using unified grid system
 */
export function constrainTimelinePosition(
  nodeId: string,
  proposedPosition: { x: number; y: number },
  grid: TimelineGrid,
  constraintConfig: TimelineConstraintConfig = DEFAULT_CONSTRAINT_CONFIG,
  targetSwimlane?: TimelineSwimlane | null
): ConstrainedPosition {
  let constraintApplied: ConstrainedPosition['constraintApplied'] = 'none'
  let finalX = proposedPosition.x
  let finalY = proposedPosition.y
  let snapped = false

  // Apply time grid snapping
  if (constraintConfig.snapToGrid) {
    const snapResult = snapToTimeGrid(proposedPosition.x, grid, constraintConfig)
    finalX = snapResult.x
    snapped = snapResult.snapped
    if (snapped) {
      constraintApplied = 'timeGrid'
    }
  }

  // Apply swimlane constraint - always keep in original lane (no lane switching)
  if (constraintConfig.lockToSwimlanes) {
    const originalLane = grid.getLaneForNode(nodeId)
    if (originalLane) {
      // Use the same coordinate calculation as getTaskPosition (React Flow coordinates)
      const correctY = originalLane.y + grid.getConfig().taskVerticalCentering
      finalY = correctY // Always snap back to original lane with proper centering
      constraintApplied = constraintApplied === 'timeGrid' ? 'both' : 'swimlane'
      console.log(`✅ LANE CONSTRAINT: Node "${nodeId}" locked to lane "${originalLane.name}" at Y=${correctY}`)
    } else {
      console.log(`⚠️ LANE CONSTRAINT: No original lane found for node "${nodeId}"`)
      console.log(`Available lanes:`, grid.getLanes().map(l => ({ id: l.id, name: l.name, nodeIds: l.nodes.map(n => n.id) })))
    }
  }

  return {
    x: finalX,
    y: finalY,
    snapped,
    constraintApplied
  }
}

/**
 * Get valid Y bounds for dragging within swimlanes using grid system
 */
function getValidYBounds(grid: TimelineGrid): { minY: number; maxY: number } {
  const lanes = grid.getLanes()
  if (lanes.length === 0) {
    return { minY: 0, maxY: 100 }
  }
  
  const minY = Math.min(...lanes.map(l => l.y)) - 20 // Allow some buffer above first lane
  const maxY = Math.max(...lanes.map(l => l.y + grid.getLaneHeight())) + 20 // Allow some buffer below last lane
  
  return { minY, maxY }
}

/**
 * Apply constraints to React Flow node changes with visual feedback using unified grid
 */
export function applyTimelineConstraints(
  changes: NodeChange[],
  nodes: Node[],
  grid: TimelineGrid,
  constraintConfig: TimelineConstraintConfig = DEFAULT_CONSTRAINT_CONFIG
): NodeChange[] {
  const yBounds = getValidYBounds(grid)
  
  return changes.map(change => {
    // Handle position changes during dragging
    if (change.type === 'position' && change.position) {
      if (change.dragging) {
        // During dragging: keep task locked to its original lane Y position
        const originalLane = grid.getLaneForNode(change.id)
        if (originalLane && constraintConfig.lockToSwimlanes) {
          const snapResult = snapToTimeGrid(change.position.x, grid, constraintConfig)
          // Use the same coordinate calculation as getTaskPosition (React Flow coordinates)
          const lockedY = originalLane.y + grid.getConfig().taskVerticalCentering
          console.log(`🔒 DRAG CONSTRAINT: Node "${change.id}" locked to lane "${originalLane.name}" Y=${lockedY} (from proposed Y=${change.position.y})`)
          
          return {
            ...change,
            position: {
              x: snapResult.x,
              y: lockedY // Always lock to original lane during drag
            }
          }
        } else {
          // Fallback: constrain within bounds if no lane found
          console.log(`❌ DRAG CONSTRAINT: No lane found for node "${change.id}", using bounds constraint`)
          console.log(`Available lanes:`, grid.getLanes().map(l => ({ id: l.id, name: l.name, nodeIds: l.nodes.map(n => n.id) })))
          const snapResult = snapToTimeGrid(change.position.x, grid, constraintConfig)
          const constrainedY = Math.max(yBounds.minY, Math.min(yBounds.maxY, change.position.y))
          
          return {
            ...change,
            position: {
              x: snapResult.x,
              y: constrainedY
            }
          }
        }
      } else {
        // On drag end: snap back to original lane (no lane switching allowed)
        const constrainedPos = constrainTimelinePosition(
          change.id,
          change.position,
          grid,
          constraintConfig
        )

        return {
          ...change,
          position: {
            x: constrainedPos.x,
            y: constrainedPos.y
          }
        }
      }
    }

    return change
  })
}

/**
 * Update task dates based on position change using grid system
 */
export function updateTaskDatesFromPosition(
  node: Node<TaskNodeData>,
  newX: number,
  grid: TimelineGrid
): Partial<TaskNodeData> {
  const currentStartDate = new Date(node.data.startDate)
  const currentEndDate = new Date(node.data.endDate)
  const currentDuration = currentEndDate.getTime() - currentStartDate.getTime()

  // Calculate new start date from X position using grid
  const newStartDate = xToDate(newX, grid)
  
  // Maintain duration by calculating new end date
  const newEndDate = new Date(newStartDate.getTime() + currentDuration)

  return {
    startDate: newStartDate.toISOString().split('T')[0],
    endDate: newEndDate.toISOString().split('T')[0]
  }
}

/**
 * Validate that a position change doesn't violate timeline rules
 */
export function validateTimelineMove(
  nodeId: string,
  newPosition: { x: number; y: number },
  nodes: Node[],
  timelineConfig: TimelineLayoutConfig
): { valid: boolean; reason?: string } {
  const node = nodes.find(n => n.id === nodeId)
  if (!node) {
    return { valid: false, reason: 'Node not found' }
  }

  // Check if position is within timeline bounds  
  const grid = timelineConfig as any // Legacy compatibility
  const config = grid.getConfig ? grid.getConfig() : timelineConfig
  const minX = 0 // No left margin in new grid system
  const maxDate = config.endDate
  const maxX = grid.dateToX ? grid.dateToX(maxDate) : ((maxDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24)) * config.pixelsPerDay

  if (newPosition.x < minX) {
    return { valid: false, reason: 'Position before timeline start' }
  }

  if (newPosition.x > maxX) {
    return { valid: false, reason: 'Position after timeline end' }
  }

  return { valid: true }
}

/**
 * Get visual feedback for constraint application
 */
export function getConstraintFeedback(
  constraintResult: ConstrainedPosition
): { 
  showSnapIndicator: boolean
  snapIndicatorType: 'time' | 'swimlane' | 'both'
  feedbackMessage?: string 
} {
  if (constraintResult.constraintApplied === 'none') {
    return { showSnapIndicator: false, snapIndicatorType: 'time' }
  }

  const showSnapIndicator = constraintResult.snapped || constraintResult.constraintApplied !== 'none'
  
  let snapIndicatorType: 'time' | 'swimlane' | 'both' = 'time'
  let feedbackMessage: string | undefined

  switch (constraintResult.constraintApplied) {
    case 'timeGrid':
      snapIndicatorType = 'time'
      feedbackMessage = 'Snapped to time grid'
      break
    case 'swimlane':
      snapIndicatorType = 'swimlane'
      feedbackMessage = 'Locked to swimlane'
      break
    case 'both':
      snapIndicatorType = 'both'
      feedbackMessage = 'Snapped to grid and locked to swimlane'
      break
  }

  return {
    showSnapIndicator,
    snapIndicatorType,
    feedbackMessage
  }
}