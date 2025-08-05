import React, { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from '@/components/ui/badge'
import { List } from 'lucide-react'
import { db } from '@repo/dataforge/dexie-schema'
import type { Task } from '@repo/dataforge/client-entities'

/**
 * Enhanced Recent Tasks with Dexie
 * Reads directly from Dexie database for recent tasks
 */
export function RecentTasksEnhanced() {
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRecentTasks() {
      try {
        // Get 5 most recently updated tasks
        const tasks = await db.tasks
          .orderBy('updatedAt')
          .reverse()
          .limit(5)
          .toArray()
        
        setRecentTasks(tasks as Task[])
        console.log(`[RecentTasksEnhanced] Loaded ${tasks.length} recent tasks from Dexie`)
      } catch (error) {
        console.error('[RecentTasksEnhanced] Error loading tasks from Dexie:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRecentTasks()
  }, [])

  // Loading state
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading recent tasks...</p>
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