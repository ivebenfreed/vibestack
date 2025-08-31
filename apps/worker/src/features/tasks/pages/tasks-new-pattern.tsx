import React from 'react'
import { ContentContainer } from '@/components/layout/content-container'
import { TasksEnhanced } from '../components/tasks-enhanced'

const TasksNewPattern: React.FC = () => {
  return (
    <ContentContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks (New Pattern)</h1>
          <p className="text-muted-foreground">
            Enhanced tasks component with new layout pattern
          </p>
        </div>
        
        <TasksEnhanced />
      </div>
    </ContentContainer>
  )
}

export default TasksNewPattern 