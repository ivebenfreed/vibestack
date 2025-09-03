import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { VibeGrid } from '@/components/custom/vibegrid'
import { usePrecomputedEntityColumns } from '@/legend-state/hooks/use-precomputed-entity-columns'
import { entityOperations } from '@/legend-state'
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
  Layers,
  Table,
  MoreVertical,
  Info,
  Clock,
  Zap
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
  
  // Use precomputed column configuration hook
  const { columns, isLoading: columnsLoading, error: columnsError } = usePrecomputedEntityColumns(entityName)
  
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
  
  // Calculate last updated date
  const lastUpdated = safeData[0]?.updatedAt 
    ? new Date(safeData[0].updatedAt).toLocaleDateString() 
    : 'No data'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Ultra-Compact Header - Maximum Space for Table */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{displayName}</h1>
            <Badge variant="outline" className={`${archetypeConfig.color} text-xs`}>
              <Icon className="h-3 w-3 mr-1" />
              {archetypeConfig.label}
            </Badge>
          </div>
          
          {/* Ultra-Compact Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {String(count)}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-green-600" />
              Live
            </span>
            {safeOrgId && (
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs">
                {String(safeOrgId).slice(0, 6)}...
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button size="sm" className="h-7 px-2 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </DropdownMenuItem>
              {schema && (
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Info className="h-4 w-4 mr-2" />
                      Schema Info
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Entity Schema - {displayName}</DialogTitle>
                      <DialogDescription>
                        Field definitions and constraints for {displayName}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      {Object.entries(schema.fields || {}).map(([fieldName, fieldDef]: [string, any]) => {
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
                  </DialogContent>
                </Dialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Maximum Height Table - Every Pixel Counts */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {columnsLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Loading schema and generating columns...</p>
            </div>
          </div>
        ) : columnsError ? (
          <div className="flex items-center justify-center h-full text-red-600">
            <div className="text-center">
              <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-semibold">Schema Error</p>
              <p className="text-sm">{columnsError}</p>
            </div>
          </div>
        ) : columns.length > 0 ? (
          <VibeGrid
            entityType={orgId && orgId !== 'universe' ? `${orgId}_${entityName}` : entityName}
            columns={columns}
            tableId={`${entityName}-entity-table`}
            className="h-full"
            height="100%"
            onEntityUpdate={async (rowId: string, updates: Record<string, any>) => {
              const fullEntityName = orgId && orgId !== 'universe' ? `${orgId}_${entityName}` : entityName;
              console.log('🔄 UniversalEntityPage: Entity update requested', { entityName, fullEntityName, rowId, updates });
              try {
                await entityOperations.updateEntity(fullEntityName, rowId, updates);
                console.log('✅ UniversalEntityPage: Entity updated successfully', { entityName, fullEntityName, rowId, updates });
              } catch (error) {
                console.error('❌ UniversalEntityPage: Entity update failed', { entityName, fullEntityName, rowId, updates, error });
                throw error;
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No columns available for {entityName}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}