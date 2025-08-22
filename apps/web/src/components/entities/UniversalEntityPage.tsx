import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  Settings, 
  BarChart3,
  FolderOpen,
  CheckSquare,
  Database,
  FileText,
  File,
  Activity,
  MessageCircle,
  Layers
} from 'lucide-react'

// DataForge archetype configuration
const ARCHETYPE_CONFIG = {
  project: { icon: FolderOpen, color: 'bg-blue-500/10 text-blue-600 border-blue-600/20', label: 'Project' },
  task: { icon: CheckSquare, color: 'bg-green-500/10 text-green-600 border-green-600/20', label: 'Task' },
  record: { icon: Database, color: 'bg-purple-500/10 text-purple-600 border-purple-600/20', label: 'Record' },
  document: { icon: FileText, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-600/20', label: 'Document' },
  file: { icon: File, color: 'bg-orange-500/10 text-orange-600 border-orange-600/20', label: 'File' },
  activity: { icon: Activity, color: 'bg-red-500/10 text-red-600 border-red-600/20', label: 'Activity' },
  discussion: { icon: MessageCircle, color: 'bg-pink-500/10 text-pink-600 border-pink-600/20', label: 'Discussion' },
  collection: { icon: Layers, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-600/20', label: 'Collection' },
}

interface UniversalEntityPageProps {
  entityName: string
  data?: any[]
  schema?: any
  orgId?: string
  archetype?: string
}

export function UniversalEntityPage({ 
  entityName, 
  data = [], 
  schema,
  orgId,
  archetype: propArchetype 
}: UniversalEntityPageProps) {
  const displayName = entityName.charAt(0).toUpperCase() + entityName.slice(1)
  
  // Get archetype from props, schema, or default to 'record'
  const archetype = propArchetype || schema?.archetype || 'record'
  const archetypeConfig = ARCHETYPE_CONFIG[archetype.toLowerCase() as keyof typeof ARCHETYPE_CONFIG] || ARCHETYPE_CONFIG.record
  const Icon = archetypeConfig.icon
  
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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
            <Badge variant="outline" className={archetypeConfig.color}>
              <Icon className="h-3 w-3 mr-1" />
              {archetypeConfig.label}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {String(count)} records
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