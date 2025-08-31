import { Node } from '@xyflow/react'
import { TaskNodeData } from '../nodes/TaskNode'
import { MilestoneNodeData } from '../nodes/MilestoneNode'
import { debugLog } from '@/logger';
const log = debugLog('archive/deprecated-components/timeline/utils/timelineGrid.ts');

export interface TimelineGridConfig {
  startDate: Date
  endDate: Date
  pixelsPerDay: number
  laneHeight: number
  laneGap: number
  headerHeight: number
  topPadding: number
  // Centralized offsets - no more magic numbers!
  timelineHeaderOffset: number  // The header space above timeline content
  taskVerticalCentering: number // Offset to center tasks in lanes
}

export interface GridLane {
  id: string
  name: string
  type: 'milestone' | 'task'
  index: number
  y: number
  nodes: Node[]
}

export interface GridPosition {
  x: number
  y: number
}

export interface GridLine {
  type: 'vertical' | 'horizontal'
  position: number
  isHeader?: boolean
  isToday?: boolean
  label?: string
}

/**
 * Central Timeline Grid Manager - Single Source of Truth for all coordinates
 */
export class TimelineGrid {
  private config: TimelineGridConfig
  private lanes: GridLane[] = []
  private nodeToLaneMap: Map<string, string> = new Map() // Track node->lane assignments

  constructor(config: TimelineGridConfig) {
    this.config = config
  }

  /**
   * Calculate exact X position for a given date
   */
  dateToX(date: Date): number {
    const daysDiff = Math.floor((date.getTime() - this.config.startDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff * this.config.pixelsPerDay
  }

  /**
   * Convert X position back to date
   */
  xToDate(x: number): Date {
    const daysDiff = Math.floor(x / this.config.pixelsPerDay)
    return new Date(this.config.startDate.getTime() + daysDiff * 24 * 60 * 60 * 1000)
  }

  /**
   * Calculate exact Y position for a given lane index
   */
  laneToY(laneIndex: number): number {
    return this.config.topPadding + (laneIndex * (this.config.laneHeight + this.config.laneGap))
  }

  /**
   * Get the exact height of each lane
   */
  getLaneHeight(): number {
    return this.config.laneHeight
  }

  /**
   * Auto-configure lanes from nodes with proper reordering
   */
  configureLanes(nodes: Node[]): GridLane[] {
    const taskNodes = nodes.filter(n => n.type === 'task')
    const milestoneNodes = nodes.filter(n => n.type === 'milestone')

    log.info(`🔄 CONFIGURING LANES for ${taskNodes.length} tasks (reorder by start date)`)

    // Always sort tasks by start date for logical ordering
    const sortedTasks = taskNodes.sort((a, b) => {
      const aStart = new Date((a.data as TaskNodeData).startDate)
      const bStart = new Date((b.data as TaskNodeData).startDate)
      const timeDiff = aStart.getTime() - bStart.getTime()
      
      // Use node ID as tiebreaker to ensure stable sorting
      if (timeDiff === 0) {
        return a.id.localeCompare(b.id)
      }
      return timeDiff
    })

    // Clear existing lanes and rebuild in correct order
    this.lanes = []
    this.nodeToLaneMap.clear()

    // Add milestone lane first (if any milestones exist)
    if (milestoneNodes.length > 0) {
      const milestoneLane: GridLane = {
        id: 'milestones',
        name: 'Milestones',
        type: 'milestone',
        index: 0,
        y: this.laneToY(0),
        nodes: milestoneNodes
      }
      this.lanes.push(milestoneLane)
    }

    // Create lanes in sorted order
    sortedTasks.forEach((node, taskIndex) => {
      const taskData = node.data as TaskNodeData
      const laneIndex = this.lanes.length // Current lane count
      const laneId = `task-${node.id}`
      
      const taskLane: GridLane = {
        id: laneId,
        name: taskData.title,
        type: 'task',
        index: laneIndex,
        y: this.laneToY(laneIndex),
        nodes: [node]
      }
      
      this.lanes.push(taskLane)
      this.nodeToLaneMap.set(node.id, laneId)
      log.info(`🏁 LANE ORDERED: "${taskLane.name}" at position ${taskIndex + 1} Y=${taskLane.y} (start: ${taskData.startDate})`)
    })

    return this.lanes
  }

  /**
   * Get all configured lanes
   */
  getLanes(): GridLane[] {
    return this.lanes
  }

  /**
   * Get final position for lane labels in sidebar
   */
  getLaneLabelPosition(lane: GridLane): { top: number; height: number } {
    return {
      top: 48 + lane.y, // 48px for the sidebar header (h-12)
      height: this.config.laneHeight
    }
  }

  /**
   * Get final position for lane backgrounds in timeline content
   * NOTE: Timeline backgrounds are positioned RELATIVE to React Flow content area (no header offset)
   */
  getLaneBackgroundPosition(lane: GridLane): { top: number; height: number } {
    return {
      top: lane.y, // No header offset - positioned relative to React Flow content
      height: this.config.laneHeight
    }
  }

  /**
   * Get final React Flow position for tasks
   * NOTE: React Flow uses its own coordinate system (starts at 0, relative to content area)
   */
  getTaskPosition(node: Node, lane: GridLane): GridPosition {
    const taskData = node.data as TaskNodeData
    const x = this.dateToX(new Date(taskData.startDate))
    // React Flow positioning: relative to content area, no header offset needed
    const y = lane.y + this.config.taskVerticalCentering
    return { x, y }
  }

  /**
   * Get final React Flow position for milestones
   */
  getMilestonePosition(node: Node, lane: GridLane): GridPosition {
    const milestoneData = node.data as MilestoneNodeData
    const x = this.dateToX(new Date(milestoneData.dueDate)) - 20 // Center 40px milestone
    const y = lane.y + this.config.taskVerticalCentering // React Flow uses relative coordinates
    return { x, y }
  }

  /**
   * Position a node based on grid coordinates (legacy method - use specific methods above)
   */
  positionNode(node: Node, lane: GridLane): GridPosition {
    if (node.type === 'task') {
      return this.getTaskPosition(node, lane)
    } else if (node.type === 'milestone') {
      return this.getMilestonePosition(node, lane)
    }
    
    // Default position
    return { 
      x: 0, 
      y: lane.y + this.config.taskVerticalCentering 
    }
  }

  /**
   * Generate all grid lines for visual display
   */
  generateGridLines(): GridLine[] {
    const lines: GridLine[] = []
    
    // Generate daily vertical lines
    const totalDays = Math.ceil((this.config.endDate.getTime() - this.config.startDate.getTime()) / (1000 * 60 * 60 * 24))
    for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
      const dayDate = new Date(this.config.startDate)
      dayDate.setDate(dayDate.getDate() + dayIndex)
      const x = this.dateToX(dayDate)
      const isToday = dayDate.toDateString() === new Date().toDateString()
      const isWeekStart = dayDate.getDay() === 1

      lines.push({
        type: 'vertical',
        position: x,
        isToday,
        isHeader: isWeekStart,
        label: isWeekStart ? dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined
      })
    }

    // Generate horizontal lane separators
    this.lanes.forEach((_, index) => {
      const y = this.laneToY(index) + this.config.laneHeight
      lines.push({
        type: 'horizontal',
        position: y
      })
    })

    return lines
  }

  /**
   * Get lane by node ID for constraint system
   */
  getLaneForNode(nodeId: string): GridLane | null {
    const foundLane = this.lanes.find(lane => lane.nodes.some(node => node.id === nodeId))
    if (foundLane) {
      log.info(`🔍 LANE LOOKUP SUCCESS: Found lane "${foundLane.name}" for node ${nodeId}`)
    } else {
      log.info(`🚫 LANE LOOKUP FAILED: No lane found for node ${nodeId}`)
      log.info(`Available lanes:`, this.lanes.map(l => ({ id: l.id, name: l.name, nodeIds: l.nodes.map(n => n.id) })))
    }
    return foundLane || null
  }

  /**
   * Get total grid dimensions
   */
  getDimensions(): { width: number; height: number } {
    const totalDays = Math.ceil((this.config.endDate.getTime() - this.config.startDate.getTime()) / (1000 * 60 * 60 * 24))
    const width = totalDays * this.config.pixelsPerDay + 100 // Extra padding
    const height = this.config.topPadding + (this.lanes.length * (this.config.laneHeight + this.config.laneGap)) + 50
    
    return { width, height }
  }

  /**
   * Get configuration
   */
  getConfig(): TimelineGridConfig {
    return { ...this.config }
  }

  /**
   * Update timeline bounds without recreating lanes
   */
  updateBounds(startDate: Date, endDate: Date): void {
    log.info(`📐 GRID: Updating bounds from ${this.config.startDate.toISOString().split('T')[0]} to ${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`)
    this.config.startDate = startDate
    this.config.endDate = endDate
    // Note: Lane positions remain unchanged, only the date-to-X calculations are affected
  }
}

/**
 * Factory function to create a timeline grid with default configuration
 */
export function createTimelineGrid(customConfig?: Partial<TimelineGridConfig>): TimelineGrid {
  const defaultConfig: TimelineGridConfig = {
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(new Date().setDate(new Date().getDate() + 40)),
    pixelsPerDay: 25,
    laneHeight: 60, // Much taller lanes for proper breathing room
    laneGap: 0, // No gap between lanes for clean look
    headerHeight: 48,
    topPadding: 20,
    // Centralized offsets - replaces all magic numbers
    timelineHeaderOffset: 12, // The 12px header space we kept adding everywhere
    taskVerticalCentering: 14   // Center tasks in 60px lanes (60-32)/2 = 14px from top
  }

  const config = { ...defaultConfig, ...customConfig }
  return new TimelineGrid(config)
}