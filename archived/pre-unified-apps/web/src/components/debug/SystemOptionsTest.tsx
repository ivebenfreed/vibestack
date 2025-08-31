/**
 * System Options Test Component
 * Tests the centralized computed observable system for all reference options
 */

import React from 'react'
import { useReferenceOptions, useSystemOptions, useCustomOptions, useOptionsManagerState } from '@/legend-state/reference-system/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function SystemOptionsTest() {
  // Test the universal hook with different configurations
  const priorityTaskOptions = useReferenceOptions({
    referenceType: 'system',
    systemOptionType: 'priority',
    systemArchetype: 'task'
  })

  const statusProjectOptions = useReferenceOptions({
    referenceType: 'system',
    systemOptionType: 'status',
    systemArchetype: 'project'
  })

  const categoryRecordOptions = useReferenceOptions({
    referenceType: 'system',
    systemOptionType: 'category',
    systemArchetype: 'record'
  })

  // Test individual hooks
  const directPriorityOptions = useSystemOptions('priority', 'task')
  
  // Test global state
  const globalState = useOptionsManagerState()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">System Options Test</h1>
        <p className="text-muted-foreground">
          Testing the centralized computed observable system for all reference options
        </p>
      </div>

      {/* Global State Overview */}
      <Card>
        <CardHeader>
          <CardTitle>🌍 Global Options Manager State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-4">
            <Badge variant="outline">System Options: {globalState.systemOptionCount}</Badge>
            <Badge variant="outline">Custom Options: {globalState.customOptionCount}</Badge>
            <Badge variant={globalState.isAnyLoading ? "destructive" : "secondary"}>
              {globalState.isAnyLoading ? "Loading..." : "Ready"}
            </Badge>
          </div>
          {globalState.loading.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Loading: {globalState.loading.join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Priority Task Options */}
      <Card>
        <CardHeader>
          <CardTitle>🚨 Priority (Task) - Universal Hook</CardTitle>
        </CardHeader>
        <CardContent>
          {priorityTaskOptions.isLoading ? (
            <p>Loading priority options...</p>
          ) : priorityTaskOptions.error ? (
            <p className="text-red-500">Error: {priorityTaskOptions.error}</p>
          ) : (
            <div className="space-y-2">
              <p>Found {priorityTaskOptions.options.length} options:</p>
              <div className="grid gap-2">
                {priorityTaskOptions.options.map(option => (
                  <div key={option.value} className="flex items-center gap-2 p-2 border rounded">
                    {option.color && (
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: option.color }} 
                      />
                    )}
                    <span className="font-medium">{option.label}</span>
                    <Badge variant="outline">{option.value}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Project Options */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Status (Project) - Universal Hook</CardTitle>
        </CardHeader>
        <CardContent>
          {statusProjectOptions.isLoading ? (
            <p>Loading status options...</p>
          ) : statusProjectOptions.error ? (
            <p className="text-red-500">Error: {statusProjectOptions.error}</p>
          ) : (
            <div className="space-y-2">
              <p>Found {statusProjectOptions.options.length} options:</p>
              <div className="grid gap-2">
                {statusProjectOptions.options.map(option => (
                  <div key={option.value} className="flex items-center gap-2 p-2 border rounded">
                    {option.color && (
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: option.color }} 
                      />
                    )}
                    <span className="font-medium">{option.label}</span>
                    <Badge variant="outline">{option.value}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Record Options */}
      <Card>
        <CardHeader>
          <CardTitle>🏷️ Category (Record) - Universal Hook</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryRecordOptions.isLoading ? (
            <p>Loading category options...</p>
          ) : categoryRecordOptions.error ? (
            <p className="text-red-500">Error: {categoryRecordOptions.error}</p>
          ) : (
            <div className="space-y-2">
              <p>Found {categoryRecordOptions.options.length} options:</p>
              <div className="grid gap-2">
                {categoryRecordOptions.options.map(option => (
                  <div key={option.value} className="flex items-center gap-2 p-2 border rounded">
                    {option.color && (
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: option.color }} 
                      />
                    )}
                    <span className="font-medium">{option.label}</span>
                    <Badge variant="outline">{option.value}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direct System Hook Test */}
      <Card>
        <CardHeader>
          <CardTitle>🔗 Priority (Task) - Direct System Hook</CardTitle>
        </CardHeader>
        <CardContent>
          {directPriorityOptions.isLoading ? (
            <p>Loading direct priority options...</p>
          ) : directPriorityOptions.error ? (
            <p className="text-red-500">Error: {directPriorityOptions.error}</p>
          ) : (
            <div className="space-y-2">
              <p>Found {directPriorityOptions.options.length} options (should match above):</p>
              <div className="text-sm text-muted-foreground">
                Testing that both hooks return the same data
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution Test */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 Option Resolution Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">Test Value Resolution:</h4>
            <div className="space-y-2 mt-2">
              {['high', 'medium', 'low'].map(testValue => {
                const resolved = priorityTaskOptions.getOptionByValue(testValue)
                return (
                  <div key={testValue} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <code className="text-sm">{testValue}</code>
                    <span>→</span>
                    {resolved ? (
                      <div className="flex items-center gap-2">
                        {resolved.color && (
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: resolved.color }} 
                          />
                        )}
                        <span>{resolved.label}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not found</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}