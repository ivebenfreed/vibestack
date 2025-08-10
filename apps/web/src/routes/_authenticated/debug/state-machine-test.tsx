import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/debug/state-machine-test')({
  component: StateMachineTestPage,
})

function StateMachineTestPage() {
  // Get task count from atom
  const taskCount = useSelector(
    tasksAtom,
    (tasks) => Object.keys(tasks).length,
    shallowEqual
  )

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Debug: State Machine Test</h1>
        <p className="text-muted-foreground">State machine testing has been removed as it's no longer needed</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Current task count: {taskCount}</p>
        </CardContent>
      </Card>
    </div>
  )
}

