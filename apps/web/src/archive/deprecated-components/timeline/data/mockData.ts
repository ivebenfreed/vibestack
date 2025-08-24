import { Node, Edge } from '@xyflow/react'
import { TaskNodeData } from '../nodes/TaskNode'
import { MilestoneNodeData } from '../nodes/MilestoneNode'

// Helper function to get date strings
const getDateString = (daysFromNow: number) => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().split('T')[0]
}

// Mock task nodes with timeline positioning
const taskNodes: Node<TaskNodeData>[] = [
  {
    id: 'task-1',
    type: 'task',
    position: { x: 100, y: 100 },
    dragHandle: '.timeline-drag-handle',
    data: {
      id: 'task-1',
      title: 'Project Planning & Requirements',
      status: 'completed',
      priority: 'high',
      assignee: 'John Doe',
      startDate: getDateString(-30),
      endDate: getDateString(-20),
      progress: 100,
      description: 'Define project scope and gather requirements from stakeholders',
    },
  },
  {
    id: 'task-2',
    type: 'task',
    position: { x: 400, y: 100 },
    dragHandle: '.timeline-drag-handle',
    data: {
      id: 'task-2',
      title: 'UI/UX Design Phase',
      status: 'completed',
      priority: 'medium',
      assignee: 'Jane Smith',
      startDate: getDateString(-18),
      endDate: getDateString(-5),
      progress: 100,
      description: 'Create wireframes, mockups, and design system',
    },
  },
  {
    id: 'task-3',
    type: 'task',
    position: { x: 100, y: 250 },
    dragHandle: '.timeline-drag-handle',
    data: {
      id: 'task-3',
      title: 'Backend API Development',
      status: 'in_progress',
      priority: 'urgent',
      assignee: 'Mike Johnson',
      startDate: getDateString(-10),
      endDate: getDateString(15),
      progress: 65,
      description: 'Develop REST APIs and database schema',
    },
  },
  {
    id: 'task-4',
    type: 'task',
    position: { x: 450, y: 250 },
    dragHandle: '.timeline-drag-handle',
    data: {
      id: 'task-4',
      title: 'Frontend Implementation',
      status: 'in_progress',
      priority: 'high',
      assignee: 'Sarah Wilson',
      startDate: getDateString(-5),
      endDate: getDateString(20),
      progress: 40,
      description: 'Implement React components and integrate with APIs',
    },
  },
  {
    id: 'task-5',
    type: 'task',
    position: { x: 100, y: 400 },
    dragHandle: '.timeline-drag-handle',
    data: {
      id: 'task-5',
      title: 'Testing & QA',
      status: 'todo',
      priority: 'medium',
      assignee: 'Alex Brown',
      startDate: getDateString(10),
      endDate: getDateString(25),
      progress: 0,
      description: 'Comprehensive testing including unit and integration tests',
    },
  },
  {
    id: 'task-6',
    type: 'task',
    position: { x: 450, y: 400 },
    dragHandle: '.timeline-drag-handle',
    data: {
      id: 'task-6',
      title: 'Deployment & Launch',
      status: 'todo',
      priority: 'urgent',
      assignee: 'Chris Davis',
      startDate: getDateString(20),
      endDate: getDateString(30),
      progress: 0,
      description: 'Deploy to production and monitor launch',
    },
  },
  {
    id: 'task-7',
    type: 'task',
    position: { x: 750, y: 100 },
    dragHandle: '.timeline-drag-handle',
    data: {
      id: 'task-7',
      title: 'Documentation',
      status: 'blocked',
      priority: 'low',
      assignee: 'Emma Taylor',
      startDate: getDateString(5),
      endDate: getDateString(35),
      progress: 15,
      description: 'Create user guides and technical documentation',
    },
  },
]

// Mock milestone nodes - EMPTY FOR DEBUGGING
const milestoneNodes: Node<MilestoneNodeData>[] = []

// Task dependencies (edges) - EMPTY FOR DEBUGGING
const edges: Edge[] = []

// Combine all nodes
const allNodes: Node[] = [...taskNodes, ...milestoneNodes]

export const mockTimelineData = {
  nodes: allNodes,
  edges,
}

// Export individual arrays for potential separate use
export { taskNodes, milestoneNodes }