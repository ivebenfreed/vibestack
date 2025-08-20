# VibeStack Sync Plugin Implementation Files

## Complete File Structure for Implementation

This document outlines all the files needed to implement the VibeStack Legend State sync plugin.

## Phase 1: Core Plugin Implementation

### 1. Main Sync Plugin

**File:** `apps/web/src/sync/vibestack-plugin.ts`
```typescript
// Complete implementation as detailed in VIBESTACK_SYNC_PLUGIN.md
// Includes:
// - syncedVibeStack() factory function
// - VibeStackWebSocketManager class
// - TypeScript interfaces and types
// - Error handling and retry logic
// - Real-time WebSocket integration
```

### 2. TypeScript Type Definitions

**File:** `apps/web/src/sync/types.ts`
```typescript
// Shared types for the sync system
export interface BaseVibeStackEntity {
  id: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface Project extends BaseVibeStackEntity {
  name: string
  description?: string
  status: 'planning' | 'active' | 'completed' | 'cancelled'
  project_type: 'development' | 'marketing' | 'consulting' | 'internal'
  budget?: number
  client_id?: string
  start_date?: string
  end_date?: string
}

export interface Client extends BaseVibeStackEntity {
  name: string
  email?: string
  phone?: string
  company?: string
  status: 'active' | 'inactive' | 'prospect'
  notes?: string
}

export interface Task extends BaseVibeStackEntity {
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  project_id?: string
  assigned_to?: string
  due_date?: string
  estimated_hours?: number
  actual_hours?: number
}

export interface User extends BaseVibeStackEntity {
  email: string
  first_name: string
  last_name: string
  role: 'owner' | 'admin' | 'manager' | 'member'
  status: 'active' | 'inactive' | 'pending'
  last_login?: string
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Sync configuration types
export interface SyncConfig {
  orgId: string
  apiBaseUrl?: string
  wsUrl?: string
  retryAttempts?: number
  retryDelay?: number
}
```

### 3. Entity Stores

**File:** `apps/web/src/stores/entities.ts`
```typescript
import { observable } from '@legendapp/state'
import { syncedVibeStack } from '@/sync/vibestack-plugin'
import type { Project, Client, Task, User } from '@/sync/types'

// Get org ID from auth context or environment
const getOrgId = () => {
  // In real implementation, get from auth context
  return '01920000-1000-7000-8000-000000000001'
}

// Individual entity stores
export const projects$ = observable(
  syncedVibeStack<Project>({
    orgId: getOrgId(),
    entityName: 'Project'
  })
)

export const clients$ = observable(
  syncedVibeStack<Client>({
    orgId: getOrgId(),
    entityName: 'Client'
  })
)

export const tasks$ = observable(
  syncedVibeStack<Task>({
    orgId: getOrgId(),
    entityName: 'Task'
  })
)

export const users$ = observable(
  syncedVibeStack<User>({
    orgId: getOrgId(),
    entityName: 'User'
  })
)

// Combined store for convenience
export const vibeStackStore = {
  projects: projects$,
  clients: clients$,
  tasks: tasks$,
  users: users$
}
```

### 4. React Hooks for Store Access

**File:** `apps/web/src/hooks/useVibeStackStore.ts`
```typescript
import { useObservable } from '@legendapp/state/react'
import { useMemo } from 'react'
import { observable } from '@legendapp/state'
import { syncedVibeStack } from '@/sync/vibestack-plugin'
import { useAuth } from '@/hooks/useAuth'
import type { Project, Client, Task, User } from '@/sync/types'

// Organization-aware store hook
export function useVibeStackStore() {
  const { currentOrg } = useAuth()
  
  return useMemo(() => {
    if (!currentOrg) return null
    
    return {
      projects: observable(syncedVibeStack<Project>({
        orgId: currentOrg.id,
        entityName: 'Project'
      })),
      clients: observable(syncedVibeStack<Client>({
        orgId: currentOrg.id,
        entityName: 'Client'
      })),
      tasks: observable(syncedVibeStack<Task>({
        orgId: currentOrg.id,
        entityName: 'Task'
      })),
      users: observable(syncedVibeStack<User>({
        orgId: currentOrg.id,
        entityName: 'User'
      }))
    }
  }, [currentOrg?.id])
}

// Individual entity hooks
export function useProjects() {
  const store = useVibeStackStore()
  return useObservable(store?.projects)
}

export function useClients() {
  const store = useVibeStackStore()
  return useObservable(store?.clients)
}

export function useTasks() {
  const store = useVibeStackStore()
  return useObservable(store?.tasks)
}

export function useUsers() {
  const store = useVibeStackStore()
  return useObservable(store?.users)
}
```

### 5. Sync State Monitoring

**File:** `apps/web/src/hooks/useSyncStatus.ts`
```typescript
import { useObservable } from '@legendapp/state/react'
import { syncState } from '@legendapp/state/sync'
import { useEffect } from 'react'

export function useSyncStatus(observable: any, entityName: string) {
  const state = useObservable(syncState(observable))
  
  useEffect(() => {
    if (state.error) {
      console.error(`❌ ${entityName} sync error:`, state.error)
    }
    
    if (state.isLoaded) {
      console.log(`✅ ${entityName} loaded successfully`)
    }
  }, [state.error, state.isLoaded, entityName])
  
  return {
    isLoading: !state.isLoaded,
    isSaving: state.numPendingSets > 0,
    isOnline: !state.error,
    error: state.error,
    pendingChanges: state.numPendingSets
  }
}

// Global sync status for all entities
export function useGlobalSyncStatus() {
  const store = useVibeStackStore()
  
  const projectStatus = useSyncStatus(store?.projects, 'Projects')
  const clientStatus = useSyncStatus(store?.clients, 'Clients')
  const taskStatus = useSyncStatus(store?.tasks, 'Tasks')
  const userStatus = useSyncStatus(store?.users, 'Users')
  
  const isLoading = projectStatus.isLoading || clientStatus.isLoading || 
                   taskStatus.isLoading || userStatus.isLoading
  
  const hasErrors = projectStatus.error || clientStatus.error || 
                   taskStatus.error || userStatus.error
  
  const pendingChanges = projectStatus.pendingChanges + clientStatus.pendingChanges +
                        taskStatus.pendingChanges + userStatus.pendingChanges
  
  return {
    isLoading,
    hasErrors,
    pendingChanges,
    isOnline: !hasErrors,
    details: {
      projects: projectStatus,
      clients: clientStatus,
      tasks: taskStatus,
      users: userStatus
    }
  }
}
```

## Phase 2: Component Migration

### 6. Updated Dashboard Component

**File:** `apps/web/src/features/dashboard/DashboardLegendState.tsx`
```typescript
import React from 'react'
import { useProjects, useClients, useTasks } from '@/hooks/useVibeStackStore'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function DashboardLegendState() {
  const projects = useProjects()
  const clients = useClients() 
  const tasks = useTasks()
  
  const projectStatus = useSyncStatus(projects, 'Projects')
  const clientStatus = useSyncStatus(clients, 'Clients')
  const taskStatus = useSyncStatus(tasks, 'Tasks')

  const handleCreateProject = () => {
    // Optimistic update - instant UI response
    projects?.push({
      name: `New Project ${Date.now()}`,
      description: 'Created via Legend State',
      status: 'planning',
      project_type: 'development'
    })
  }

  const handleUpdateProject = (projectId: string) => {
    const project = projects?.find(p => p.id.get() === projectId)
    if (project) {
      project.assign({
        status: project.status.get() === 'planning' ? 'active' : 'completed',
        updated_at: new Date().toISOString()
      })
    }
  }

  if (projectStatus.isLoading || clientStatus.isLoading || taskStatus.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  const hasErrors = projectStatus.error || clientStatus.error || taskStatus.error
  if (hasErrors) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load dashboard data. Please check your connection and try again.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Badge variant={projectStatus.isOnline ? "default" : "destructive"}>
            {projectStatus.pendingChanges > 0 
              ? `${projectStatus.pendingChanges} pending` 
              : 'Synced'
            }
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Projects Card */}
        <Card>
          <CardHeader>
            <CardTitle>Projects ({projects?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projects?.slice(0, 5).map(project => (
                <div key={project.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-muted-foreground">{project.status}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateProject(project.id)}
                  >
                    Toggle Status
                  </Button>
                </div>
              ))}
              
              <Button onClick={handleCreateProject} className="w-full">
                Add Project
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clients Card */}
        <Card>
          <CardHeader>
            <CardTitle>Clients ({clients?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clients?.slice(0, 5).map(client => (
                <div key={client.id} className="p-2 bg-muted rounded">
                  <div className="font-medium">{client.name}</div>
                  <div className="text-sm text-muted-foreground">{client.company}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tasks Card */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks ({tasks?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks?.slice(0, 5).map(task => (
                <div key={task.id} className="p-2 bg-muted rounded">
                  <div className="font-medium">{task.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {task.status} - {task.priority}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time sync status */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium">Projects</div>
              <div className={projectStatus.isOnline ? "text-green-600" : "text-red-600"}>
                {projectStatus.isOnline ? "Online" : "Offline"}
              </div>
            </div>
            <div>
              <div className="font-medium">Clients</div>
              <div className={clientStatus.isOnline ? "text-green-600" : "text-red-600"}>
                {clientStatus.isOnline ? "Online" : "Offline"}
              </div>
            </div>
            <div>
              <div className="font-medium">Tasks</div>
              <div className={taskStatus.isOnline ? "text-green-600" : "text-red-600"}>
                {taskStatus.isOnline ? "Online" : "Offline"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 7. Test Page for Development

**File:** `apps/web/src/routes/_authenticated/debug/legend-state-vibestack-test.tsx`
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useProjects, useClients } from '@/hooks/useVibeStackStore'
import { useSyncStatus, useGlobalSyncStatus } from '@/hooks/useSyncStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const Route = createFileRoute('/_authenticated/debug/legend-state-vibestack-test')({
  component: LegendStateVibeStackTest,
})

function LegendStateVibeStackTest() {
  const projects = useProjects()
  const clients = useClients()
  const globalStatus = useGlobalSyncStatus()

  const handleCreateProject = () => {
    projects?.push({
      name: `Test Project ${Date.now()}`,
      description: 'Created via VibeStack sync plugin test',
      status: 'planning',
      project_type: 'development',
      budget: Math.floor(Math.random() * 100000)
    })
  }

  const handleCreateClient = () => {
    clients?.push({
      name: `Test Client ${Date.now()}`,
      company: 'ACME Corp',
      email: 'contact@acme.com',
      status: 'active'
    })
  }

  const handleUpdateRandomProject = () => {
    if (!projects || projects.length === 0) return
    
    const randomIndex = Math.floor(Math.random() * projects.length)
    const project = projects[randomIndex]
    
    project.assign({
      name: `${project.name.get()} - Updated`,
      status: project.status.get() === 'planning' ? 'active' : 'planning',
      budget: (project.budget?.get() || 0) * 1.1
    })
  }

  const handleDeleteRandomProject = () => {
    if (!projects || projects.length === 0) return
    
    const randomIndex = Math.floor(Math.random() * projects.length)
    projects.splice(randomIndex, 1)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">VibeStack Sync Plugin Test</h1>
        <div className="flex items-center gap-2">
          <Badge variant={globalStatus.isOnline ? "default" : "destructive"}>
            {globalStatus.pendingChanges > 0 
              ? `${globalStatus.pendingChanges} pending` 
              : 'All Synced'
            }
          </Badge>
          <Badge variant="outline">
            {globalStatus.isLoading ? 'Loading...' : 'Ready'}
          </Badge>
        </div>
      </div>

      {globalStatus.hasErrors && (
        <Alert variant="destructive">
          <AlertDescription>
            Sync errors detected. Check console for details.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects Test */}
        <Card>
          <CardHeader>
            <CardTitle>Projects ({projects?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleCreateProject}>
                Create Project
              </Button>
              <Button 
                onClick={handleUpdateRandomProject}
                disabled={!projects || projects.length === 0}
                variant="outline"
              >
                Update Random
              </Button>
            </div>
            <Button 
              onClick={handleDeleteRandomProject}
              disabled={!projects || projects.length === 0}
              variant="destructive"
              className="w-full"
            >
              Delete Random
            </Button>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projects?.map(project => (
                <div key={project.id} className="p-2 bg-muted rounded text-sm">
                  <div className="font-medium">{project.name}</div>
                  <div className="text-muted-foreground">
                    {project.status} • ${project.budget || 'No budget'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clients Test */}
        <Card>
          <CardHeader>
            <CardTitle>Clients ({clients?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleCreateClient} className="w-full">
              Create Client
            </Button>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clients?.map(client => (
                <div key={client.id} className="p-2 bg-muted rounded text-sm">
                  <div className="font-medium">{client.name}</div>
                  <div className="text-muted-foreground">
                    {client.company} • {client.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status Details */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Status Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Projects</div>
              <div className="text-muted-foreground">
                Status: {globalStatus.details.projects.isOnline ? "Online" : "Offline"}
                <br />
                Pending: {globalStatus.details.projects.pendingChanges}
              </div>
            </div>
            <div>
              <div className="font-medium">Clients</div>
              <div className="text-muted-foreground">
                Status: {globalStatus.details.clients.isOnline ? "Online" : "Offline"}
                <br />
                Pending: {globalStatus.details.clients.pendingChanges}
              </div>
            </div>
            <div>
              <div className="font-medium">Global Status</div>
              <div className="text-muted-foreground">
                Loading: {globalStatus.isLoading ? "Yes" : "No"}
                <br />
                Total Pending: {globalStatus.pendingChanges}
              </div>
            </div>
            <div>
              <div className="font-medium">Connection</div>
              <div className="text-muted-foreground">
                WebSocket: {globalStatus.isOnline ? "Connected" : "Disconnected"}
                <br />
                Errors: {globalStatus.hasErrors ? "Yes" : "No"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

## Phase 3: Package Configuration

### 8. Package Dependencies

**File:** `apps/web/package.json` (additions)
```json
{
  "dependencies": {
    "@legendapp/state": "^3.0.0",
    "@legendapp/state-react": "^3.0.0",
    "@legendapp/state-sync-plugins-crud": "^3.0.0",
    "@legendapp/state-persist-plugins-local-storage": "^3.0.0"
  }
}
```

### 9. Environment Configuration

**File:** `apps/web/.env.example` (additions)
```bash
# Legend State Sync Configuration
VITE_LEGEND_STATE_DEBUG=false
VITE_SYNC_RETRY_ATTEMPTS=5
VITE_SYNC_RETRY_DELAY=1000
VITE_WEBSOCKET_RECONNECT_DELAY=1000
```

## Implementation Order

1. **Install dependencies** - Add Legend State packages
2. **Create core plugin** - Implement `vibestack-plugin.ts`
3. **Set up types** - Define TypeScript interfaces
4. **Create stores** - Basic entity observables
5. **Add hooks** - React integration helpers
6. **Build test page** - Debug/development interface
7. **Migrate dashboard** - First real component
8. **Add monitoring** - Sync status and error handling
9. **Gradual migration** - Convert remaining components
10. **Remove legacy code** - Clean up old sync system

This provides a complete, step-by-step implementation plan with all necessary files.