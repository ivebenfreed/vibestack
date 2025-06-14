import React, { useMemo } from 'react'
import { useSelector } from '@xstate/store/react'
import { tasksAtom } from '@/domain/task'
import { shallowEqual } from '@xstate/store'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from '@/components/ui/badge'
import { List } from 'lucide-react'

/**
 * Enhanced Recent Tasks with XState Reactivity
 * Reads directly from XState atoms for excellent performance
 */
export function RecentTasksEnhanced() {
  // 🎯 XSTATE REACTIVITY: Read directly from XState atom with useSelector
  const allTasks = useSelector(
    tasksAtom,
    (tasksRecord) => {
      const tasks = Object.values(tasksRecord);
      return tasks.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime; // Latest first
      });
    },
    shallowEqual
  )
  
  // Calculate recent tasks from XState data
  const recentTasks = useMemo(() => {
    return allTasks.slice(0, 5) // Already sorted above
  }, [allTasks])

  // 🎯 REDUCED LOGGING for performance
  if (Math.random() < 0.05) { // Only log 5% of renders
    console.log(`[RecentTasksEnhanced] XState reactive render with ${recentTasks.length} tasks`)
  }

  // Empty state
  if (recentTasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent tasks found.</p>
  }

  return (
    <div className="space-y-6">
      {recentTasks.map((task) => (
        <div key={task.id} className="flex items-center gap-4">
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              <List className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-x-2">
            <div className="space-y-1">
              <p className="text-sm leading-none font-medium">{task.title || 'Untitled Task'}</p>
              <p className="text-muted-foreground text-xs">
                ID: {task.id}
              </p>
            </div>
            {task.status && (
              <Badge variant="outline" className="text-xs">
                {task.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  )
} 