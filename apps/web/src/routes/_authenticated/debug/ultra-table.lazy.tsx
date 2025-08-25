import { createLazyFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { UltraTable } from '@/components/tables/UltraTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const UltraTableDebug = observer(function UltraTableDebug() {
  const [testMode, setTestMode] = useState<'legend-state' | 'external-data'>('legend-state')
  
  // Test data for external mode
  const testData = Array.from({ length: 100 }, (_, i) => ({
    id: `test-${i}`,
    name: `Test Item ${i + 1}`,
    amount: Math.floor(Math.random() * 10000),
    status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'completed',
    createdAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
    description: `This is a test description for item ${i + 1}. It contains some sample text to test rendering.`
  }))

  return (
    <div className="container mx-auto py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">UltraTable 10K Performance Test</h1>
        <div className="flex gap-2">
          <Button 
            variant={testMode === 'legend-state' ? 'default' : 'outline'}
            onClick={() => setTestMode('legend-state')}
            size="sm"
          >
            UltraTable
          </Button>
          <Button 
            variant={testMode === 'external-data' ? 'default' : 'outline'}
            onClick={() => setTestMode('external-data')}
            size="sm"
          >
            Test Data (100 rows)
          </Button>
        </div>
      </div>

      {testMode === 'legend-state' && (
        <UltraTable
          entityName="Client"
          height={800}
          options={{
            enableSelection: true,
            multiSelect: true,
            overscan: 5
          }}
          enableEditing={true}
          showHeader={true}
          cellRenderers={{
            created_at: (value) => value ? new Date(value).toLocaleDateString() : '—',
            updated_at: (value) => value ? new Date(value).toLocaleDateString() : '—'
          }}
        />
      )}


      {testMode === 'external-data' && (
        <UltraTable
          entityName="Client"
          data={testData}
          height={800}
          options={{
            enableSelection: true,
            multiSelect: true,
            overscan: 10
          }}
          enableEditing={true}
          showHeader={true}
          cellRenderers={{
            amount: (value) => `$${value.toLocaleString()}`,
            createdAt: (value) => new Date(value).toLocaleDateString()
          }}
        />
      )}
    </div>
  )
})

export const Route = createLazyFileRoute('/_authenticated/debug/ultra-table')({
  component: UltraTableDebug,
})