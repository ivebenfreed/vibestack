# Phase 4: Import/Export & Data Exchange (Native APIs + Minimal Libraries)

## Overview

Implement comprehensive data import/export using native browser APIs and minimal, focused libraries. Prioritize native Clipboard API, File API, and Streams API over heavy external dependencies.

## Features to Implement

### 4.1 Enhanced Clipboard Operations

**Current**: Basic copy/paste
**Target**: Excel-level clipboard with format preservation

```typescript
// Advanced clipboard state
const clipboard$ = observable({
  // Standard clipboard data
  data: [] as Array<{
    row: number
    col: number
    value: any
    field: string
    format?: any
    formula?: string
  }>,
  
  // Rich format preservation
  formats: {
    plainText: '',
    html: '',
    rtf: '',
    custom: {} as Record<string, any>
  },
  
  // Clipboard metadata
  source: {
    tableId: '',
    selection: null as any,
    timestamp: 0,
    preserveFormulas: false
  },
  
  // Operation state
  operation: 'copy' as 'copy' | 'cut',
  isExternal: false // Data from external source
})

// Native Clipboard API with multiple formats
async function copySelectionAdvanced(preserveFormulas = false) {
  const selectedCells = selectedCells$.get()
  const data = tableData$.get()
  const columns = tableColumns$.get()
  const formulas = tableFormulas$.formulas.get()
  
  // Prepare multi-format data
  const clipboardData = Array.from(selectedCells).map(cellKey => {
    const [rowIndex, colIndex] = cellKey.split(':').map(Number)
    const row = data[rowIndex]
    const column = columns[colIndex]
    const formula = formulas[cellKey]
    
    return {
      row: rowIndex,
      col: colIndex,
      value: row[column.field],
      field: column.field,
      format: column.format,
      formula: preserveFormulas ? formula?.expression : undefined
    }
  })
  
  // Generate multiple clipboard formats
  const plainText = convertToTSV(clipboardData) // Tab-separated
  const htmlTable = convertToHTMLTable(clipboardData)
  const csvData = convertToCSV(clipboardData)
  const jsonData = JSON.stringify(clipboardData)
  
  // Update Legend State clipboard
  clipboard$.assign({
    data: clipboardData,
    formats: {
      plainText,
      html: htmlTable,
      rtf: '', // Could add RTF support
      custom: { csv: csvData, json: jsonData }
    },
    source: {
      tableId: 'ultra-table',
      selection: tableSelection$.ranges.get(),
      timestamp: Date.now(),
      preserveFormulas
    },
    operation: 'copy',
    isExternal: false
  })
  
  // Write to native clipboard with multiple formats
  const clipboardItems = []
  
  // Plain text (TSV for Excel compatibility)
  clipboardItems.push(new ClipboardItem({
    'text/plain': new Blob([plainText], { type: 'text/plain' }),
    'text/html': new Blob([htmlTable], { type: 'text/html' }),
    'text/csv': new Blob([csvData], { type: 'text/csv' })
  }))
  
  await navigator.clipboard.write(clipboardItems)
}

// Smart paste with format detection
async function pasteWithFormatDetection(targetCell: { row: number; col: number }) {
  try {
    const clipboardItems = await navigator.clipboard.read()
    
    // Try different formats in priority order
    for (const item of clipboardItems) {
      // HTML tables (from Excel, Google Sheets)
      if (item.types.includes('text/html')) {
        const htmlBlob = await item.getType('text/html')
        const htmlText = await htmlBlob.text()
        const parsedData = parseHTMLTable(htmlText)
        
        if (parsedData.length > 0) {
          await applyPastedData(targetCell, parsedData, 'html')
          return
        }
      }
      
      // CSV format
      if (item.types.includes('text/csv')) {
        const csvBlob = await item.getType('text/csv')
        const csvText = await csvBlob.text()
        const parsedData = parseCSV(csvText)
        
        if (parsedData.length > 0) {
          await applyPastedData(targetCell, parsedData, 'csv')
          return
        }
      }
      
      // Plain text (TSV/CSV)
      if (item.types.includes('text/plain')) {
        const textBlob = await item.getType('text/plain')
        const textData = await textBlob.text()
        const parsedData = parseDelimitedText(textData)
        
        await applyPastedData(targetCell, parsedData, 'text')
        return
      }
    }
  } catch (error) {
    console.error('Paste failed:', error)
    // Fallback to basic paste
    pasteData(targetCell)
  }
}
```

### 4.2 File Import/Export (Native File API)

**Current**: No file operations
**Target**: Excel, CSV, JSON import/export

```typescript
// File operations state
const fileOperations$ = observable({
  importing: false,
  exporting: false,
  lastImport: null as {
    filename: string
    format: string
    rowCount: number
    timestamp: number
  } | null,
  supportedFormats: {
    import: ['csv', 'tsv', 'json', 'xlsx'],
    export: ['csv', 'json', 'xlsx', 'html']
  }
})

// Native File API for import
function importFromFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.json,.xlsx,.tsv'
    input.multiple = false
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return reject('No file selected')
      
      fileOperations$.importing.set(true)
      
      try {
        const result = await processImportFile(file)
        
        fileOperations$.lastImport.set({
          filename: file.name,
          format: getFileFormat(file.name),
          rowCount: result.length,
          timestamp: Date.now()
        })
        
        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        fileOperations$.importing.set(false)
      }
    }
    
    input.click()
  })
}

// File format detection and processing
async function processImportFile(file: File): Promise<any[]> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'csv':
    case 'tsv':
      return await parseCSVFile(file)
      
    case 'json':
      return await parseJSONFile(file)
      
    case 'xlsx':
      // Only load xlsx library if needed
      const XLSX = await import('xlsx')
      return await parseExcelFile(file, XLSX)
      
    default:
      throw new Error(`Unsupported file format: ${extension}`)
  }
}

// CSV parsing with native APIs
async function parseCSVFile(file: File): Promise<any[]> {
  const text = await file.text()
  const delimiter = file.name.endsWith('.tsv') ? '\t' : ','
  
  // Simple CSV parser (could use papaparse if needed)
  const lines = text.split('\n').filter(line => line.trim())
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''))
  
  return lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''))
    const row: any = {}
    
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    
    return row
  })
}

// Native export with File API
async function exportToFile(format: 'csv' | 'json' | 'xlsx' | 'html') {
  const data = sortedData$.get()
  const columns = tableColumns$.get()
  
  fileOperations$.exporting.set(true)
  
  try {
    let content: string | Uint8Array
    let mimeType: string
    let filename: string
    
    switch (format) {
      case 'csv':
        content = convertToCSV(data, columns)
        mimeType = 'text/csv'
        filename = `export-${Date.now()}.csv`
        break
        
      case 'json':
        content = JSON.stringify(data, null, 2)
        mimeType = 'application/json'
        filename = `export-${Date.now()}.json`
        break
        
      case 'html':
        content = convertToHTMLTable(data, columns, true) // Full HTML document
        mimeType = 'text/html'
        filename = `export-${Date.now()}.html`
        break
        
      case 'xlsx':
        const XLSX = await import('xlsx')
        content = await generateExcelFile(data, columns, XLSX)
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = `export-${Date.now()}.xlsx`
        break
        
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
    
    // Create and download file
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    
    URL.revokeObjectURL(url)
    
  } finally {
    fileOperations$.exporting.set(false)
  }
}
```

### 4.3 Excel Integration (xlsx - Single Library)

**Current**: No Excel support
**Target**: Full Excel import/export with formulas

```typescript
// Excel operations with xlsx library (only when needed)
async function importExcelFile(file: File) {
  const XLSX = await import('xlsx') // Dynamic import
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  
  // Get first worksheet
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // Convert to JSON with formulas preserved
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, // Array of arrays
    defval: '', // Default value for empty cells
    raw: false // Keep formatted values
  })
  
  // Extract formulas if they exist
  const formulas: Record<string, string> = {}
  Object.entries(worksheet).forEach(([cellRef, cell]: [string, any]) => {
    if (cell.f) { // Formula exists
      const { r: row, c: col } = XLSX.utils.decode_cell(cellRef)
      formulas[`${row}:${col}`] = `=${cell.f}`
    }
  })
  
  return {
    data: jsonData,
    formulas,
    sheetName
  }
}

async function exportToExcel(data: any[], columns: any[], includeFormulas = true) {
  const XLSX = await import('xlsx')
  
  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(data)
  
  // Add formulas if requested
  if (includeFormulas) {
    const formulas = tableFormulas$.formulas.get()
    
    Object.entries(formulas).forEach(([cellKey, formula]) => {
      if (formula.expression.startsWith('=')) {
        const [row, col] = cellKey.split(':').map(Number)
        const cellRef = XLSX.utils.encode_cell({ r: row + 1, c: col }) // +1 for header
        
        if (worksheet[cellRef]) {
          worksheet[cellRef].f = formula.expression.slice(1) // Remove '='
        }
      }
    })
  }
  
  // Create workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
  
  // Generate Excel file
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}
```

### 4.4 Real-Time Export (Streaming)

**Current**: Export all at once
**Target**: Streaming export for large datasets

```typescript
// Streaming export for large datasets
const streamingExport$ = observable({
  isActive: false,
  progress: 0,
  totalRows: 0,
  processedRows: 0,
  format: 'csv' as 'csv' | 'json',
  chunkSize: 1000
})

// Streaming CSV export using Streams API
async function exportCSVStreaming(data: any[], columns: any[]) {
  const readable = new ReadableStream({
    start(controller) {
      // CSV header
      const header = columns.map(col => col.header).join(',') + '\n'
      controller.enqueue(new TextEncoder().encode(header))
    },
    
    pull(controller) {
      const processed = streamingExport$.processedRows.get()
      const chunkSize = streamingExport$.chunkSize.get()
      const chunk = data.slice(processed, processed + chunkSize)
      
      if (chunk.length === 0) {
        controller.close()
        return
      }
      
      // Convert chunk to CSV
      const csvChunk = chunk.map(row => 
        columns.map(col => {
          const value = row[col.field]
          return typeof value === 'string' && value.includes(',') ? 
            `"${value.replace(/"/g, '""')}"` : value
        }).join(',')
      ).join('\n') + '\n'
      
      controller.enqueue(new TextEncoder().encode(csvChunk))
      
      // Update progress
      batch(() => {
        streamingExport$.processedRows.set(processed + chunk.length)
        streamingExport$.progress.set((processed + chunk.length) / data.length * 100)
      })
    }
  })
  
  // Stream to file
  const response = new Response(readable)
  const blob = await response.blob()
  
  // Download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `export-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Progress component for large exports
function ExportProgress() {
  const exportState = streamingExport$.use()
  
  if (!exportState.isActive) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg shadow-xl min-w-80">
        <h3 className="text-lg font-semibold mb-4">Exporting Data</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(exportState.progress)}%</span>
          </div>
          
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${exportState.progress}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{exportState.processedRows.toLocaleString()} of {exportState.totalRows.toLocaleString()} rows</span>
            <span>Format: {exportState.format.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 4.5 Data Validation & Import Preview

**Current**: Direct import
**Target**: Preview and validation before import

```typescript
// Import preview state
const importPreview$ = observable({
  isOpen: false,
  file: null as File | null,
  data: [] as any[],
  columns: [] as Array<{
    source: string // Column from import file
    target: string // Target field in table
    type: 'string' | 'number' | 'date' | 'boolean'
    preview: any[] // First 5 values
    errors: string[]
  }>,
  mapping: {} as Record<string, string>,
  validation: {
    totalRows: 0,
    validRows: 0,
    errors: [] as Array<{
      row: number
      column: string
      error: string
      value: any
    }>
  }
})

// Import preview component
function ImportPreview() {
  const preview = importPreview$.use()
  
  if (!preview.isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg shadow-xl max-w-4xl max-h-[80vh] overflow-auto">
        <h3 className="text-lg font-semibold mb-4">Import Preview: {preview.file?.name}</h3>
        
        {/* Column mapping */}
        <div className="mb-6">
          <h4 className="text-md font-medium mb-3">Column Mapping</h4>
          <div className="grid gap-3">
            {preview.columns.map((column, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="min-w-32 font-mono text-sm">
                  {column.source}
                </div>
                <span>→</span>
                <select 
                  value={preview.mapping[column.source] || ''}
                  onChange={(e) => updateColumnMapping(column.source, e.target.value)}
                  className="flex-1 p-2 border rounded"
                >
                  <option value="">Skip column</option>
                  {tableColumns$.get().map(col => (
                    <option key={col.field} value={col.field}>
                      {col.header} ({col.type})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-muted-foreground min-w-20">
                  {column.type}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Validation results */}
        <div className="mb-6">
          <h4 className="text-md font-medium mb-3">Validation</h4>
          <div className="flex gap-6 text-sm">
            <span className="text-green-600">
              ✓ {preview.validation.validRows} valid rows
            </span>
            {preview.validation.errors.length > 0 && (
              <span className="text-red-600">
                ⚠ {preview.validation.errors.length} errors
              </span>
            )}
          </div>
          
          {/* Error details */}
          {preview.validation.errors.length > 0 && (
            <div className="mt-3 max-h-32 overflow-auto bg-muted p-3 rounded text-xs">
              {preview.validation.errors.slice(0, 10).map((error, index) => (
                <div key={index} className="text-red-600">
                  Row {error.row}: {error.column} - {error.error}
                </div>
              ))}
              {preview.validation.errors.length > 10 && (
                <div className="text-muted-foreground">
                  ... and {preview.validation.errors.length - 10} more errors
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Data preview */}
        <div className="mb-6">
          <h4 className="text-md font-medium mb-3">Preview (First 5 rows)</h4>
          <div className="border rounded overflow-auto max-h-40">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted">
                  {preview.columns.map(col => (
                    <th key={col.source} className="p-2 text-left">
                      {col.source}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.slice(0, 5).map((row, index) => (
                  <tr key={index} className="border-t">
                    {preview.columns.map(col => (
                      <td key={col.source} className="p-2">
                        {String(row[col.source] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={cancelImport}>
            Cancel
          </Button>
          <Button 
            onClick={confirmImport}
            disabled={preview.validation.validRows === 0}
          >
            Import {preview.validation.validRows} rows
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### 4.6 Integration with External APIs

**Current**: Manual data entry
**Target**: API import/export with validation

```typescript
// API integration state
const apiIntegration$ = observable({
  connections: {} as Record<string, {
    id: string
    name: string
    type: 'rest' | 'graphql' | 'webhook'
    url: string
    headers: Record<string, string>
    mapping: Record<string, string> // API field -> table field
    lastSync: number
    status: 'connected' | 'disconnected' | 'error'
  }>,
  
  sync: {
    inProgress: false,
    direction: 'import' as 'import' | 'export' | 'bidirectional',
    lastRun: 0,
    nextRun: 0,
    interval: 0 // 0 = manual only
  }
})

// Generic API import
async function importFromAPI(connectionId: string) {
  const connection = apiIntegration$.connections[connectionId].get()
  if (!connection) throw new Error('Connection not found')
  
  apiIntegration$.sync.inProgress.set(true)
  
  try {
    const response = await fetch(connection.url, {
      headers: {
        'Content-Type': 'application/json',
        ...connection.headers
      }
    })
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }
    
    const apiData = await response.json()
    
    // Transform API data using mapping
    const transformedData = apiData.map((item: any) => {
      const row: any = {}
      
      Object.entries(connection.mapping).forEach(([apiField, tableField]) => {
        row[tableField] = item[apiField]
      })
      
      return row
    })
    
    // Apply to table with batch for performance
    batch(() => {
      tableData$.set(transformedData)
      apiIntegration$.connections[connectionId].lastSync.set(Date.now())
    })
    
  } finally {
    apiIntegration$.sync.inProgress.set(false)
  }
}

// Export to API
async function exportToAPI(connectionId: string, data: any[]) {
  const connection = apiIntegration$.connections[connectionId].get()
  
  // Transform table data to API format
  const apiData = data.map(row => {
    const apiRow: any = {}
    
    Object.entries(connection.mapping).forEach(([apiField, tableField]) => {
      apiRow[apiField] = row[tableField]
    })
    
    return apiRow
  })
  
  // Send to API
  const response = await fetch(connection.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...connection.headers
    },
    body: JSON.stringify(apiData)
  })
  
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`)
  }
  
  return response.json()
}
```

## Implementation Priority

### High Priority (Week 4)
1. ✅ Enhanced clipboard with multiple formats
2. ✅ Native File API for CSV/JSON import/export
3. ✅ Import preview and validation
4. ✅ Streaming export for large datasets

### Medium Priority (Week 5)
1. Excel integration with xlsx library
2. Formula preservation in import/export
3. API integration framework
4. Data transformation pipelines

### Lower Priority (Week 6)
1. Advanced Excel features (multiple sheets, charts)
2. Custom export templates
3. Scheduled API sync
4. Import conflict resolution

## Library Strategy

### Confirmed Libraries (2 total)
1. **xlsx** (~100kb) - Excel import/export when needed
2. **papaparse** (~30kb) - Robust CSV parsing for complex files

### Native APIs Used
- **Clipboard API** - Multi-format copy/paste
- **File API** - File selection and reading
- **Streams API** - Large file processing
- **Fetch API** - External data integration
- **Web Workers** - Background processing (if needed)

### Performance Optimizations
```typescript
// Lazy loading of heavy libraries
const loadXLSX = () => import('xlsx') // Only when Excel needed
const loadPapaparse = () => import('papaparse') // Only for complex CSV

// Web Worker for large file processing
const fileWorker = new Worker('/workers/file-processor.js')

// Chunked processing with Legend State progress
async function processLargeFile(file: File, chunkSize = 1000) {
  const totalSize = file.size
  let processed = 0
  
  const stream = file.stream()
  const reader = stream.getReader()
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    // Process chunk
    await processChunk(value)
    
    processed += value.length
    streamingExport$.progress.set((processed / totalSize) * 100)
  }
}
```

## Testing Strategy

### File Format Tests
- CSV with various delimiters and encodings
- Excel files with formulas and formatting
- JSON with nested structures
- Large files (100MB+) with streaming

### Integration Tests
- Round-trip: export → import → verify data integrity
- Formula preservation across formats
- Multi-format clipboard operations
- API integration with mock endpoints

### Performance Tests
- 50k+ row export in <10 seconds
- Streaming import without memory spikes
- Large clipboard operations (<500ms)
- Background processing without UI blocking

This phase provides comprehensive data exchange capabilities using minimal libraries and maximizing native browser APIs for optimal performance and bundle size.