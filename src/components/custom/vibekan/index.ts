/**
 * VibeKan - Generic Kanban Board Component
 * 
 * @example
 * ```tsx
 * import { VibeKan, createVibeKanConfig } from '@/components/custom/vibekan'
 * import { Task, TaskStatus } from '@repo/dataforge/client-entities'
 * 
 * const taskKanbanConfig = createVibeKanConfig<Task, TaskStatus>({
 *   columns: [
 *     { id: 'open', title: 'Open', status: TaskStatus.OPEN },
 *     { id: 'in_progress', title: 'In Progress', status: TaskStatus.IN_PROGRESS },
 *     { id: 'completed', title: 'Completed', status: TaskStatus.COMPLETED },
 *   ],
 *   getColumnId: (task) => {
 *     switch (task.status) {
 *       case TaskStatus.OPEN: return 'open'
 *       case TaskStatus.IN_PROGRESS: return 'in_progress'
 *       case TaskStatus.COMPLETED: return 'completed'
 *       default: return 'open'
 *     }
 *   },
 *   getStatusForColumn: (columnId) => {
 *     const columnMap = {
 *       'open': TaskStatus.OPEN,
 *       'in_progress': TaskStatus.IN_PROGRESS,
 *       'completed': TaskStatus.COMPLETED,
 *     }
 *     return columnMap[columnId] || TaskStatus.OPEN
 *   },
 *   renderCard: (task) => <TaskCard task={task} />,
 *   onStatusChange: async (taskId, newStatus) => {
 *     await updateTaskUI(taskId, { status: newStatus })
 *   }
 * })
 * 
 * <VibeKan entities={tasks} config={taskKanbanConfig} />
 * ```
 */

export { VibeKan } from './core/VibeKan'
export { KanbanCard } from './core/KanbanCard'
export { KanbanColumn } from './core/KanbanColumn'
export * from './types'
export * from './utils'