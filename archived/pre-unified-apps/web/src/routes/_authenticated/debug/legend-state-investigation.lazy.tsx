import { createLazyFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef } from 'react'
import { getEntity$, orgContext$ } from '@/legend-state/observables'

const LegendStateInvestigation = observer(function LegendStateInvestigation() {
  const [logs, setLogs] = useState<string[]>([])
  const [entityName] = useState('Client')
  
  // Manual observable references to track them
  const entityRef = useRef<any>(null)
  const [observableId, setObservableId] = useState(0)
  
  // Get org context observables
  const schema = use$(orgContext$.schema)
  const loading = use$(orgContext$.loading)
  const error = use$(orgContext$.error)
  
  // Track when we get the entity observable
  const entity$ = getEntity$(entityName)
  
  // Use Legend State's use$ to watch the entity
  const entityData = use$(entity$ || {})
  
  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${message}`
    console.log(logEntry)
    setLogs(prev => [...prev, logEntry])
  }
  
  // Debug when schema/loading changes
  useEffect(() => {
    log(`Schema/Loading state: schema=${!!schema}, loading=${loading}, entityCount=${schema?.entities ? Object.keys(schema.entities).length : 0}`)
  }, [schema, loading])
  
  // Debug when entity observable reference changes
  useEffect(() => {
    const newEntity$ = getEntity$(entityName)
    const hasChanged = entityRef.current !== newEntity$
    
    if (hasChanged) {
      entityRef.current = newEntity$
      setObservableId(prev => prev + 1)
      log(`🔄 Entity observable reference changed! ID: ${observableId + 1}, exists: ${!!newEntity$}`)
      
      if (newEntity$) {
        // Check what type of object this actually is
        log(`📊 Entity object type: ${Object.prototype.toString.call(newEntity$)}`)
        log(`📊 Has peek method: ${typeof newEntity$.peek === 'function'}`)
        log(`📊 Has get method: ${typeof newEntity$.get === 'function'}`)
        log(`📊 Constructor name: ${newEntity$.constructor?.name}`)
        log(`📊 Object keys: ${Object.keys(newEntity$).slice(0, 10).join(', ')}`)
        
        // Try different ways to get the data
        if (typeof newEntity$.peek === 'function') {
          try {
            const currentData = newEntity$.peek()
            log(`📊 Observable .peek() data: type=${typeof currentData}, isArray=${Array.isArray(currentData)}, keys=${currentData && typeof currentData === 'object' ? Object.keys(currentData).length : 'N/A'}`)
          } catch (error) {
            log(`❌ .peek() failed: ${error.message}`)
          }
        } else if (typeof newEntity$.get === 'function') {
          try {
            const currentData = newEntity$.get()
            log(`📊 Observable .get() data: type=${typeof currentData}, isArray=${Array.isArray(currentData)}, keys=${currentData && typeof currentData === 'object' ? Object.keys(currentData).length : 'N/A'}`)
          } catch (error) {
            log(`❌ .get() failed: ${error.message}`)
          }
        } else {
          log(`❌ No .peek() or .get() method found!`)
        }
      }
    }
  }, [schema, loading, entityName, observableId])
  
  // Debug when entityData from use$ changes
  useEffect(() => {
    log(`📈 use$(entity$) data changed: type=${typeof entityData}, isArray=${Array.isArray(entityData)}, keys=${entityData && typeof entityData === 'object' ? Object.keys(entityData).length : 'N/A'}`)
    
    if (entityData && typeof entityData === 'object') {
      const keys = Object.keys(entityData)
      if (keys.length > 0) {
        log(`✅ Sample data keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`)
        log(`✅ Sample record: ${JSON.stringify(entityData[keys[0]], null, 2).substring(0, 200)}...`)
      }
    }
  }, [entityData])
  
  const clearLogs = () => setLogs([])
  
  const testDirectAccess = () => {
    log('🧪 Testing direct entity observable access...')
    const entity$ = getEntity$(entityName)
    if (entity$) {
      log(`🧪 Entity object: ${Object.prototype.toString.call(entity$)}`)
      log(`🧪 Has peek: ${typeof entity$.peek === 'function'}`)
      log(`🧪 Has get: ${typeof entity$.get === 'function'}`)
      
      // Try different methods to get data
      let data = null
      if (typeof entity$.peek === 'function') {
        try {
          data = entity$.peek()
          log(`Direct peek() result: type=${typeof data}, keys=${data && typeof data === 'object' ? Object.keys(data).length : 'N/A'}`)
        } catch (error) {
          log(`❌ peek() failed: ${error.message}`)
        }
      } else if (typeof entity$.get === 'function') {
        try {
          data = entity$.get()
          log(`Direct get() result: type=${typeof data}, keys=${data && typeof data === 'object' ? Object.keys(data).length : 'N/A'}`)
        } catch (error) {
          log(`❌ get() failed: ${error.message}`)
        }
      } else {
        log(`❌ No peek() or get() method available!`)
      }
      
      if (data && typeof data === 'object') {
        const keys = Object.keys(data)
        log(`Direct access keys: ${keys.slice(0, 10).join(', ')}`)
        if (keys.length > 0) {
          log(`First record via direct access: ${JSON.stringify(data[keys[0]], null, 2).substring(0, 300)}...`)
        }
      }
    } else {
      log('❌ No entity observable found!')
    }
  }
  
  const testObservableStability = () => {
    log('🧪 Testing observable reference stability...')
    const entity1 = getEntity$(entityName)
    setTimeout(() => {
      const entity2 = getEntity$(entityName) 
      log(`Observable stability: same reference? ${entity1 === entity2}`)
    }, 100)
    
    setTimeout(() => {
      const entity3 = getEntity$(entityName)
      log(`Observable stability (200ms later): same reference? ${entity1 === entity3}`)
    }, 200)
  }
  
  const forceRefresh = () => {
    log('🔄 Force refreshing component...')
    setObservableId(prev => prev + 1)
  }

  // Convert to array like useTableEntity$ does
  const convertedData = entityData && typeof entityData === 'object' && !Array.isArray(entityData)
    ? Object.values(entityData) 
    : Array.isArray(entityData) ? entityData : []

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Legend State Investigation</h1>
          <p className="text-muted-foreground">
            Debug observable behavior for {entityName} entity
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={testDirectAccess} variant="outline">
            Test Direct Access
          </Button>
          <Button onClick={testObservableStability} variant="outline">
            Test Stability
          </Button>
          <Button onClick={forceRefresh} variant="outline">
            Force Refresh
          </Button>
          <Button onClick={clearLogs} variant="destructive">
            Clear Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current State */}
        <Card>
          <CardHeader>
            <CardTitle>Current State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Schema Loaded</div>
                <div className={schema ? 'text-green-600' : 'text-red-600'}>
                  {schema ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              <div>
                <div className="font-medium">Loading</div>
                <div className={loading ? 'text-yellow-600' : 'text-green-600'}>
                  {loading ? '🟡 Yes' : '✅ No'}
                </div>
              </div>
              <div>
                <div className="font-medium">Observable Exists</div>
                <div className={entity$ ? 'text-green-600' : 'text-red-600'}>
                  {entity$ ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              <div>
                <div className="font-medium">Observable ID</div>
                <div className="text-blue-600">#{observableId}</div>
              </div>
              <div>
                <div className="font-medium">Raw Data Type</div>
                <div className="text-blue-600">{typeof entityData}</div>
              </div>
              <div>
                <div className="font-medium">Raw Data Keys</div>
                <div className="text-blue-600">
                  {entityData && typeof entityData === 'object' ? Object.keys(entityData).length : 'N/A'}
                </div>
              </div>
              <div>
                <div className="font-medium">Converted Array Length</div>
                <div className="text-blue-600">{convertedData.length}</div>
              </div>
              <div>
                <div className="font-medium">Has Data</div>
                <div className={convertedData.length > 0 ? 'text-green-600' : 'text-red-600'}>
                  {convertedData.length > 0 ? '✅ Yes' : '❌ No'}
                </div>
              </div>
            </div>
            
            {convertedData.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 rounded">
                <div className="font-medium text-green-800">✅ Data Successfully Loaded!</div>
                <div className="text-green-600 text-sm mt-1">
                  {convertedData.length} records available
                </div>
                <div className="text-xs text-green-500 mt-2">
                  Sample: {JSON.stringify(convertedData[0], null, 2).substring(0, 200)}...
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debug Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Logs ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-y-auto bg-gray-50 p-4 rounded text-sm font-mono">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet...</div>
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
    </div>
  )
})

export const Route = createLazyFileRoute('/_authenticated/debug/legend-state-investigation')({
  component: LegendStateInvestigation,
})