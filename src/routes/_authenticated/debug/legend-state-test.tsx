import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { entityOperations, getEntity$ } from '@/legend-state'

export const Route = createFileRoute('/_authenticated/debug/legend-state-test')({
  component: LegendStateTestPage
})

function LegendStateTestPage() {
  const [testResult, setTestResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Test basic Legend State observable access
  const testObservableAccess = async () => {
    setLoading(true)
    setTestResult('')
    
    try {
      console.log('🧪 [LegendStateTest] Starting basic observable access test...')
      
      // Get the Task entity observable (we know this has data)
      const entity$ = getEntity$('Task')
      console.log('🧪 [LegendStateTest] Retrieved Task observable:', {
        type: typeof entity$,
        isNull: entity$ === null,
        isUndefined: entity$ === undefined,
        constructor: entity$?.constructor?.name,
        hasGet: typeof entity$?.get === 'function',
        keys: entity$ && typeof entity$ === 'object' ? Object.keys(entity$).slice(0, 5) : 'not-object'
      })
      
      if (!entity$) {
        throw new Error('Entity observable is null/undefined')
      }

      // Inspect the actual structure of the syncedCrud observable
      console.log('🧪 [LegendStateTest] Observable structure:', {
        type: typeof entity$,
        isArray: Array.isArray(entity$),
        isFunction: typeof entity$ === 'function',
        hasGet: typeof entity$?.get === 'function',
        hasPeek: typeof entity$?.peek === 'function',
        hasValue: typeof entity$?.value !== 'undefined',
        keys: Object.keys(entity$).slice(0, 10),
        constructor: entity$?.constructor?.name,
        prototype: Object.getPrototypeOf(entity$)?.constructor?.name
      })

      // Try to access the data - syncedCrud might store data as direct properties
      let data
      try {
        // For syncedCrud observables, the data might be accessed directly as the observable itself
        // or as a property. Let's try multiple approaches:
        if (typeof entity$.get === 'function') {
          data = entity$.get()
        } else if (typeof entity$.peek === 'function') {
          data = entity$.peek()
        } else if (entity$.value !== undefined) {
          data = entity$.value
        } else {
          // Try accessing the observable directly - it might be the data itself
          data = entity$
        }
        
        console.log('🧪 [LegendStateTest] Data retrieved successfully:', {
          type: typeof data,
          isObject: typeof data === 'object' && data !== null,
          recordCount: data && typeof data === 'object' ? Object.keys(data).length : 'not-object'
        })
      } catch (error) {
        console.error('🧪 [LegendStateTest] Failed to get data:', error)
        throw new Error(`Cannot get data: ${error.message}`)
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Data is not an object or is null')
      }

      // Get first record ID
      const recordIds = Object.keys(data)
      if (recordIds.length === 0) {
        throw new Error('No records found in data')
      }

      const firstRecordId = recordIds[0]
      console.log('🧪 [LegendStateTest] Testing with first record:', firstRecordId)

      // Try to access the record
      const record = data[firstRecordId]
      console.log('🧪 [LegendStateTest] Record data:', {
        exists: !!record,
        type: typeof record,
        keys: record && typeof record === 'object' ? Object.keys(record).slice(0, 5) : 'not-object'
      })

      // Try to access the record observable
      const record$ = entity$[firstRecordId]
      console.log('🧪 [LegendStateTest] Record observable:', {
        type: typeof record$,
        isNull: record$ === null,
        isUndefined: record$ === undefined,
        hasSet: typeof record$?.set === 'function',
        hasAssign: typeof record$?.assign === 'function'
      })

      if (!record$) {
        throw new Error(`Record observable ${firstRecordId} is null/undefined`)
      }

      // Try to access a field observable
      const titleField$ = record$.title
      console.log('🧪 [LegendStateTest] Title field observable:', {
        type: typeof titleField$,
        isNull: titleField$ === null,
        isUndefined: titleField$ === undefined,
        hasSet: typeof titleField$?.set === 'function',
        hasAssign: typeof titleField$?.assign === 'function',
        keys: titleField$ ? Object.keys(titleField$).slice(0, 10) : 'null-or-undefined',
        currentValue: titleField$ !== null ? (titleField$?.peek ? titleField$.peek() : 'no-peek-method') : 'field-is-null'
      })

      // Check what the actual title value is in the raw data
      console.log('🧪 [LegendStateTest] Raw record title value:', record.title)

      setTestResult(`✅ Success! Observable structure looks correct:
- Entity observable: ${typeof entity$}
- Data records: ${recordIds.length}
- First record ID: ${firstRecordId}
- Record observable: ${typeof record$}
- Title field observable: ${typeof titleField$}
- Title field has .set(): ${typeof titleField$?.set === 'function'}
- Current title value: ${titleField$?.peek ? titleField$.peek() : 'N/A'}`)

    } catch (error) {
      console.error('🧪 [LegendStateTest] Test failed:', error)
      setTestResult(`❌ Test failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Test Legend State update
  const testUpdate = async () => {
    setLoading(true)
    setTestResult('')
    
    try {
      console.log('🧪 [LegendStateTest] Starting update test...')
      
      // Get the Task entity observable (we know this has data)
      const entity$ = getEntity$('Task')
      if (!entity$) {
        throw new Error('Entity observable is null')
      }

      // Use same pattern as first test - access entity$ directly 
      const data = entity$
      const recordIds = Object.keys(data)
      if (recordIds.length === 0) {
        throw new Error('No records found')
      }

      const testRecordId = recordIds[0]
      const testTitle = `Updated Task ${Date.now()}`
      
      console.log('🧪 [LegendStateTest] Attempting to update title field...')
      console.log('🧪 [LegendStateTest] Record ID:', testRecordId)
      console.log('🧪 [LegendStateTest] New title:', testTitle)

      // Try the update using our current pattern
      const record$ = entity$[testRecordId]
      if (!record$) {
        throw new Error(`Record observable ${testRecordId} is null`)
      }

      const titleField$ = record$.title
      if (!titleField$) {
        throw new Error('Title field observable is null')
      }

      if (typeof titleField$.set !== 'function') {
        throw new Error(`Title field .set is not a function: ${typeof titleField$.set}`)
      }

      // Perform the update
      titleField$.set(testTitle)
      
      console.log('🧪 [LegendStateTest] Update completed successfully!')
      
      // Verify the update
      const updatedValue = titleField$.peek()
      console.log('🧪 [LegendStateTest] Updated value:', updatedValue)

      setTestResult(`✅ Update successful! 
- Record ID: ${testRecordId}
- New title: ${testTitle}
- Verified value: ${updatedValue}
- Update method: entity$[id].title.set(value)`)

    } catch (error) {
      console.error('🧪 [LegendStateTest] Update test failed:', error)
      setTestResult(`❌ Update failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Test using entityOperations.updateEntity
  const testEntityOperationsUpdate = async () => {
    setLoading(true)
    setTestResult('')
    
    try {
      console.log('🧪 [LegendStateTest] Testing entityOperations.updateEntity...')
      
      const entity$ = getEntity$('Task')
      // Use same pattern as first test - access entity$ directly 
      const data = entity$
      const recordIds = Object.keys(data)
      const testRecordId = recordIds[0]
      const testTitle = `EntityOps Task ${Date.now()}`
      
      // Use our updateEntity function
      const result = await entityOperations.updateEntity('Task', testRecordId, {
        title: testTitle
      })
      
      console.log('🧪 [LegendStateTest] entityOperations.updateEntity completed:', result)

      setTestResult(`✅ entityOperations.updateEntity successful!
- Record ID: ${testRecordId}  
- New title: ${testTitle}
- Function returned: ${JSON.stringify(result, null, 2)}`)

    } catch (error) {
      console.error('🧪 [LegendStateTest] entityOperations.updateEntity failed:', error)
      setTestResult(`❌ entityOperations.updateEntity failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Legend State Observable Test</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={testObservableAccess}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Observable Access'}
        </button>
        
        <button
          onClick={testUpdate}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Direct Update (entity$[id].field.set)'}
        </button>
        
        <button
          onClick={testEntityOperationsUpdate}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test entityOperations.updateEntity'}
        </button>
      </div>

      {testResult && (
        <div className="mt-6 p-4 border rounded">
          <h3 className="font-semibold mb-2">Test Result:</h3>
          <pre className="whitespace-pre-wrap text-sm">
            {testResult}
          </pre>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Debug Info:</h3>
        <p className="text-sm text-gray-600">
          Open browser dev tools to see detailed console logs from each test.
          This route tests the Legend State observable access patterns in isolation.
        </p>
      </div>
    </div>
  )
}