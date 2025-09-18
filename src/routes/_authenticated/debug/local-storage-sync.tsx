import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { observable } from '@legendapp/state'
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage'
import { configureSynced, syncObservable } from '@legendapp/state/sync'
import { observer } from '@legendapp/state/react'
import { createVibeGridPreferences, inspectVibeGridPersistence } from '@/components/custom/vibegrid/stores/simple-persistence'

// Configure global persistence plugin using configureSynced
// This provides the base configuration for all persistence operations
const persistOptions = configureSynced({
  persist: {
    plugin: ObservablePersistLocalStorage
  }
})

// Simple test data interface
interface TestData {
  message: string
  counter: number
  timestamp: number
}

// Method 1: Using syncObservable with persistOptions
const testStore1$ = observable<TestData>({
  message: 'Hello from Method 1',
  counter: 0,
  timestamp: Date.now()
})

// Apply persistence using configureSynced options
syncObservable(testStore1$, persistOptions({
  persist: {
    name: 'vibestack-test-store-1'
  }
}))

// Method 2: Create observable then sync with syncObservable
const testStore2$ = observable<TestData>({
  message: 'Hello from Method 2',
  counter: 0,
  timestamp: Date.now()
})

// Method 3: Observable with more complex structure using syncObservable
const complexStore$ = observable({
  user: {
    name: 'Test User',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  },
  settings: {
    autoSave: true,
    debugMode: false
  },
  history: [] as string[]
})

// Apply persistence using configureSynced options
syncObservable(complexStore$, persistOptions({
  persist: {
    name: 'vibestack-complex-store'
  }
}))

// Initialize persistence for Method 2 (syncObservable approach)
let isInitialized = false

function initializePersistence() {
  if (isInitialized) return

  try {
    // Apply sync to method 2 observable (which doesn't use synced())
    // Methods 1 and 3 get persistence automatically from global config
    syncObservable(testStore2$, {
      persist: {
        name: 'vibestack-test-store-2',
        plugin: ObservablePersistLocalStorage
      }
    })

    console.log('✅ Local storage persistence initialized successfully')
    console.log('📝 Method 1 & 3: Auto-configured via global configureSynced()')
    console.log('📝 Method 2: Configured via explicit syncObservable()')
    isInitialized = true
  } catch (error) {
    console.error('❌ Failed to initialize local storage persistence:', error)
  }
}

const LocalStorageSyncDebugPageComponent = observer(() => {
  const [isReady, setIsReady] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    // Initialize persistence on component mount
    initializePersistence()
    setIsReady(true)
  }, [])

  const updateStore1 = () => {
    const currentCounter = testStore1$.counter.get()
    testStore1$.assign({
      message: `Updated at ${new Date().toLocaleTimeString()}`,
      counter: currentCounter + 1,
      timestamp: Date.now()
    })
  }

  const updateStore2 = () => {
    const currentCounter = testStore2$.counter.get()
    testStore2$.assign({
      message: `Method 2 updated at ${new Date().toLocaleTimeString()}`,
      counter: currentCounter + 1,
      timestamp: Date.now()
    })
  }

  const updateComplexStore = () => {
    const currentHistory = complexStore$.history.get()
    complexStore$.assign({
      user: {
        name: `User ${Date.now()}`,
        preferences: {
          theme: complexStore$.user.preferences.theme.get() === 'dark' ? 'light' : 'dark',
          notifications: !complexStore$.user.preferences.notifications.get()
        }
      },
      settings: {
        autoSave: !complexStore$.settings.autoSave.get(),
        debugMode: !complexStore$.settings.debugMode.get()
      },
      history: [...currentHistory, `Action at ${new Date().toLocaleTimeString()}`]
    })
  }

  const clearAllStores = () => {
    // Reset to initial values
    testStore1$.assign({
      message: 'Cleared Method 1',
      counter: 0,
      timestamp: Date.now()
    })

    testStore2$.assign({
      message: 'Cleared Method 2',
      counter: 0,
      timestamp: Date.now()
    })

    complexStore$.assign({
      user: {
        name: 'Reset User',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      },
      settings: {
        autoSave: true,
        debugMode: false
      },
      history: ['Reset at ' + new Date().toLocaleTimeString()]
    })
  }

  const inspectLocalStorage = () => {
    const keys = Object.keys(localStorage).filter(key => key.includes('vibestack'))
    const storage = keys.reduce((acc, key) => {
      try {
        acc[key] = JSON.parse(localStorage.getItem(key) || 'null')
      } catch {
        acc[key] = localStorage.getItem(key)
      }
      return acc
    }, {} as Record<string, any>)

    setDebugInfo(JSON.stringify(storage, null, 2))
  }

  const clearLocalStorage = () => {
    const keys = Object.keys(localStorage).filter(key => key.includes('vibestack') || key.includes('vibegrid'))
    keys.forEach(key => localStorage.removeItem(key))
    setDebugInfo('Local storage cleared')

    // Trigger a page refresh to reload from empty storage
    setTimeout(() => window.location.reload(), 1000)
  }

  // VibeGrid Simple Persistence Test
  const [vibeGridTest, setVibeGridTest] = useState<any>(null)

  useEffect(() => {
    // Create a test instance of the simple VibeGrid persistence
    const testColumns = [
      { id: 'title', width: 200 },
      { id: 'status', width: 120 },
      { id: 'priority', width: 100 },
      { id: 'assignee', width: 150 }
    ]

    const { preferences$, operations } = createVibeGridPreferences('test-tasks')
    operations.initializeColumns(testColumns)

    setVibeGridTest({ preferences$, operations, testColumns })
  }, [])

  const testVibeGridColumnResize = () => {
    if (!vibeGridTest) return

    const { operations } = vibeGridTest
    const newWidth = 250 + Math.floor(Math.random() * 100)
    operations.setColumnWidth('title', newWidth)
  }

  const testVibeGridSort = () => {
    if (!vibeGridTest) return

    const { operations } = vibeGridTest
    const fields = ['title', 'status', 'priority', 'assignee']
    const randomField = fields[Math.floor(Math.random() * fields.length)]
    const direction = Math.random() > 0.5 ? 'asc' : 'desc'

    operations.setSortBy([{ field: randomField, direction }])
  }

  const testVibeGridFilter = () => {
    if (!vibeGridTest) return

    const { operations } = vibeGridTest
    const filters = [
      { field: 'status', operator: 'equals', value: 'In Progress' },
      { field: 'priority', operator: 'equals', value: 'High' }
    ]
    operations.setFilters(filters)
  }

  const resetVibeGridTest = () => {
    if (!vibeGridTest) return

    const { operations, testColumns } = vibeGridTest
    operations.reset(testColumns)
  }

  const inspectVibeGridPersistence = () => {
    const inspection = inspectVibeGridPersistence('test-tasks')
    setDebugInfo(JSON.stringify(inspection, null, 2))
  }

  if (!isReady) {
    return <div className="p-6">Initializing local storage persistence...</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Legend State Local Storage Sync Debug</h1>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h2 className="text-lg font-semibold mb-2">Instructions</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click the update buttons to modify the observables</li>
          <li>Refresh the page to verify data persists</li>
          <li>Use "Inspect Local Storage" to see the stored data</li>
          <li>Use "Clear Storage" to reset and test fresh loading</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Method 1: Shared persistence config */}
        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-3">Method 1: Shared Config</h3>
          <div className="space-y-2 text-sm mb-4">
            <div><strong>Message:</strong> {testStore1$.message.get()}</div>
            <div><strong>Counter:</strong> {testStore1$.counter.get()}</div>
            <div><strong>Timestamp:</strong> {new Date(testStore1$.timestamp.get()).toLocaleString()}</div>
          </div>
          <button
            onClick={updateStore1}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Update Store 1
          </button>
        </div>

        {/* Method 2: Explicit plugin */}
        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-3">Method 2: Explicit Plugin</h3>
          <div className="space-y-2 text-sm mb-4">
            <div><strong>Message:</strong> {testStore2$.message.get()}</div>
            <div><strong>Counter:</strong> {testStore2$.counter.get()}</div>
            <div><strong>Timestamp:</strong> {new Date(testStore2$.timestamp.get()).toLocaleString()}</div>
          </div>
          <button
            onClick={updateStore2}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Update Store 2
          </button>
        </div>

        {/* Method 3: Complex nested structure */}
        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-3">Method 3: Nested Structure</h3>
          <div className="space-y-2 text-sm mb-4">
            <div><strong>User:</strong> {complexStore$.user.name.get()}</div>
            <div><strong>Theme:</strong> {complexStore$.user.preferences.theme.get()}</div>
            <div><strong>Notifications:</strong> {complexStore$.user.preferences.notifications.get() ? 'On' : 'Off'}</div>
            <div><strong>Auto Save:</strong> {complexStore$.settings.autoSave.get() ? 'On' : 'Off'}</div>
            <div><strong>History:</strong> {complexStore$.history.get().length} items</div>
          </div>
          <button
            onClick={updateComplexStore}
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Update Complex
          </button>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={clearAllStores}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Clear All Stores
        </button>
        <button
          onClick={inspectLocalStorage}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Inspect Local Storage
        </button>
        <button
          onClick={clearLocalStorage}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Clear Storage & Reload
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Refresh Page
        </button>
      </div>

      {/* Debug output */}
      {debugInfo && (
        <div className="p-4 bg-gray-100 border rounded">
          <h3 className="font-semibold mb-2">Local Storage Debug Info:</h3>
          <pre className="text-xs overflow-auto whitespace-pre-wrap">
            {debugInfo}
          </pre>
        </div>
      )}

      {/* Technical details */}
      <div className="mt-6 p-4 bg-gray-50 border rounded">
        <h3 className="font-semibold mb-2">Implementation Details:</h3>
        <p className="text-sm mb-3 text-gray-600"><strong>All methods use <code>syncObservable()</code></strong> - this is the single persistence approach for Legend State</p>
        <ul className="text-sm space-y-1">
          <li><strong>Shared Config:</strong> Uses <code>persistOptions()</code> created by <code>configureSynced()</code></li>
          <li><strong>Explicit Plugin:</strong> Specifies <code>ObservablePersistLocalStorage</code> directly in options</li>
          <li><strong>Nested Structure:</strong> Demonstrates persistence of complex objects with deep properties</li>
          <li><strong>Configuration:</strong> <code>configureSynced()</code> creates reusable persistence options</li>
          <li><strong>Storage:</strong> Data persisted to browser localStorage with unique keys</li>
        </ul>
      </div>
    </div>
  )
})

// Export the route definition at the end after component is defined
export const Route = createFileRoute('/_authenticated/debug/local-storage-sync')({
  component: LocalStorageSyncDebugPageComponent
})

export default LocalStorageSyncDebugPageComponent

