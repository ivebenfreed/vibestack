import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { getEntity$ } from '@/legend-state'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/debug/resolved-fields-debug')({
  component: observer(ResolvedFieldsDebugPage),
})

function ResolvedFieldsDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [selectedEntity, setSelectedEntity] = useState<string>('Task')
  const [selectedRecord, setSelectedRecord] = useState<string>('')

  const entities = ['Task', 'Project', 'Document', 'Collection', 'Record']
  
  const entityObs = getEntity$(selectedEntity)
  const entityData = entityObs?.get() || {}
  const recordIds = Object.keys(entityData)

  useEffect(() => {
    // Debug Legend State data
    const info: any = {
      timestamp: new Date().toISOString(),
      selectedEntity,
      entityObservableExists: !!entityObs,
      recordCount: recordIds.length,
      records: {},
      hasResolvedFields: false,
      resolvedFieldsFound: [],
      sampleRecordData: null
    }

    // Analyze records for _resolved fields
    for (const recordId of recordIds.slice(0, 3)) { // Sample first 3 records
      const record = entityData[recordId]
      if (record) {
        const recordInfo: any = {
          id: recordId,
          fields: Object.keys(record),
          resolvedFields: [],
          hasResolvedFields: false
        }

        // Check for _resolved fields
        for (const field of Object.keys(record)) {
          if (field.endsWith('_resolved')) {
            recordInfo.resolvedFields.push(field)
            recordInfo.hasResolvedFields = true
            info.hasResolvedFields = true
            info.resolvedFieldsFound.push({
              recordId,
              field,
              value: record[field]
            })
          }
        }

        info.records[recordId] = recordInfo
        
        // Set sample data
        if (!info.sampleRecordData) {
          info.sampleRecordData = {
            recordId,
            fullRecord: record
          }
        }
      }
    }

    setDebugInfo(info)
  }, [selectedEntity, entityObs, entityData, recordIds])

  const handleTestUpdate = async () => {
    if (!selectedRecord || !entityData[selectedRecord]) return

    const record = entityData[selectedRecord]
    const testUpdate = {
      ...record,
      title: `TEST UPDATE ${Date.now()}`,
      // Intentionally include _resolved fields to test filtering
      test_resolved: { test: 'data' },
      priority_resolved: record.priority_resolved
    }

    console.log('🧪 [Debug] Testing update with _resolved fields:', testUpdate)

    try {
      const response = await fetch(`/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/data/${selectedEntity}/${selectedRecord}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testUpdate)
      })

      const result = await response.json()
      console.log('🧪 [Debug] Update result:', { response: response.status, result })
      
      setDebugInfo(prev => ({
        ...prev,
        lastTestUpdate: {
          timestamp: new Date().toISOString(),
          status: response.status,
          success: response.ok,
          result,
          sentData: testUpdate
        }
      }))
    } catch (error) {
      console.error('🧪 [Debug] Update failed:', error)
      setDebugInfo(prev => ({
        ...prev,
        lastTestUpdate: {
          timestamp: new Date().toISOString(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    }
  }

  const handleClearStorage = () => {
    // Clear Legend State cache
    if (typeof window !== 'undefined') {
      // Clear localStorage
      const lsKeys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.includes('legend') || key?.includes('entity') || key?.includes('vibegrid')) {
          lsKeys.push(key)
        }
      }
      lsKeys.forEach(key => localStorage.removeItem(key))

      // Clear sessionStorage
      const ssKeys = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.includes('legend') || key?.includes('entity') || key?.includes('vibegrid')) {
          ssKeys.push(key)
        }
      }
      ssKeys.forEach(key => sessionStorage.removeItem(key))

      // Clear IndexedDB (Legend State's default persistence)
      if (window.indexedDB) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name?.includes('legend') || db.name?.includes('entity')) {
              indexedDB.deleteDatabase(db.name)
            }
          })
        })
      }

      alert('Cleared browser storage. Please refresh the page.')
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">🔍 Resolved Fields Debug Tool</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Entity Type</label>
                <select 
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="w-full p-2 border rounded"
                  data-testid="entity-selector"
                >
                  {entities.map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Test Record</label>
                <select 
                  value={selectedRecord}
                  onChange={(e) => setSelectedRecord(e.target.value)}
                  className="w-full p-2 border rounded"
                  data-testid="record-selector"
                >
                  <option value="">Select a record...</option>
                  {recordIds.slice(0, 10).map(id => (
                    <option key={id} value={id}>{id.slice(0, 8)}... ({entityData[id]?.title || entityData[id]?.name || 'Unnamed'})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleTestUpdate}
                  disabled={!selectedRecord}
                  className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
                  data-testid="test-update-button"
                >
                  🧪 Test Update (with _resolved fields)
                </button>

                <button
                  onClick={handleClearStorage}
                  className="w-full bg-yellow-500 text-white p-2 rounded hover:bg-yellow-600"
                  data-testid="clear-storage-button"
                >
                  🧹 Clear Browser Storage & Reload
                </button>
              </div>
            </div>
          </div>

          {/* Analysis Summary */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Analysis Summary</h2>
            <div className="space-y-2 text-sm">
              <div data-testid="analysis-summary">
                <p><strong>Entity:</strong> {debugInfo.selectedEntity}</p>
                <p><strong>Record Count:</strong> {debugInfo.recordCount}</p>
                <p><strong>Has _resolved Fields:</strong> <span className={debugInfo.hasResolvedFields ? 'text-red-600' : 'text-green-600'}>{debugInfo.hasResolvedFields ? 'YES' : 'NO'}</span></p>
                <p><strong>Resolved Fields Found:</strong> {debugInfo.resolvedFieldsFound?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Data */}
        <div className="space-y-4">
          {debugInfo.hasResolvedFields && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-red-800 mb-3">⚠️ _resolved Fields Detected!</h3>
              <div className="space-y-2 text-sm text-red-700" data-testid="resolved-fields-list">
                {debugInfo.resolvedFieldsFound?.map((item: any, idx: number) => (
                  <div key={idx} className="bg-red-100 p-2 rounded">
                    <strong>{item.recordId.slice(0, 8)}...{item.field}:</strong>
                    <pre className="mt-1 text-xs overflow-x-auto">{JSON.stringify(item.value, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {debugInfo.sampleRecordData && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3">Sample Record Data</h3>
              <div className="text-xs">
                <strong>Record ID:</strong> {debugInfo.sampleRecordData.recordId}
                <pre 
                  className="mt-2 bg-gray-100 p-2 rounded overflow-x-auto max-h-96"
                  data-testid="sample-record-data"
                >
                  {JSON.stringify(debugInfo.sampleRecordData.fullRecord, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {debugInfo.lastTestUpdate && (
            <div className={`p-4 rounded-lg border ${debugInfo.lastTestUpdate.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h3 className="text-lg font-semibold mb-3">Last Test Result</h3>
              <div className="text-sm" data-testid="test-result">
                <p><strong>Time:</strong> {debugInfo.lastTestUpdate.timestamp}</p>
                <p><strong>Status:</strong> {debugInfo.lastTestUpdate.status || 'Error'}</p>
                <p><strong>Success:</strong> {debugInfo.lastTestUpdate.success ? 'YES' : 'NO'}</p>
                {debugInfo.lastTestUpdate.result && (
                  <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(debugInfo.lastTestUpdate.result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-3">Full Debug Info</h3>
            <pre 
              className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-96"
              data-testid="full-debug-info"
            >
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}