import { createLazyFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Database, Plus, Trash2, Edit, RefreshCw, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  orgContext$, 
  getEntity$, 
  removeEntityFromSchema,
  loadOrgContext,
  clearContext 
} from '@/legend-state'
import { orgSchemaClient } from '@/lib/schema-client'
import { useAuth } from '@/lib/auth'

const EntityOperationsDebug = observer(function EntityOperationsDebug() {
  const { currentOrganization, user } = useAuth()
  const [testEntityName, setTestEntityName] = useState('test_entity')
  const [testRecordData, setTestRecordData] = useState('{"name": "Test Item", "description": "Created from debug route"}')
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Use observables
  const loading = use$(orgContext$.loading)
  const schema = use$(orgContext$.schema)
  const currentOrgId = use$(orgContext$.orgId)

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`
    setLogs(prev => [logEntry, ...prev].slice(0, 50)) // Keep last 50 logs
    console.log(logEntry)
  }

  const clearLogs = () => setLogs([])

  // Test loading organization context
  const testLoadContext = async () => {
    if (!currentOrganization?.id || !user?.id) {
      addLog('No organization or user ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Loading org context for ${currentOrganization.id}`)
      await loadOrgContext(currentOrganization.id, user.id)
      addLog('Org context loaded successfully', 'success')
    } catch (error) {
      addLog(`Failed to load org context: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Test creating entity via DataForge API
  const testCreateEntity = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Creating entity: ${testEntityName}`)
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entityName: testEntityName,
          definition: {
            archetype: 'project',
            fields: [
              { name: 'name', type: 'text', required: true },
              { name: 'description', type: 'text', required: false },
              { name: 'status', type: 'text', required: false }
            ]
          }
        })
      })
      
      const data = await result.json()
      
      if (data.success) {
        addLog(`Entity created: ${testEntityName}`, 'success')
        // Reload context to pick up new entity
        await loadOrgContext(currentOrganization.id, user!.id)
      } else {
        addLog(`Failed to create entity: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Error creating entity: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Test getting entity observable
  const testGetEntityObservable = () => {
    try {
      addLog(`Getting entity observable for: ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (entityObs) {
        addLog(`Entity observable found for ${testEntityName}`, 'success')
        // Use peek() to get the current value without subscribing
        const data = entityObs.peek()
        addLog(`Current data: ${JSON.stringify(data, null, 2)}`)
      } else {
        addLog(`Entity observable not found for ${testEntityName}`, 'error')
      }
    } catch (error) {
      addLog(`Error getting entity observable: ${error}`, 'error')
    }
  }

  // Test creating record
  const testCreateRecord = async () => {
    try {
      addLog(`Creating record in ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (!entityObs) {
        addLog(`Entity observable not found for ${testEntityName}`, 'error')
        return
      }

      const recordData = JSON.parse(testRecordData)
      const id = crypto.randomUUID()
      
      addLog(`Setting record with ID: ${id}`)
      entityObs[id].set({
        id,
        ...recordData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      addLog(`Record created successfully with ID: ${id}`, 'success')
    } catch (error) {
      addLog(`Error creating record: ${error}`, 'error')
    }
  }

  // Test updating record
  const testUpdateRecord = async () => {
    try {
      addLog(`Updating first record in ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (!entityObs) {
        addLog(`Entity observable not found for ${testEntityName}`, 'error')
        return
      }

      const data = entityObs.peek()
      const firstRecordId = Object.keys(data)[0]
      
      if (!firstRecordId) {
        addLog(`No records found to update in ${testEntityName}`, 'error')
        return
      }

      addLog(`Updating record: ${firstRecordId}`)
      entityObs[firstRecordId].assign({
        description: `Updated at ${new Date().toLocaleTimeString()}`,
        updated_at: new Date().toISOString()
      })
      
      addLog(`Record updated successfully: ${firstRecordId}`, 'success')
    } catch (error) {
      addLog(`Error updating record: ${error}`, 'error')
    }
  }

  // Test deleting record
  const testDeleteRecord = async () => {
    try {
      addLog(`Deleting first record in ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (!entityObs) {
        addLog(`Entity observable not found for ${testEntityName}`, 'error')
        return
      }

      const data = entityObs.peek()
      const firstRecordId = Object.keys(data)[0]
      
      if (!firstRecordId) {
        addLog(`No records found to delete in ${testEntityName}`, 'error')
        return
      }

      addLog(`Deleting record: ${firstRecordId}`)
      entityObs[firstRecordId].delete()
      
      addLog(`Record deleted successfully: ${firstRecordId}`, 'success')
    } catch (error) {
      addLog(`Error deleting record: ${error}`, 'error')
    }
  }

  // Test querying entity data via DataForge API
  const testQueryEntityData = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Querying data from entity: ${testEntityName}`)
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?limit=5`, {
        method: 'GET',
        credentials: 'include',
      })
      
      const data = await result.json()
      
      if (data.success) {
        addLog(`Query successful: Found ${data.data?.length || 0} records`, 'success')
        if (data.data && data.data.length > 0) {
          addLog(`Sample record: ${JSON.stringify(data.data[0], null, 2)}`)
        }
      } else {
        addLog(`Failed to query entity data: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Error querying entity data: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Test clearing context
  const testClearContext = () => {
    try {
      addLog('Clearing all observables')
      clearContext()
      addLog('Context cleared successfully', 'success')
    } catch (error) {
      addLog(`Error clearing context: ${error}`, 'error')
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entity Operations Debug</h1>
          <p className="text-muted-foreground mt-2">
            Test all Legend State observable operations for debugging
          </p>
        </div>
        <Button onClick={clearLogs} variant="outline">
          Clear Logs
        </Button>
      </div>

      {/* Current State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Current State
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Organization ID</p>
              <Badge variant={currentOrgId ? 'default' : 'destructive'}>
                {currentOrgId || 'Not loaded'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Loading State</p>
              <Badge variant={loading ? 'secondary' : 'default'}>
                {loading ? 'Loading' : 'Ready'}
              </Badge>
            </div>
          </div>
          
          <div>
            <p className="text-sm font-medium">Available Entities</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {schema?.entities ? Object.keys(schema.entities).map(entityName => (
                <Badge key={entityName} variant="outline">
                  {entityName}
                </Badge>
              )) : (
                <Badge variant="secondary">No entities loaded</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Parameters</CardTitle>
          <CardDescription>
            Configure the entity name and record data for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Entity Name</label>
            <Input
              value={testEntityName}
              onChange={(e) => setTestEntityName(e.target.value)}
              placeholder="test_entity"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Record Data (JSON)</label>
            <textarea
              className="w-full p-2 border rounded-md text-sm font-mono"
              rows={3}
              value={testRecordData}
              onChange={(e) => setTestRecordData(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Context Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={testLoadContext}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Context
            </Button>
            <Button
              onClick={testClearContext}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Context
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Entity Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={testCreateEntity}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Entity
            </Button>
            <Button
              onClick={testQueryEntityData}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Search className="h-4 w-4 mr-2" />
              Query Entity Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Record Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={testGetEntityObservable}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Database className="h-4 w-4 mr-2" />
              Get Observable
            </Button>
            <Button
              onClick={testCreateRecord}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Record
            </Button>
            <Button
              onClick={testUpdateRecord}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Edit className="h-4 w-4 mr-2" />
              Update Record
            </Button>
            <Button
              onClick={testDeleteRecord}
              disabled={isLoading}
              className="w-full"
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Record
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Operation Logs
          </CardTitle>
          <CardDescription>
            Real-time logs of all operations and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Run some operations to see output.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

export const Route = createLazyFileRoute('/_authenticated/debug/entity-operations')({
  component: EntityOperationsDebug,
})