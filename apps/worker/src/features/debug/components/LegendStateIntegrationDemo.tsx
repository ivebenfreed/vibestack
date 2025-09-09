/**
 * VibeGrid with Legend State Integration
 * Universal entity display with dynamic entity selection
 */

import React, { useState, useEffect } from 'react'
import { VibeGrid } from '@/components/custom/vibegrid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePrecomputedEntityColumns } from '@/legend-state/hooks/use-precomputed-entity-columns'
import { entityOperations, getEntity$, getUniverseEntity$, universeContext$, universeSchema$, universeOrgId$ } from '@/legend-state'
import { debugLog } from '@/logger'
import { observer } from '@legendapp/state/react'

// Create logger instance for this file
const log = debugLog('features/debug/components/LegendStateIntegrationDemo.tsx');

export const LegendStateIntegrationDemo = observer(() => {
  const [selectedEntity, setSelectedEntity] = useState('')
  const [entityData, setEntityData] = useState<Record<string, any>>({})
  const [dataLoading, setDataLoading] = useState(false)
  
  // Get universe context and current schema
  const universeContext = universeContext$.get()
  const currentSchema = universeSchema$.get()
  const currentOrgId = universeOrgId$.get()
  
  // Extract available entities from all organizations in universe
  const availableEntities = React.useMemo(() => {
    const entities: Array<{value: string, label: string, orgName: string, recordCount: number}> = []
    
    // Add entities from current schema if available
    if (currentSchema?.entities) {
      Object.entries(currentSchema.entities).forEach(([entityKey, entitySchema]: [string, any]) => {
        if (entityKey.includes('_') && entitySchema._orgName) {
          // This is an org-prefixed entity from universe
          entities.push({
            value: entityKey,
            label: `${entitySchema._originalEntityName || entityKey.split('_')[1]} (${entitySchema._orgName})`,
            orgName: entitySchema._orgName,
            recordCount: 0 // We'll update this when we load data
          })
        } else if (entityKey.includes('_') && entitySchema._isVirtual) {
          // **NEW: Virtual entities (SystemOption, CustomOption, VirtualUser, etc.)**
          const orgName = entitySchema._orgName || 'Virtual Entity'
          const displayName = entitySchema._originalName || entityKey.split('_').slice(1).join('_')
          entities.push({
            value: entityKey,
            label: `🔹 ${displayName} (${orgName})`,  // 🔹 indicates virtual entity
            orgName: orgName,
            recordCount: 0
          })
        } else if (!entityKey.includes('_')) {
          // Regular entity (when not in universe mode)
          entities.push({
            value: entityKey,
            label: `${entityKey} (Current Org)`,
            orgName: 'Current Organization',
            recordCount: 0
          })
        }
      })
    }
    
    return entities
  }, [universeContext, currentSchema])
  
  // Set default selected entity if none selected
  React.useEffect(() => {
    if (!selectedEntity && availableEntities.length > 0) {
      // Look for Client entities first, or take the first available
      const clientEntity = availableEntities.find(e => e.value.includes('Client'))
      setSelectedEntity(clientEntity?.value || availableEntities[0].value)
    }
  }, [availableEntities, selectedEntity])
  
  // Get columns based on the base entity name (strip org prefix if present)
  const baseEntityName = selectedEntity.includes('_') ? selectedEntity.split('_')[1] : selectedEntity
  const { columns, isLoading, error } = usePrecomputedEntityColumns(baseEntityName)
  
  log.info('Component state:', { 
    selectedEntity,
    baseEntityName,
    availableEntitiesCount: availableEntities.length,
    columns: columns.length,
    isLoading, 
    error,
    universeOrganizations: Object.keys(universeContext?.organizations || {}).length,
    currentOrgId: currentOrgId,
    dataLoading,
    entityDataCount: Object.keys(entityData).length
  })
  
  // Load entity data when entity changes
  useEffect(() => {
    if (!selectedEntity) return
    
    const loadEntityData = async () => {
      setDataLoading(true)
      try {
        // Use universe-aware entity access
        const entityObs = getUniverseEntity$(selectedEntity)
        
        if (entityObs) {
          const data = entityObs.get()
          setEntityData(data || {})
          log.info(`Loaded ${selectedEntity} data:`, { 
            recordCount: Object.keys(data || {}).length,
            sampleRecord: Object.values(data || {})[0],
            entityObservableType: typeof entityObs,
            hasGetMethod: typeof entityObs.get === 'function'
          })
        } else {
          log.warn(`Entity ${selectedEntity} not available via getUniverseEntity$`)
          setEntityData({})
        }
      } catch (err) {
        log.error('Failed to load entity data:', err)
        setEntityData({})
      } finally {
        setDataLoading(false)
      }
    }

    loadEntityData()
  }, [selectedEntity])

  // Create sample data for testing if no data exists
  const createSampleData = async () => {
    try {
      const sampleId = `sample-${Date.now()}`
      let sampleData: Record<string, any>
      const entityNameForCreation = selectedEntity.includes('_') ? selectedEntity.split('_')[1] : selectedEntity
      
      switch (entityNameForCreation) {
        case 'Client':
          sampleData = {
            id: sampleId,
            name: `Sample Client ${Date.now()}`,
            email: 'sample@example.com',
            company_name: 'Sample Corp',
            contact_person: 'John Doe',
            phone: '+1-555-0123',
            industry: 'Technology',
            status: 'active',
            priority: 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          break
        case 'Task':
          sampleData = {
            id: sampleId,
            title: `Sample Task ${Date.now()}`,
            description: 'A sample task for testing',
            priority_option: 'medium',
            status_option: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          break
        case 'Project':
          sampleData = {
            id: sampleId,
            title: `Sample Project ${Date.now()}`,
            description: 'A sample project for testing',
            priority_option: 'medium',
            status_option: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          break
        default:
          sampleData = {
            id: sampleId,
            name: `Sample ${entityNameForCreation} ${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
      }
      
      // Use the base entity name for creation, not the org-prefixed name
      await entityOperations.createEntity(entityNameForCreation, sampleData)
      log.info(`Created sample ${entityNameForCreation} (from ${selectedEntity}):`, sampleData)
    } catch (err) {
      log.error('Failed to create sample data:', err)
    }
  }

  const recordCount = Object.keys(entityData).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">VibeGrid + Legend State Integration</h1>
        <div className="flex gap-2">
          <Badge variant="outline">Full Table</Badge>
          <Badge variant="secondary">Inline Editing</Badge>
          <Badge variant="default">Legend State</Badge>
        </div>
      </div>

      {/* Entity Selection & Controls */}
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Entity:</span>
          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select an entity..." />
            </SelectTrigger>
            <SelectContent>
              {availableEntities.map((entity) => (
                <SelectItem key={entity.value} value={entity.value}>
                  <div className="flex flex-col">
                    <span>{entity.label}</span>
                    {entity.orgName && (
                      <span className="text-xs text-muted-foreground">
                        {entity.orgName}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {recordCount} records
          </Badge>
          <Badge variant="outline" className="text-xs">
            {columns.length} columns
          </Badge>
          {currentOrgId && (
            <Badge variant="outline" className="text-xs">
              {currentOrgId === 'universe' ? 'Universe View' : `Org: ${currentOrgId.slice(0, 8)}...`}
            </Badge>
          )}
        </div>
        
        <Button 
          onClick={createSampleData} 
          size="sm" 
          variant="outline"
          disabled={dataLoading}
        >
          Add Sample Data
        </Button>
      </div>

      <div className="h-[600px] border rounded-lg">
        {isLoading || dataLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-lg font-semibold">
                {isLoading ? 'Loading schema...' : 'Loading data...'}
              </div>
              <div className="text-sm text-muted-foreground">
                {isLoading ? 'Generating dynamic columns' : `Fetching ${selectedEntity} records`}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-600">
              <div className="text-lg font-semibold">Schema Error</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        ) : columns.length > 0 ? (
          <VibeGrid
            entityType={selectedEntity}
            columns={columns}
            tableId={`debug-${selectedEntity.toLowerCase()}-table`}
            className="h-full"
            onEntityUpdate={async (rowId: string, updates: Record<string, any>) => {
              log.info('Entity update requested:', { entityType: selectedEntity, rowId, updates });
              try {
                await entityOperations.updateEntity(selectedEntity, rowId, updates);
                log.info('Entity updated successfully:', { entityType: selectedEntity, rowId, updates });
              } catch (error) {
                log.error('Entity update failed:', { entityType: selectedEntity, rowId, updates, error });
                throw error;
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <div className="text-lg font-semibold">No Columns</div>
              <div className="text-sm">No schema fields found for {selectedEntity} entity</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})