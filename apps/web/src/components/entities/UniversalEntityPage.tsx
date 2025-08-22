import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Settings, BarChart3 } from 'lucide-react'

interface UniversalEntityPageProps {
  entityName: string
  data?: any[]
  schema?: any
  orgId?: string
}

export function UniversalEntityPage({ 
  entityName, 
  data = [], 
  schema,
  orgId 
}: UniversalEntityPageProps) {
  const displayName = entityName.charAt(0).toUpperCase() + entityName.slice(1)
  
  // Debug schema structure to understand the format
  console.log('[UniversalEntityPage] Schema structure:', {
    schema,
    schemaKeys: schema ? Object.keys(schema) : null,
    archetype: schema?.archetype,
    archetypeType: typeof schema?.archetype,
    archetypeStringified: schema?.archetype ? JSON.stringify(schema.archetype) : null
  })
  
  // Handle archetype more robustly - extract string value from archetype object
  let archetype = 'unknown'
  if (schema && schema.archetype) {
    if (typeof schema.archetype === 'string') {
      archetype = schema.archetype
    } else if (typeof schema.archetype === 'object' && schema.archetype !== null) {
      // Common archetype object patterns
      if (schema.archetype.value) {
        archetype = String(schema.archetype.value)
      } else if (schema.archetype.type) {
        archetype = String(schema.archetype.type)
      } else if (schema.archetype.name) {
        archetype = String(schema.archetype.name)
      } else if (schema.archetype.category) {
        archetype = String(schema.archetype.category)
      } else {
        // Fallback: use the first non-null property value or 'business_entity'
        const values = Object.values(schema.archetype).filter(v => v != null)
        archetype = values.length > 0 ? String(values[0]) : 'business_entity'
      }
    } else {
      archetype = String(schema.archetype)
    }
  }
  
  // Handle both plain arrays and Legend State observables
  const safeData = (() => {
    if (Array.isArray(data)) {
      return data
    }
    // If data is a Legend State observable (Proxy), it should already be the array value
    // from useObservable, but let's be extra safe
    if (data && typeof data === 'object' && data.length !== undefined) {
      return Array.from(data)
    }
    return []
  })()
  const count = safeData.length
  
  console.log('[UniversalEntityPage] Debug:', {
    entityName,
    data,
    dataType: typeof data,
    isArray: Array.isArray(data),
    safeData,
    count,
    schema,
    archetype,
    orgId,
    orgIdType: typeof orgId
  })
  
  // Safety check for orgId
  const safeOrgId = typeof orgId === 'string' ? orgId : String(orgId || '')
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
          <p className="text-muted-foreground">
            {String(archetype)} entity • {String(count)} records
            {safeOrgId && <span className="ml-2">• Org: {String(safeOrgId).slice(0, 8)}...</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add {displayName}
          </Button>
        </div>
      </div>

      {/* Entity Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{count}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entity Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant="secondary">{archetype}</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {safeData[0]?.updatedAt ? new Date(safeData[0].updatedAt).toLocaleDateString() : 'No data'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-green-600">
              Live Sync Active
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Schema Information */}
      {schema && (
        <Card>
          <CardHeader>
            <CardTitle>Entity Schema</CardTitle>
            <CardDescription>
              Field definitions and constraints for {displayName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(schema.fields || {}).map(([fieldName, fieldDef]: [string, any]) => {
                // Ensure fieldDef is safely handled
                const safeFieldDef = fieldDef && typeof fieldDef === 'object' ? fieldDef : {}
                const fieldType = String(safeFieldDef.type || 'unknown')
                const fieldDescription = String(safeFieldDef.description || 'No description')
                const isRequired = Boolean(safeFieldDef.required)
                
                return (
                  <div key={fieldName} className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {fieldName}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {fieldType}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isRequired && <Badge variant="secondary" className="text-xs mr-2">Required</Badge>}
                      {fieldDescription}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <CardDescription>
            Latest {Math.min(5, count)} records from {displayName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {safeData && safeData.length > 0 ? (
            <div className="space-y-4">
              {safeData.slice(0, 5).map((record, index) => {
                // Ensure record is safely handled
                const safeRecord = record && typeof record === 'object' ? record : {}
                const recordId = String(safeRecord.id || `Record ${index + 1}`)
                const recordUpdatedAt = safeRecord.updatedAt ? new Date(safeRecord.updatedAt).toLocaleString() : null
                
                return (
                  <div key={recordId} className="border rounded p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{recordId}</Badge>
                      {recordUpdatedAt && (
                        <span className="text-xs text-muted-foreground">
                          {recordUpdatedAt}
                        </span>
                      )}
                    </div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(safeRecord, null, 2)}
                    </pre>
                  </div>
                )
              })}
              
              {safeData.length > 5 && (
                <div className="text-center py-4">
                  <Button variant="outline">
                    View All {count} Records
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No {displayName.toLowerCase()} records found.
              <div className="mt-4">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First {displayName}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}