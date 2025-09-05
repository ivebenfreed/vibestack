import { createLazyFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Database, Plus, Trash2, Edit, RefreshCw, Search, Package, ArrowRight, ArrowUpDown, Edit3, CheckCircle, RotateCcw, Trash } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  universeLoading$,
  universeSchema$,
  universeOrgId$,
  getEntity$, 
  removeEntityFromSchema,
  clearContext 
} from '@/legend-state'
import { orgSchemaClient } from '@/lib/schema-client'
import { useAuth } from '@/lib/auth'

const EntityOperationsDebug = observer(function EntityOperationsDebug() {
  const { currentOrganization, user } = useAuth()
  const [testEntityName, setTestEntityName] = useState('Client')
  const [testRecordData, setTestRecordData] = useState('{"name": "Test Client", "company_name": "Test Company", "contact_person": "John Doe", "email": "john@testcompany.com"}')
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Use observables
  const loading = use$(universeLoading$)
  const schema = use$(universeSchema$)
  const currentOrgId = use$(universeOrgId$)

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`
    setLogs(prev => [logEntry, ...prev].slice(0, 50)) // Keep last 50 logs
    console.log(logEntry)
  }

  const clearLogs = () => setLogs([])

  // Test loading organization context
  const testLoadContext = async () => {
    if (!currentOrganization?.id || !user?.id) {
      addLog('No organization or user ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Organization context automatically loaded by auth system for ${currentOrganization.id}`)
      // Organization context is now automatically loaded by the auth system
      // No need to manually load org context here
      addLog('Org context automatically handled by auth system', 'success')
    } catch (error) {
      addLog(`Failed to handle org context: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Test creating entity via DataForge API
  const testCreateEntity = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Creating entity: ${testEntityName}`)
      
      // 📋 ENTITY CREATION API REFERENCE
      // ================================
      // 
      // ✅ CORRECT JSON Structure (Top-level fields):
      // {
      //   "entityName": "string",     // Required: Name of the new entity
      //   "archetype": "string",      // Required: One of the valid archetypes
      //   "customFields": [...]       // Optional: Array of custom field definitions
      // }
      //
      // ❌ WRONG: Do NOT nest entityName/archetype under 'definition' key
      // ❌ WRONG: { definition: { entityName: "...", archetype: "..." } }
      //
      // 🎯 Valid Archetypes (see apps/server/src/dataforge/archetypes/):
      // - 'project'     : Project-like entities (name, description, dates, owner)
      // - 'task'        : Task-like entities (assignee, due_date, project_id)
      // - 'record'      : Generic record entities (minimal base fields)
      // - 'document'    : Document entities (content, version, metadata)
      // - 'file'        : File entities (filename, size, mime_type)
      // - 'activity'    : Activity log entities (action, timestamp, actor)
      // - 'discussion'  : Discussion entities (thread, participants, messages)
      // - 'collection'  : Collection entities (items, ordering, metadata)
      //
      // 📝 Custom Field Format:
      // {
      //   "name": "field_name",           // Required: Snake_case field name
      //   "type": "text|number|decimal|boolean|date|json", // Required
      //   "required": true|false,         // Optional: Default false
      //   "syncable": true|false,         // Optional: Default true (syncs to client)
      //   "serverOnly": true|false,       // Optional: Default false
      //   "defaultValue": any,            // Optional: Default value for field
      //   "enum": ["val1", "val2"],       // Optional: For choice fields
      //   "validation": {...}             // Optional: Validation rules
      // }
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entityName: testEntityName,
          archetype: 'project', // ✅ Valid archetype at top level
          customFields: [
            { name: 'test_field', type: 'text', required: false },
            { name: 'test_number', type: 'decimal', required: false }
          ]
        })
      })
      
      const data = await result.json()
      
      if (data.success) {
        addLog(`Entity created: ${testEntityName}`, 'success')
        // Organization context is now automatically updated by the auth system
        // No need to manually reload context
      } else {
        addLog(`Failed to create entity: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Error creating entity: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Test getting entity observable
  const testGetEntityObservable = () => {
    try {
      addLog(`Getting entity observable for: ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (entityObs) {
        addLog(`Entity observable found for ${testEntityName}`, 'success')
        
        // For syncedCrud observables, we need to access data differently
        try {
          // Method 1: Try to access the data directly
          addLog(`Observable methods: ${Object.getOwnPropertyNames(entityObs).join(', ')}`)
          
          // Method 2: Try to get current data by accessing the observable value
          const data = entityObs.get ? entityObs.get() : Object.keys(entityObs).reduce((acc, key) => {
            if (key !== 'set' && key !== 'get' && key !== 'peek' && !key.startsWith('_')) {
              acc[key] = entityObs[key]
            }
            return acc
          }, {})
          
          const recordCount = Object.keys(data).length
          addLog(`Current data contains ${recordCount} records`, 'success')
          
          if (recordCount > 0) {
            const firstRecord = Object.values(data)[0]
            addLog(`Sample record: ${JSON.stringify(firstRecord, null, 2)}`)
          } else {
            addLog(`No records found in ${testEntityName}`)
          }
        } catch (accessError) {
          addLog(`Could not access data: ${accessError}`, 'error')
          
          // Method 3: Try using Legend State's use$ or similar
          addLog(`Trying alternative data access methods...`)
          try {
            // Check if we can access individual properties
            const keys = Object.keys(entityObs).filter(key => !key.startsWith('_') && typeof entityObs[key] !== 'function')
            addLog(`Available record keys: ${keys.join(', ')}`)
            
            if (keys.length > 0) {
              const firstKey = keys[0]
              const record = entityObs[firstKey]
              addLog(`Record ${firstKey}: ${JSON.stringify(record, null, 2)}`)
            }
          } catch (keyError) {
            addLog(`Key access also failed: ${keyError}`, 'error')
          }
        }
      } else {
        addLog(`Entity observable not found for ${testEntityName}`, 'error')
      }
    } catch (error) {
      addLog(`Error getting entity observable: ${error}`, 'error')
    }
  }

  // Test creating record
  const testCreateRecord = async () => {
    try {
      addLog(`Creating record in ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (!entityObs) {
        addLog(`Entity observable not found for ${testEntityName}`, 'error')
        return
      }

      const recordData = JSON.parse(testRecordData)
      const id = crypto.randomUUID()
      
      addLog(`Setting record with ID: ${id}`)
      addLog(`Entity observable type: ${typeof entityObs}`)
      addLog(`Entity observable methods: ${Object.getOwnPropertyNames(entityObs).join(', ')}`)
      
      // CORRECT APPROACH: syncedCrud observables work as a collection
      // We access individual items directly on the observable, not through methods
      const record = {
        id,
        ...recordData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      addLog(`Attempting to set record using syncedCrud pattern`)
      
      // Method 1: Try direct assignment (this is how syncedCrud works)
      try {
        addLog(`Trying entityObs[id] = record`)
        entityObs[id] = record
        addLog(`Direct assignment successful`, 'success')
      } catch (directError) {
        addLog(`Direct assignment failed: ${directError}`, 'error')
        
        // Method 2: Try using the observable's set method on the whole collection
        try {
          addLog(`Trying to use entityObs.set() with merged data`)
          const currentData = entityObs.peek() || {}
          entityObs.set({
            ...currentData,
            [id]: record
          })
          addLog(`Collection set method successful`, 'success')
        } catch (setError) {
          addLog(`Collection set failed: ${setError}`, 'error')
          
          // Method 3: Try using assign method if available
          try {
            addLog(`Trying entityObs.assign()`)
            entityObs.assign({ [id]: record })
            addLog(`Assign method successful`, 'success')
          } catch (assignError) {
            addLog(`Assign method failed: ${assignError}`, 'error')
            throw new Error(`All record creation methods failed`)
          }
        }
      }
      
      addLog(`Record created successfully with ID: ${id}`, 'success')
    } catch (error) {
      addLog(`Error creating record: ${error}`, 'error')
    }
  }

  // Test updating record
  const testUpdateRecord = async () => {
    try {
      addLog(`Updating first record in ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (!entityObs) {
        addLog(`Entity observable not found for ${testEntityName}`, 'error')
        return
      }

      // Get data using the same method as in testGetEntityObservable
      const data = entityObs.get ? entityObs.get() : Object.keys(entityObs).reduce((acc, key) => {
        if (key !== 'set' && key !== 'get' && key !== 'peek' && !key.startsWith('_')) {
          acc[key] = entityObs[key]
        }
        return acc
      }, {})
      
      // Check if data exists and is an object
      if (!data || typeof data !== 'object') {
        addLog(`No data loaded in ${testEntityName} observable yet. Try "Query Entity Data" first.`, 'error')
        return
      }
      
      const firstRecordId = Object.keys(data)[0]
      
      if (!firstRecordId) {
        addLog(`No records found to update in ${testEntityName}`, 'error')
        return
      }

      addLog(`Updating record: ${firstRecordId}`)
      
      // Get the current record using .peek() to avoid reactivity  
      const currentRecord = data[firstRecordId]
      
      if (!currentRecord) {
        addLog(`Record ${firstRecordId} not found in data`, 'error')
        return
      }
      
      // Update using direct assignment to the entire data set
      const updatedRecord = {
        ...currentRecord,
        contact_person: `${currentRecord.contact_person || 'Unknown'} (Updated at ${new Date().toLocaleTimeString()})`,
        updated_at: new Date().toISOString()
      }
      
      // Update the entire observable data with the modified record
      const newData = { ...data, [firstRecordId]: updatedRecord }
      
      addLog(`Attempting to update record using entity$.set()`)
      entityObs.set(newData)
      
      addLog(`Record updated successfully: ${firstRecordId}`, 'success')
    } catch (error) {
      addLog(`Error updating record: ${error}`, 'error')
    }
  }

  // Test deleting record
  const testDeleteRecord = async () => {
    try {
      addLog(`Deleting first record in ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (!entityObs) {
        addLog(`Entity observable not found for ${testEntityName}`, 'error')
        return
      }

      // Get data using the same method as in other functions
      const data = entityObs.get ? entityObs.get() : Object.keys(entityObs).reduce((acc, key) => {
        if (key !== 'set' && key !== 'get' && key !== 'peek' && !key.startsWith('_')) {
          acc[key] = entityObs[key]
        }
        return acc
      }, {})
      
      const firstRecordId = Object.keys(data)[0]
      
      if (!firstRecordId) {
        addLog(`No records found to delete in ${testEntityName}`, 'error')
        return
      }

      addLog(`Deleting record: ${firstRecordId}`)
      
      // For syncedCrud observables, we delete by setting to undefined or using delete operator
      try {
        addLog(`Attempting to delete using delete operator`)
        delete entityObs[firstRecordId]
        addLog(`Delete operator successful`, 'success')
      } catch (deleteError) {
        addLog(`Delete operator failed: ${deleteError}`, 'error')
        
        // Alternative: Set to undefined
        try {
          addLog(`Attempting to delete by setting to undefined`)
          entityObs[firstRecordId] = undefined
          addLog(`Set to undefined successful`, 'success')
        } catch (undefinedError) {
          addLog(`Set to undefined failed: ${undefinedError}`, 'error')
          throw new Error(`All delete methods failed`)
        }
      }
      
      addLog(`Record deleted successfully: ${firstRecordId}`, 'success')
    } catch (error) {
      addLog(`Error deleting record: ${error}`, 'error')
    }
  }

  // Test querying entity data via DataForge API
  const testQueryEntityData = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Querying data from entity: ${testEntityName}`)
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?limit=5`, {
        method: 'GET',
        credentials: 'include',
      })
      
      const data = await result.json()
      
      if (data.success) {
        addLog(`Query successful: Found ${data.data?.length || 0} records`, 'success')
        if (data.data && data.data.length > 0) {
          addLog(`Sample record: ${JSON.stringify(data.data[0], null, 2)}`)
        }
      } else {
        addLog(`Failed to query entity data: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Error querying entity data: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Test clearing context
  const testClearContext = () => {
    try {
      addLog('Clearing all observables')
      clearContext()
      addLog('Context cleared successfully', 'success')
    } catch (error) {
      addLog(`Error clearing context: ${error}`, 'error')
    }
  }

  // Advanced test functions for comprehensive API testing
  const testAdvancedQuery = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing advanced query with filtering and sorting on ${testEntityName}`)
      
      const queryParams = new URLSearchParams({
        'filter[name][contains]': 'Test',
        'sort': '-created_at,name',
        'limit': '5',
        'fields': 'id,name,created_at,updated_at'
      })
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?${queryParams}`, {
        credentials: 'include'
      })
      
      const data = await result.json()
      if (data.success) {
        addLog(`Advanced query successful: Found ${data.data?.length || 0} filtered records`, 'success')
        addLog(`Query used filters: name contains 'Test', sorted by -created_at,name`)
      } else {
        addLog(`Advanced query failed: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Advanced query error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testPaginatedQuery = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing pagination on ${testEntityName}`)
      
      // Test first page
      const page1Result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?limit=2&page=1`, {
        credentials: 'include'
      })
      
      const page1Data = await page1Result.json()
      if (page1Data.success) {
        addLog(`Page 1: Found ${page1Data.data?.length || 0} records`, 'success')
        
        // Test second page
        const page2Result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?limit=2&page=2`, {
          credentials: 'include'
        })
        
        const page2Data = await page2Result.json()
        addLog(`Page 2: Found ${page2Data.data?.length || 0} records`, 'success')
        addLog(`Pagination test completed`)
      } else {
        addLog(`Pagination test failed: ${page1Data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Pagination test error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testSortedQuery = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing sorting on ${testEntityName}`)
      
      // Test ascending sort
      const ascResult = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?sort=name&limit=3`, {
        credentials: 'include'
      })
      
      const ascData = await ascResult.json()
      if (ascData.success) {
        addLog(`Ascending sort successful: ${ascData.data?.length || 0} records`, 'success')
        
        // Test descending sort
        const descResult = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?sort=-name&limit=3`, {
          credentials: 'include'
        })
        
        const descData = await descResult.json()
        addLog(`Descending sort successful: ${descData.data?.length || 0} records`, 'success')
        addLog(`Sorting test completed (ASC & DESC by name)`)
      } else {
        addLog(`Sorting test failed: ${ascData.error}`, 'error')
      }
    } catch (error) {
      addLog(`Sorting test error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testBulkCreate = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing bulk create in ${testEntityName}`)
      
      const bulkData = [
        { name: 'Bulk Record 1', description: 'Created via bulk operation 1', record_type: 'customer' },
        { name: 'Bulk Record 2', description: 'Created via bulk operation 2', record_type: 'prospect' },
        { name: 'Bulk Record 3', description: 'Created via bulk operation 3', record_type: 'customer' }
      ]
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          records: bulkData,
          options: { validate: true, atomic: true }
        })
      })
      
      const data = await result.json()
      if (data.success) {
        addLog(`Bulk create successful: Created ${data.created?.length || bulkData.length} records`, 'success')
      } else {
        addLog(`Bulk create failed: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Bulk create error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testBulkUpdate = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing bulk update in ${testEntityName}`)
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}/bulk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filter: { name: { contains: 'Bulk Record' } },
          updates: { 
            description: 'Updated via bulk operation',
            updated_at: new Date().toISOString()
          }
        })
      })
      
      const data = await result.json()
      if (data.success) {
        addLog(`Bulk update successful: Updated ${data.updated_count || 0} records`, 'success')
      } else {
        addLog(`Bulk update failed: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Bulk update error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testBulkDelete = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing bulk delete in ${testEntityName}`)
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filter: { name: { contains: 'Bulk Record' } },
          permanent: false
        })
      })
      
      const data = await result.json()
      if (data.success) {
        addLog(`Bulk delete successful: Deleted ${data.deleted_count || 0} records`, 'success')
      } else {
        addLog(`Bulk delete failed: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Bulk delete error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testAddField = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing add field to ${testEntityName}`)
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/entities/${testEntityName}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fields: [{
            name: 'dynamic_field_' + Date.now(),
            type: 'text',
            required: false,
            defaultValue: 'Added dynamically'
          }]
        })
      })
      
      const data = await result.json()
      if (data.success) {
        addLog(`Add field successful: Added new field`, 'success')
      } else {
        addLog(`Add field failed: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Add field error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testModifyField = async () => {
    addLog('Modify field operation not yet implemented in this demo', 'info')
  }

  const testValidationRules = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing validation rules for ${testEntityName}`)
      
      // Test with invalid data that should fail validation
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/validate/${testEntityName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data: {
            name: '', // Empty name should fail if required
            invalid_field: 'should not exist'
          }
        })
      })
      
      const data = await result.json()
      if (data.valid === false) {
        addLog(`Validation rules working: Found ${data.errors?.length || 0} validation errors`, 'success')
        if (data.errors) {
          data.errors.forEach((error: string) => addLog(`  - ${error}`))
        }
      } else {
        addLog(`Validation test completed: Data is valid`, 'info')
      }
    } catch (error) {
      addLog(`Validation test error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testComplexFieldTypes = async () => {
    addLog('Complex field types test: JSON, arrays, and computed fields demo', 'info')
    addLog('Example: specifications field could store { weight: 1.5, dimensions: { l: 10, w: 5, h: 3 } }', 'info')
    addLog('Example: tags field could store ["urgent", "client-request", "bug-fix"]', 'info')
    addLog('Example: computed_score field automatically calculated from other fields', 'info')
    addLog('See /docs/dataforge/COMPLETE_API_REFERENCE.md for implementation details', 'info')
  }

  const testEntityRestore = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Testing entity restore (requires a deleted entity)`)
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/entities/${testEntityName}/restore`, {
        method: 'POST',
        credentials: 'include'
      })
      
      const data = await result.json()
      if (data.success) {
        addLog(`Entity restore successful: ${testEntityName} restored`, 'success')
      } else {
        addLog(`Entity restore failed: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Entity restore error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const testEntityTrash = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`Fetching deleted entities (trash) for organization`)
      
      const result = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/entities/trash`, {
        credentials: 'include'
      })
      
      const data = await result.json()
      if (data.success) {
        addLog(`Trash query successful: Found ${data.entities?.length || 0} deleted entities`, 'success')
        if (data.entities && data.entities.length > 0) {
          data.entities.forEach((entity: any) => {
            addLog(`  - ${entity.entity_name} (deleted: ${entity.deleted_at})`)
          })
        }
      } else {
        addLog(`Trash query failed: ${data.error}`, 'error')
      }
    } catch (error) {
      addLog(`Trash query error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // NEW: Sync diagnostics for debugging the Client 11k records issue
  const testSyncDiagnostics = async () => {
    if (!currentOrganization?.id) {
      addLog('No organization ID available', 'error')
      return
    }

    setIsLoading(true)
    try {
      addLog(`🔍 SYNC DIAGNOSTICS: Testing ${testEntityName} with ${testEntityName === 'Client' ? '11k' : 'multiple'} records`)
      
      // Step 1: Get database record count via API
      addLog(`Step 1: Querying database directly via API...`)
      const dbResult = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?limit=1&count=true`, {
        credentials: 'include'
      })
      const dbData = await dbResult.json()
      const dbCount = dbData.total_count || (dbData.data?.length || 0)
      addLog(`📊 Database count: ${dbCount} records`, dbCount > 0 ? 'success' : 'error')
      
      // Step 2: Get Legend State observable count
      addLog(`Step 2: Checking Legend State observable...`)
      const entityObs = getEntity$(testEntityName)
      let obsCount = 0
      let obsData = null
      
      if (entityObs) {
        try {
          obsData = entityObs.get ? entityObs.get() : entityObs.peek ? entityObs.peek() : {}
          obsCount = obsData && typeof obsData === 'object' ? Object.keys(obsData).length : 0
          addLog(`📊 Observable count: ${obsCount} records`, obsCount > 0 ? 'success' : 'error')
        } catch (obsError) {
          addLog(`❌ Failed to access observable data: ${obsError}`, 'error')
        }
      } else {
        addLog(`❌ Entity observable not found for ${testEntityName}`, 'error')
      }
      
      // Step 3: Sync comparison
      addLog(`Step 3: Sync comparison analysis...`)
      const syncDiff = Math.abs(dbCount - obsCount)
      if (syncDiff === 0) {
        addLog(`✅ PERFECT SYNC: Database and Observable have same count (${dbCount})`, 'success')
      } else {
        addLog(`⚠️ SYNC MISMATCH: DB has ${dbCount}, Observable has ${obsCount} (diff: ${syncDiff})`, 'error')
        
        // Additional diagnostics for sync issues
        if (dbCount > 0 && obsCount === 0) {
          addLog(`🔍 DIAGNOSIS: Observable not initialized - data exists but not loaded`, 'error')
          addLog(`💡 SOLUTION: Check syncedCrud initialization and differential sync`, 'info')
        } else if (obsCount > dbCount) {
          addLog(`🔍 DIAGNOSIS: Observable has stale/phantom records`, 'error')
          addLog(`💡 SOLUTION: Check for failed deletions or cached data`, 'info')
        } else if (dbCount > obsCount) {
          addLog(`🔍 DIAGNOSIS: Missing records in observable`, 'error')
          addLog(`💡 SOLUTION: Check last sync timestamp and differential sync`, 'info')
        }
      }
      
      // Step 4: Sample record comparison (if both have data)
      if (dbCount > 0 && obsCount > 0) {
        addLog(`Step 4: Sample record comparison...`)
        try {
          // Get sample from database
          const sampleDbResult = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}?limit=1`, {
            credentials: 'include'
          })
          const sampleDbData = await sampleDbResult.json()
          const dbSample = sampleDbData.data?.[0]
          
          if (dbSample && obsData) {
            const obsKeys = Object.keys(obsData)
            const dbSampleId = dbSample.id
            const obsSample = obsData[dbSampleId]
            
            if (obsSample) {
              addLog(`✅ Sample record ${dbSampleId} exists in both DB and Observable`, 'success')
              
              // Compare key fields
              const keyFields = ['id', 'updated_at', 'created_at', 'name', 'email']
              let fieldMismatches = 0
              keyFields.forEach(field => {
                if (dbSample[field] !== obsSample[field]) {
                  fieldMismatches++
                  addLog(`  ⚠️ Field '${field}': DB='${dbSample[field]}' vs Obs='${obsSample[field]}'`)
                }
              })
              
              if (fieldMismatches === 0) {
                addLog(`✅ Sample record fields match perfectly`, 'success')
              } else {
                addLog(`⚠️ Found ${fieldMismatches} field mismatches in sample record`, 'error')
              }
            } else {
              addLog(`❌ Sample record ${dbSampleId} missing from Observable`, 'error')
              addLog(`🔍 Observable has these IDs: ${obsKeys.slice(0, 5).join(', ')}${obsKeys.length > 5 ? '...' : ''}`)
            }
          }
        } catch (sampleError) {
          addLog(`❌ Sample comparison failed: ${sampleError}`, 'error')
        }
      }
      
      // Step 5: Check specific record that was failing earlier
      addLog(`Step 5: Checking specific problematic record...`)
      const problematicId = '98763f2f-72e1-4dbd-8291-376d1eaa5fe5' // From earlier error
      try {
        // Check in database
        const specificDbResult = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/data/${testEntityName}/${problematicId}`, {
          credentials: 'include'
        })
        const specificDbData = await specificDbResult.json()
        const dbHasRecord = specificDbData.success && specificDbData.data
        
        // Check in observable
        const obsHasRecord = obsData && obsData[problematicId]
        
        addLog(`🎯 Record ${problematicId}:`)
        addLog(`  Database: ${dbHasRecord ? '✅ EXISTS' : '❌ NOT FOUND'}`)
        addLog(`  Observable: ${obsHasRecord ? '✅ EXISTS' : '❌ NOT FOUND'}`)
        
        if (dbHasRecord && !obsHasRecord) {
          addLog(`⚠️ SYNC ISSUE: Record exists in DB but missing from Observable`, 'error')
          addLog(`💡 This explains the "Record not found" error during updates`, 'info')
        } else if (!dbHasRecord && obsHasRecord) {
          addLog(`⚠️ STALE DATA: Record in Observable but not in DB (deleted?)`, 'error')
        } else if (dbHasRecord && obsHasRecord) {
          addLog(`✅ Record properly synced`, 'success')
        } else {
          addLog(`❌ Record not found in either source`, 'error')
        }
      } catch (specificError) {
        addLog(`❌ Specific record check failed: ${specificError}`, 'error')
      }
      
      // Step 6: Final recommendations
      addLog(`Step 6: Recommendations...`)
      if (syncDiff > 0) {
        addLog(`🔧 RECOMMENDED ACTIONS:`)
        addLog(`  1. Check differential sync logic and lastSync timestamps`)
        addLog(`  2. Verify WebSocket notifications are working`)
        addLog(`  3. Test manual sync refresh`)
        addLog(`  4. Check for IndexedDB persistence issues`)
        addLog(`  5. Verify syncedCrud configuration`)
      } else {
        addLog(`✅ Sync appears healthy - investigate other update mechanisms`)
      }
      
    } catch (error) {
      addLog(`❌ Sync diagnostics failed: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // NEW: Test manual sync refresh
  const testManualSyncRefresh = async () => {
    try {
      addLog(`🔄 MANUAL SYNC: Forcing refresh for ${testEntityName}`)
      const entityObs = getEntity$(testEntityName)
      
      if (!entityObs) {
        addLog(`❌ Entity observable not found`, 'error')
        return
      }
      
      addLog(`Attempting manual refresh methods...`)
      
      // Method 1: Check for refresh method
      if (typeof entityObs.refresh === 'function') {
        addLog(`Trying entityObs.refresh()...`)
        await entityObs.refresh()
        addLog(`✅ Refresh method succeeded`, 'success')
      } else {
        addLog(`⚠️ No refresh method available`, 'info')
      }
      
      // Method 2: Force re-sync by clearing and reloading
      if (currentOrganization?.id && user?.id) {
        addLog(`Organization context automatically handled by auth system...`)
        // Organization context is now automatically loaded by the auth system
        // No need to manually reload context
        addLog(`✅ Context automatically handled by auth system`, 'success')
      }
      
      // Method 3: Check if data is now available
      setTimeout(() => {
        try {
          const refreshedObs = getEntity$(testEntityName)
          if (refreshedObs) {
            const refreshedData = refreshedObs.get ? refreshedObs.get() : refreshedObs.peek()
            const refreshedCount = refreshedData && typeof refreshedData === 'object' ? Object.keys(refreshedData).length : 0
            addLog(`📊 Post-refresh count: ${refreshedCount} records`, refreshedCount > 0 ? 'success' : 'error')
          }
        } catch (refreshError) {
          addLog(`❌ Post-refresh check failed: ${refreshError}`, 'error')
        }
      }, 1000)
      
    } catch (error) {
      addLog(`❌ Manual sync refresh failed: ${error}`, 'error')
    }
  }

  // NEW: Test observable data integrity
  const testObservableIntegrity = () => {
    try {
      addLog(`🔍 INTEGRITY CHECK: Testing ${testEntityName} observable internal state`)
      const entityObs = getEntity$(testEntityName)
      
      if (!entityObs) {
        addLog(`❌ Entity observable not found`, 'error')
        return
      }
      
      addLog(`Observable type: ${typeof entityObs}`)
      addLog(`Observable constructor: ${entityObs.constructor.name}`)
      
      // Check internal properties
      const allProps = Object.getOwnPropertyNames(entityObs)
      const methods = allProps.filter(prop => typeof entityObs[prop] === 'function')
      const dataProps = allProps.filter(prop => typeof entityObs[prop] !== 'function' && !prop.startsWith('_'))
      
      addLog(`Available methods: ${methods.join(', ')}`)
      addLog(`Data properties: ${dataProps.length} found`)
      
      // Check if it's a syncedCrud observable
      if (methods.includes('get') && methods.includes('set')) {
        addLog(`✅ Detected syncedCrud observable (has get/set methods)`, 'success')
        
        try {
          const rawData = entityObs.get()
          addLog(`Raw data type: ${typeof rawData}`)
          addLog(`Raw data is array: ${Array.isArray(rawData)}`)
          addLog(`Raw data keys: ${rawData && typeof rawData === 'object' ? Object.keys(rawData).length : 'N/A'}`)
          
          if (rawData && typeof rawData === 'object') {
            const keys = Object.keys(rawData)
            if (keys.length > 0) {
              const firstKey = keys[0]
              const firstRecord = rawData[firstKey]
              addLog(`Sample record structure: ${JSON.stringify(Object.keys(firstRecord), null, 2)}`)
            }
          }
        } catch (dataError) {
          addLog(`❌ Failed to access raw data: ${dataError}`, 'error')
        }
      } else {
        addLog(`⚠️ Unknown observable type - may not be syncedCrud`, 'info')
      }
      
      // Check for Legend State specific properties
      const legendProps = allProps.filter(prop => 
        prop.includes('$') || 
        prop.includes('legend') || 
        prop.includes('sync') || 
        prop.includes('crud')
      )
      if (legendProps.length > 0) {
        addLog(`Legend State properties: ${legendProps.join(', ')}`)
      }
      
    } catch (error) {
      addLog(`❌ Integrity check failed: ${error}`, 'error')
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entity Operations Debug</h1>
          <p className="text-muted-foreground mt-2">
            Test all Legend State observable operations for debugging
          </p>
        </div>
        <Button onClick={clearLogs} variant="outline">
          Clear Logs
        </Button>
      </div>

      {/* Current State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Current State
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Organization ID</p>
              <Badge variant={currentOrgId ? 'default' : 'destructive'}>
                {currentOrgId || 'Not loaded'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Loading State</p>
              <Badge variant={loading ? 'secondary' : 'default'}>
                {loading ? 'Loading' : 'Ready'}
              </Badge>
            </div>
          </div>
          
          <div>
            <p className="text-sm font-medium">Available Entities</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {schema?.entities ? Object.keys(schema.entities).map(entityName => (
                <Badge key={entityName} variant="outline">
                  {entityName}
                </Badge>
              )) : (
                <Badge variant="secondary">No entities loaded</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Parameters</CardTitle>
          <CardDescription>
            Configure the entity name and record data for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Entity Name</label>
            <Input
              value={testEntityName}
              onChange={(e) => setTestEntityName(e.target.value)}
              placeholder="Client"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Record Data (JSON)</label>
            <textarea
              className="w-full p-2 border rounded-md text-sm font-mono"
              rows={3}
              value={testRecordData}
              onChange={(e) => setTestRecordData(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Context Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={testLoadContext}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Context
            </Button>
            <Button
              onClick={testClearContext}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Context
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Entity Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={testCreateEntity}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Entity
            </Button>
            <Button
              onClick={testQueryEntityData}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Search className="h-4 w-4 mr-2" />
              Query Entity Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Record Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={testGetEntityObservable}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Database className="h-4 w-4 mr-2" />
              Get Observable
            </Button>
            <Button
              onClick={testCreateRecord}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Record
            </Button>
            <Button
              onClick={testUpdateRecord}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Edit className="h-4 w-4 mr-2" />
              Update Record
            </Button>
            <Button
              onClick={testDeleteRecord}
              disabled={isLoading}
              className="w-full"
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Record
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4" />
              Advanced Queries
            </CardTitle>
            <CardDescription className="text-xs">
              Test filtering, sorting, and pagination
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => testAdvancedQuery()}
              disabled={isLoading}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <Search className="h-4 w-4 mr-2" />
              Test Filtered Query
            </Button>
            <Button
              onClick={() => testPaginatedQuery()}
              disabled={isLoading}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Test Pagination
            </Button>
            <Button
              onClick={() => testSortedQuery()}
              disabled={isLoading}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Test Sorting
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Bulk Operations
            </CardTitle>
            <CardDescription className="text-xs">
              Test batch create, update, delete
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => testBulkCreate()}
              disabled={isLoading}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <Package className="h-4 w-4 mr-2" />
              Bulk Create Records
            </Button>
            <Button
              onClick={() => testBulkUpdate()}
              disabled={isLoading}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Bulk Update Records
            </Button>
            <Button
              onClick={() => testBulkDelete()}
              disabled={isLoading}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Bulk Delete Records
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Entity Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Entity Schema Modifications
          </CardTitle>
          <CardDescription className="text-xs">
            Test dynamic schema changes and validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Button
              onClick={() => testAddField()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Field
            </Button>
            <Button
              onClick={() => testModifyField()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Edit3 className="h-3 w-3 mr-1" />
              Modify Field
            </Button>
            <Button
              onClick={() => testValidationRules()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Test Validation
            </Button>
            <Button
              onClick={() => testComplexFieldTypes()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Database className="h-3 w-3 mr-1" />
              Complex Types
            </Button>
            <Button
              onClick={() => testEntityRestore()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Restore Entity
            </Button>
            <Button
              onClick={() => testEntityTrash()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Trash className="h-3 w-3 mr-1" />
              View Trash
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* NEW: Sync Diagnostics for Client 11k Records Issue */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            🔍 Sync Diagnostics (Client 11k Records Issue)
          </CardTitle>
          <CardDescription className="text-xs">
            Advanced debugging for Legend State sync issues with large datasets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button
              onClick={() => testSyncDiagnostics()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs bg-orange-100 hover:bg-orange-200"
            >
              <Search className="h-3 w-3 mr-1" />
              Full Sync Analysis
            </Button>
            <Button
              onClick={() => testManualSyncRefresh()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Force Sync Refresh
            </Button>
            <Button
              onClick={() => testObservableIntegrity()}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Database className="h-3 w-3 mr-1" />
              Observable Integrity
            </Button>
          </div>
          <div className="mt-2 text-xs text-orange-700">
            <strong>Usage:</strong> Set Entity Name to "Client" and run "Full Sync Analysis" to diagnose the 11k records sync mismatch issue.
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Operation Logs
          </CardTitle>
          <CardDescription>
            Real-time logs of all operations and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Run some operations to see output.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

export const Route = createLazyFileRoute('/_authenticated/debug/entity-operations')({
  component: EntityOperationsDebug,
})