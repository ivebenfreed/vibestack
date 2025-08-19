/**
 * Dynamic Schema POC Test Page
 * 
 * UI route for testing dynamic schema updates with Wide Corp
 */

import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { dynamicSchemaPOC, pocHelpers, WIDE_CORP_ORG_ID, type SchemaChange, type SchemaPOCResult } from '@/lib/dynamic-schema-poc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const Route = createFileRoute('/_authenticated/dynamic-schema-test')({
  component: DynamicSchemaTestPage,
})

function DynamicSchemaTestPage() {
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [schemaInfo, setSchemaInfo] = useState<any>(null)
  const [testResults, setTestResults] = useState<SchemaPOCResult[]>([])
  const [schemaChanges, setSchemaChanges] = useState<SchemaChange[]>([])
  
  // Form state
  const [selectedEntity, setSelectedEntity] = useState('Project')
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState('string')
  const [entityType, setEntityType] = useState('project')
  
  // Data operations state
  const [dataEntity, setDataEntity] = useState('')
  const [testData, setTestData] = useState('{"name": "Test Item", "status": "active"}')
  const [dataResults, setDataResults] = useState<string[]>([])
  
  // Migration operations removed - now using immediate execution
  
  // Comprehensive test state
  const [isRunningComprehensiveTests, setIsRunningComprehensiveTests] = useState(false)
  const [comprehensiveResults, setComprehensiveResults] = useState<string[]>([])
  
  // Created entities tracking for data operations
  const [createdEntities, setCreatedEntities] = useState<string[]>(['Project', 'Task']) // Start with defaults
  
  useEffect(() => {
    // Subscribe to schema changes
    const unsubscribe = dynamicSchemaPOC.onSchemaChange((changes) => {
      setSchemaChanges(prev => [...prev, ...changes])
    })
    
    return unsubscribe
  }, [])

  const handleInitialize = async () => {
    setLoading(true)
    try {
      const result = await pocHelpers.init()
      setTestResults([result])
      setInitialized(result.success)
      
      if (result.success) {
        const info = pocHelpers.getInfo()
        setSchemaInfo(info)
      }
    } catch (error) {
      console.error('Init failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = async () => {
    if (!fieldName.trim()) return
    
    setLoading(true)
    try {
      const result = await pocHelpers.addField(selectedEntity, fieldName, fieldType)
      setTestResults(prev => [...prev, result])
      
      if (result.success) {
        const info = pocHelpers.getInfo()
        setSchemaInfo(info)
        setFieldName('')
      }
    } catch (error) {
      console.error('Add field failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveField = async () => {
    if (!fieldName.trim()) return
    
    setLoading(true)
    try {
      const result = await pocHelpers.removeField(selectedEntity, fieldName)
      setTestResults(prev => [...prev, result])
      
      if (result.success) {
        const info = pocHelpers.getInfo()
        setSchemaInfo(info)
        setFieldName('')
      }
    } catch (error) {
      console.error('Remove field failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEntity = async () => {
    if (!fieldName.trim()) return
    
    setLoading(true)
    try {
      const result = await pocHelpers.addEntity(fieldName, entityType)
      setTestResults(prev => [...prev, result])
      
      if (result.success) {
        const info = pocHelpers.getInfo()
        setSchemaInfo(info)
        setFieldName('')
      }
    } catch (error) {
      console.error('Add entity failed:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleCreateEntityAPI = async () => {
    if (!fieldName.trim()) return
    
    setLoading(true)
    try {
      const result = await pocHelpers.createEntityAPI(fieldName, entityType, {
        testField: { type: 'string', required: false }
      })
      setTestResults(prev => [...prev, result])
      
      if (result.success) {
        // Force refresh schema to pick up the new entity
        console.log('🔄 Refreshing schema after entity creation...')
        const refreshedInfo = await pocHelpers.refreshSchema()
        setSchemaInfo(refreshedInfo)
        
        // Add to created entities list for data operations
        setCreatedEntities(prev => [...new Set([...prev, fieldName])])
        
        setFieldName('')
        console.log('✅ UI updated with new entity:', refreshedInfo.entities)
      }
    } catch (error) {
      console.error('Create entity via API failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRunFullTests = async () => {
    setLoading(true)
    try {
      const result = await pocHelpers.runTests()
      setTestResults(prev => [...prev, result])
      
      const info = pocHelpers.getInfo()
      setSchemaInfo(info)
    } catch (error) {
      console.error('Full tests failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEntityFields = () => {
    if (!initialized || !selectedEntity) return []
    
    try {
      const fields = dynamicSchemaPOC.getEntityFields(selectedEntity)
      return Object.keys(fields)
    } catch {
      return []
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dynamic Schema POC - Complete Entity Operations Testing</h1>
          <p className="text-sm text-muted-foreground mt-1">Test ALL entity operations: schema fields, entity creation, data operations, and migrations</p>
        </div>
        <Badge variant="outline">Wide Corp: {WIDE_CORP_ORG_ID.slice(-12)}</Badge>
      </div>

      {/* Initialization */}
      <Card>
        <CardHeader>
          <CardTitle>1. Initialize POC</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleInitialize} 
              disabled={loading || initialized}
            >
              {loading ? 'Initializing...' : initialized ? 'Initialized ✓' : 'Initialize POC'}
            </Button>
            
            {initialized && (
              <Button 
                onClick={async () => {
                  setLoading(true)
                  try {
                    const refreshedInfo = await pocHelpers.refreshSchema()
                    setSchemaInfo(refreshedInfo)
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                variant="outline"
              >
                Refresh Schema
              </Button>
            )}
            
            {initialized && schemaInfo && (
              <div className="text-sm text-muted-foreground">
                {schemaInfo.entities?.length || 0} entities, {schemaInfo.totalFields || 0} total fields
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schema Operations */}
      {initialized && (
        <Card>
          <CardHeader>
            <CardTitle>2. Test Schema Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Field Operations */}
            <div className="space-y-4">
              <h4 className="font-medium">Field Operations</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Entity</Label>
                  <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {schemaInfo?.entities?.map((entity: string) => (
                        <SelectItem key={entity} value={entity}>
                          {entity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Field Name</Label>
                  <Input 
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="e.g., budget, priority"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select value={fieldType} onValueChange={setFieldType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddField} 
                  disabled={loading || !fieldName.trim()}
                >
                  Add Field
                </Button>
                <Button 
                  onClick={handleRemoveField} 
                  disabled={loading || !fieldName.trim()}
                  variant="destructive"
                >
                  Remove Field
                </Button>
              </div>
              
              {/* Current entity fields */}
              {selectedEntity && (
                <div className="mt-4">
                  <Label className="text-sm font-medium">Current {selectedEntity} fields:</Label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {getEntityFields().map(field => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Entity Operations */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Entity Operations</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entity Name</Label>
                  <Input 
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="e.g., Campaign, Document"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select value={entityType} onValueChange={setEntityType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project (project)</SelectItem>
                      <SelectItem value="task">Task (task)</SelectItem>
                      <SelectItem value="record">Record (record)</SelectItem>
                      <SelectItem value="document">Document (document)</SelectItem>
                      <SelectItem value="file">File (file)</SelectItem>
                      <SelectItem value="activity">Activity (activity)</SelectItem>
                      <SelectItem value="discussion">Discussion (discussion)</SelectItem>
                      <SelectItem value="collection">Collection (collection)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddEntity} 
                  disabled={loading || !fieldName.trim()}
                  variant="outline"
                >
                  Add Entity
                </Button>
                <Button 
                  onClick={handleCreateEntityAPI} 
                  disabled={loading || !fieldName.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Create Entity (API)
                </Button>
                <Button 
                  onClick={async () => {
                    if (!fieldName.trim()) return
                    setLoading(true)
                    try {
                      const result = await pocHelpers.deleteEntityAPI(fieldName)
                      setTestResults(prev => [...prev, result])
                      
                      if (result.success) {
                        // Remove from created entities list
                        setCreatedEntities(prev => prev.filter(e => e !== fieldName))
                        
                        const refreshedInfo = await pocHelpers.refreshSchema()
                        setSchemaInfo(refreshedInfo)
                        setFieldName('')
                        console.log('✅ Entity deleted and UI updated')
                      }
                    } catch (error) {
                      console.error('Delete entity via API failed:', error)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading || !fieldName.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Entity (API)
                </Button>
              </div>
              
              {/* Show existing entities that can be deleted */}
              {schemaInfo?.entities && schemaInfo.entities.length > 0 && (
                <div className="mt-4">
                  <Label className="text-sm font-medium">Existing entities (click to select for deletion):</Label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {schemaInfo.entities.map((entity: string) => (
                      <Badge 
                        key={entity} 
                        variant={fieldName === entity ? "default" : "secondary"} 
                        className="text-xs cursor-pointer hover:bg-red-100 hover:text-red-800" 
                        onClick={() => setFieldName(entity)}
                      >
                        {entity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Operations */}
      {initialized && (
        <Card>
          <CardHeader>
            <CardTitle>3. Data Operations Testing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Entity for Data Operations</Label>
                <Select value={dataEntity} onValueChange={setDataEntity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an entity..." />
                  </SelectTrigger>
                  <SelectContent>
                    {createdEntities.map(entity => (
                      <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Test Data (JSON)</Label>
                <textarea
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  placeholder='{"name": "Test Item", "status": "active"}'
                  className="w-full min-h-[80px] p-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={async () => {
                  if (!dataEntity) {
                    setDataResults(prev => ['❌ Please select an entity first', ...prev])
                    return
                  }
                  let data
                  try {
                    data = JSON.parse(testData)
                  } catch (e) {
                    setDataResults(prev => ['❌ Invalid JSON in test data', ...prev])
                    return
                  }
                  setDataResults(prev => [`🔄 Saving data to ${dataEntity}...`, ...prev])
                  const result = await dynamicSchemaPOC.testSaveDataViaAPI(dataEntity, data)
                  setDataResults(prev => [`${result.success ? '✅' : '❌'} Save data: ${result.success ? 'Success' : result.error}`, ...prev])
                }}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                Save Data
              </Button>
              
              <Button
                onClick={async () => {
                  if (!dataEntity) {
                    setDataResults(prev => ['❌ Please select an entity first', ...prev])
                    return
                  }
                  setDataResults(prev => [`🔄 Querying data from ${dataEntity}...`, ...prev])
                  const result = await dynamicSchemaPOC.testQueryDataViaAPI(dataEntity, 10)
                  setDataResults(prev => [`${result.success ? '✅' : '❌'} Query data: ${result.success ? 'Success' : result.error}`, ...prev])
                }}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Query Data
              </Button>
              
              <Button
                onClick={async () => {
                  if (!dataEntity) {
                    setDataResults(prev => ['❌ Please select an entity first', ...prev])
                    return
                  }
                  let data
                  try {
                    data = JSON.parse(testData)
                  } catch (e) {
                    setDataResults(prev => ['❌ Invalid JSON in test data', ...prev])
                    return
                  }
                  setDataResults(prev => [`🔄 Validating data for ${dataEntity}...`, ...prev])
                  const result = await dynamicSchemaPOC.testValidateDataViaAPI(dataEntity, data)
                  setDataResults(prev => [`${result.success ? '✅' : '❌'} Validate data: ${result.success ? 'Success' : result.error}`, ...prev])
                }}
                disabled={loading}
                variant="outline"
              >
                Validate Data
              </Button>
              
              <Button
                onClick={() => setDataResults([])}
                variant="secondary"
              >
                Clear Results
              </Button>
            </div>
            
            {/* Data Results */}
            {dataResults.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Data Operations Results:</Label>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {dataResults.slice(0, 10).map((result, index) => (
                    <div key={index} className="text-xs font-mono p-2 bg-gray-50 rounded border">
                      {result}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Migration System Testing removed - now using immediate execution */}
      {/* All table creation and schema registration happens immediately during entity creation */}

      {/* Comprehensive Testing Suite */}
      {initialized && (
        <Card>
          <CardHeader>
            <CardTitle>4. Comprehensive Testing Suite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={async () => {
                  if (isRunningComprehensiveTests) return
                  setIsRunningComprehensiveTests(true)
                  setComprehensiveResults(prev => ['🧪 Testing all 8 universal archetypes...', ...prev])
                  try {
                    const result = await dynamicSchemaPOC.testAllUniversalArchetypes()
                    setComprehensiveResults(prev => [`${result.success ? '✅' : '❌'} All archetypes test: ${result.success ? 'PASSED' : result.error}`, ...prev])
                    if (result.success) {
                      // Update created entities list
                      const archetypes = ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection']
                      const newEntities = archetypes.map(a => `Test${a.charAt(0).toUpperCase() + a.slice(1)}`)
                      setCreatedEntities(prev => [...new Set([...prev, ...newEntities])])
                    }
                  } finally {
                    setIsRunningComprehensiveTests(false)
                  }
                }}
                disabled={loading || isRunningComprehensiveTests}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isRunningComprehensiveTests ? 'Testing...' : 'Test All Archetypes'}
              </Button>
              
              <Button
                onClick={async () => {
                  if (isRunningComprehensiveTests) return
                  setIsRunningComprehensiveTests(true)
                  setComprehensiveResults(prev => ['🧪 Running comprehensive stress test...', ...prev])
                  try {
                    const result = await dynamicSchemaPOC.runStressTest()
                    setComprehensiveResults(prev => [`${result.success ? '✅' : '❌'} Stress test: ${result.success ? 'ALL PASSED' : result.error}`, ...prev])
                  } finally {
                    setIsRunningComprehensiveTests(false)
                  }
                }}
                disabled={loading || isRunningComprehensiveTests}
                className="bg-red-600 hover:bg-red-700"
              >
                {isRunningComprehensiveTests ? 'Testing...' : 'Stress Test'}
              </Button>
              
              <Button
                onClick={handleRunFullTests}
                disabled={loading || isRunningComprehensiveTests}
                variant="outline"
              >
                {loading ? 'Running...' : 'Run Basic Tests'}
              </Button>
              
              <Button
                onClick={() => setComprehensiveResults([])}
                variant="secondary"
              >
                Clear Results
              </Button>
            </div>
            
            {/* Comprehensive Test Results */}
            {comprehensiveResults.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Comprehensive Test Results:</Label>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {comprehensiveResults.slice(0, 20).map((result, index) => (
                    <div key={index} className="text-xs font-mono p-2 bg-gray-50 rounded border">
                      {result}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schema Changes Log */}
      {schemaChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schema Changes Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {schemaChanges.map((change, index) => (
                <Alert key={index}>
                  <AlertDescription>
                    <Badge className="mr-2">{change.type}</Badge>
                    {change.entityName}.{change.fieldName}
                    {change.oldType && change.newType && (
                      <span className="ml-2 text-muted-foreground">
                        ({change.oldType} → {change.newType})
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schema & Entity Operation Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <Alert key={index} variant={result.success ? "default" : "destructive"}>
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className="mr-2" variant={result.success ? "default" : "destructive"}>
                          {result.success ? '✓' : '✗'}
                        </Badge>
                        {result.success ? 'Success' : result.error}
                        {result.changes && result.changes.length > 0 && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {result.changes.length} changes applied
                          </div>
                        )}
                      </div>
                      {result.duration && (
                        <Badge variant="outline" className="text-xs">
                          {result.duration}ms
                        </Badge>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}