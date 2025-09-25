import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { VibeGrid } from '@/components/custom/vibegrid'
import { createEntityColumnsObservable } from '@/legend-state/observables/table-columns'
import { entityOperations } from '@/legend-state'
import { EntityNameUtils } from '@/lib/entity-name-utils'
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
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  
  // Extract clean display name from entity name using centralized utility
  const displayName = EntityNameUtils.toDisplayFormat(entityName);
  
  // Get archetype from props, schema, or default to 'record'
  const archetype = propArchetype || schema?.archetype || 'record'
  const archetypeConfig = ARCHETYPE_CONFIG[archetype.toLowerCase() as keyof typeof ARCHETYPE_CONFIG] || ARCHETYPE_CONFIG.record
  const Icon = archetypeConfig.icon
  
  // Get columns from dynamic schema-driven generation - same pattern as debug pages
  // Get columns from dynamic schema-driven generation - same pattern as debug pages
  // Add safety check to prevent "Cannot read properties of undefined (reading 'get')" error
  const columnsObservable = createEntityColumnsObservable(entityName);
  const columns = columnsObservable ? columnsObservable.get() : [];

  // Event handlers - same pattern as debug pages
  const handleSelectionChange = (cells: Set<string>) => {
    setSelectedCells(cells);
  };

  const handleEditingChange = (cell: { rowId: string; columnId: string } | null) => {
    setEditingCell(cell);
  };

  const handleEntityUpdate = async (rowId: string, updates: Record<string, any>) => {
    const fullEntityName = EntityNameUtils.ensureOrgPrefix(entityName, orgId || '');
    await entityOperations.updateEntity(fullEntityName, rowId, updates);
  };

  const handleBatchEntityUpdate = async (updates: Array<{ id: string; updates: Record<string, any> }>) => {
    const fullEntityName = EntityNameUtils.ensureOrgPrefix(entityName, orgId || '');
    for (const update of updates) {
      await entityOperations.updateEntity(fullEntityName, update.id, update.updates);
    }
  };
  
  // ✅ SIMPLIFIED: Don't try to handle data here - let VibeGrid atomic bridge do it
  // Just show a placeholder count, the real count will come from VibeGrid
  const count = data ? (Array.isArray(data) ? data.length : 0) : '...'
  
  // Get fields from either direct fields or businessMetadata.fields
  const schemaFields = schema?.fields || schema?.businessMetadata?.fields
  
  console.log('[UniversalEntityPage] Debug:', {
    entityName,
    data,
    dataType: typeof data,
    isArray: Array.isArray(data),
    count,
    schema,
    schemaType: typeof schema,
    schemaFields: schemaFields,
    schemaFieldNames: schemaFields ? Object.keys(schemaFields) : null,
    schemaHasFields: !!schemaFields,
    schemaKeys: schema ? Object.keys(schema) : null,
    businessMetadata: schema?.businessMetadata ? Object.keys(schema.businessMetadata) : null,
    archetype,
    orgId,
    orgIdType: typeof orgId
  })
  
  // Safety check for orgId
  const safeOrgId = typeof orgId === 'string' ? orgId : String(orgId || '')
  
  // Calculate last updated date - simplified
  const lastUpdated = 'Live'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Ultra-Compact Header - Maximum Space for Table */}
      <div className="flex items-center justify-between px-3 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
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
          <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New {displayName}</DialogTitle>
                <DialogDescription>
                  Create a new {displayName.toLowerCase()} record
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={async (e) => {
                e.preventDefault()
                setIsSubmitting(true)
                
                try {
                  // Schema-aware validation - find the primary field for this entity
                  const primaryField = schemaFields ? 
                    Object.keys(schemaFields).find(field => 
                      ['name', 'title', 'subject', 'summary'].includes(field.toLowerCase())
                    ) : 'name'
                  
                  // Check if primary field is provided and not empty
                  if (primaryField && (!formData[primaryField] || !formData[primaryField].trim())) {
                    alert(`${primaryField.replace(/_/g, ' ')} is required`)
                    return
                  }
                  
                  // Email validation if provided
                  if (formData.email && formData.email.trim() && !formData.email.includes('@')) {
                    alert('Please enter a valid email address')
                    return
                  }
                  
                  // Prepare the data with required timestamps and system fields
                  const now = new Date().toISOString()
                  const baseData = {
                    ...formData,
                    id: crypto.randomUUID(),
                    created_at: now,
                    updated_at: now,
                    organization_id: orgId
                  }
                  
                  // Only add fields that exist in the schema to avoid database errors
                  const recordData = { ...baseData }
                  
                  // Add record_type only if it exists in schema (typically for record archetype)
                  const hasRecordType = schemaFields && Object.keys(schemaFields).some(field => field === 'record_type')
                  console.log('[UniversalEntityPage] Schema check for record_type:', { 
                    hasSchema: !!schema, 
                    hasFields: !!schema?.fields,
                    fieldNames: schema?.fields ? Object.keys(schema.fields) : null,
                    hasRecordType,
                    entityName
                  })
                  if (hasRecordType) {
                    recordData.record_type = entityName.toLowerCase()
                    console.log('[UniversalEntityPage] Added record_type:', recordData.record_type)
                  }
                  
                  // Add status with default if not provided and field exists in schema
                  if (schema?.fields && Object.keys(schema.fields).some(field => field === 'status')) {
                    recordData.status = formData.status || 'draft'
                  }
                  
                  // Add priority with default if not provided and field exists in schema
                  if (schema?.fields && Object.keys(schema.fields).some(field => field === 'priority')) {
                    recordData.priority = formData.priority || 'medium'
                  }
                  
                  // Use EntityNameUtils to ensure proper prefixing without duplication
                  const fullEntityName = EntityNameUtils.ensureOrgPrefix(entityName, orgId || '')
                  
                  console.log('🚀 Creating entity:', { entityName, fullEntityName, recordData })
                  
                  // Create the entity using entityOperations
                  await entityOperations.createEntity(fullEntityName, recordData)
                  
                  // Reset form and close modal
                  setFormData({})
                  setAddModalOpen(false)
                  
                  console.log('✅ Entity created successfully')
                } catch (error) {
                  console.error('❌ Error creating entity:', error)
                  alert(`Error creating ${entityName}: ${error.message || 'Unknown error'}`)
                } finally {
                  setIsSubmitting(false)
                }
              }} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {/* Use schema fields if available, otherwise provide fallback fields based on visible columns */}
                  {schemaFields ? (
                    Object.entries(schemaFields).map(([fieldName, fieldDef]: [string, any]) => {
                      const safeFieldDef = fieldDef && typeof fieldDef === 'object' ? fieldDef : {}
                      const fieldType = String(safeFieldDef.type || 'text')
                      const fieldDescription = String(safeFieldDef.description || '')
                      const isRequired = Boolean(safeFieldDef.required)
                      
                      // Skip system fields that are auto-generated
                      if (['id', 'created_at', 'updated_at'].includes(fieldName)) {
                        return null
                      }
                      
                      return (
                        <div key={fieldName} className="space-y-2">
                          <Label htmlFor={fieldName} className="text-sm font-medium">
                            {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          
                          {fieldType === 'text' || fieldType === 'varchar' ? (
                            fieldDescription.toLowerCase().includes('long') || fieldDescription.toLowerCase().includes('description') || fieldName.toLowerCase().includes('notes') ? (
                              <Textarea
                                id={fieldName}
                                placeholder={fieldDescription || `Enter ${fieldName}`}
                                value={formData[fieldName] || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, [fieldName]: e.target.value }))}
                                required={isRequired}
                                className="min-h-[80px]"
                              />
                            ) : (
                              <Input
                                id={fieldName}
                                type="text"
                                placeholder={fieldDescription || `Enter ${fieldName}`}
                                value={formData[fieldName] || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, [fieldName]: e.target.value }))}
                                required={isRequired}
                              />
                            )
                          ) : fieldType === 'integer' || fieldType === 'number' ? (
                            <Input
                              id={fieldName}
                              type="number"
                              placeholder={fieldDescription || `Enter ${fieldName}`}
                              value={formData[fieldName] || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, [fieldName]: e.target.value ? Number(e.target.value) : '' }))}
                              required={isRequired}
                            />
                          ) : fieldType === 'boolean' ? (
                            <div className="flex items-center space-x-2">
                              <input
                                id={fieldName}
                                type="checkbox"
                                checked={formData[fieldName] || false}
                                onChange={(e) => setFormData(prev => ({ ...prev, [fieldName]: e.target.checked }))}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor={fieldName} className="text-sm text-muted-foreground">
                                {fieldDescription || `Enable ${fieldName}`}
                              </Label>
                            </div>
                          ) : fieldType === 'email' || fieldName.toLowerCase().includes('email') ? (
                            <Input
                              id={fieldName}
                              type="email"
                              placeholder={fieldDescription || `Enter ${fieldName}`}
                              value={formData[fieldName] || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, [fieldName]: e.target.value }))}
                              required={isRequired}
                            />
                          ) : (
                            // Default to text input for unknown types
                            <Input
                              id={fieldName}
                              type="text"
                              placeholder={fieldDescription || `Enter ${fieldName}`}
                              value={formData[fieldName] || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, [fieldName]: e.target.value }))}
                              required={isRequired}
                            />
                          )}
                          
                          {fieldDescription && (
                            <p className="text-xs text-muted-foreground">{fieldDescription}</p>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Schema not available</p>
                      <p className="text-sm">
                        Cannot create new {displayName} records without schema information. 
                        Please ensure the entity schema is properly loaded.
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setFormData({})
                      setAddModalOpen(false)
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : `Create ${displayName}`}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
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
        {columns.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Loading table structure...</p>
            </div>
          </div>
        ) : (
          (() => {
            // Use EntityNameUtils to ensure proper prefixing without duplication
            const fullEntityName = EntityNameUtils.ensureOrgPrefix(entityName, orgId || '');
            return (
              <VibeGrid
                entityType={fullEntityName}
                tableId={`${entityName}-entity-table`}
                className="h-full"
                height="100%"
                width="100%"
                enableVirtualScrolling={true}
                enableGrouping={true}
                enableSorting={true}
                enableFiltering={true}
                enableDragAndDrop={true}
                enableSelectionColumn={true}
                onSelectionChange={handleSelectionChange}
                onEditingChange={handleEditingChange}
                onEntityUpdate={handleEntityUpdate}
                onBatchEntityUpdate={handleBatchEntityUpdate}
              />
            );
          })()
        )}
      </div>
    </div>
  )
}