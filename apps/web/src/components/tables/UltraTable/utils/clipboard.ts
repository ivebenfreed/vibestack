/**
 * Native Clipboard API utilities for UltraTable
 * 
 * Provides copy/paste functionality with:
 * - Excel-compatible TSV format
 * - JSON format for rich data
 * - HTML table format for visual pasting
 * - Type-safe data handling
 */

import { selectionState$ } from '../state/selection-state'
import { uiLog } from '@/logger';
const log = uiLog('components/tables/UltraTable/utils/clipboard.ts');

export interface CopyOptions {
  format?: 'tsv' | 'json' | 'html' | 'all'
  includeHeaders?: boolean
  onlySelected?: boolean
}

export interface PasteResult {
  success: boolean
  data?: any[][]
  error?: string
  format?: 'tsv' | 'json' | 'html' | 'text'
}

/**
 * Copy selected cells to clipboard
 * Supports multiple formats for maximum compatibility
 */
export async function copyToClipboard(
  tableData: any[], 
  columns: any[], 
  options: CopyOptions = {}
): Promise<boolean> {
  const { format = 'all', includeHeaders = true, onlySelected = true } = options
  
  try {
    // Get selected cells or all data
    const selectedCells = selectionState$.selectedCells.peek()
    const activeRange = selectionState$.activeRange.peek()
    const selectedRows = selectionState$.selectedRows.peek()
    
    // Check for any type of selection: cells, ranges, or rows
    const hasSelection = selectedCells.size > 0 || 
                        activeRange || 
                        selectedRows.size > 0
    
    if (onlySelected && !hasSelection) {
      log.warn('[Clipboard] No cells or rows selected for copy operation')
      return false
    }
    
    // Determine data range
    let dataRange: { startRow: number; endRow: number; startCol: number; endCol: number }
    
    if (activeRange) {
      dataRange = activeRange
    } else if (selectedCells.size > 0) {
      // Calculate bounding box of selected cells
      const positions = Array.from(selectedCells).map(key => {
        const [row, col] = key.split(':').map(Number)
        return { row, col }
      })
      
      dataRange = {
        startRow: Math.min(...positions.map(p => p.row)),
        endRow: Math.max(...positions.map(p => p.row)),
        startCol: Math.min(...positions.map(p => p.col)),
        endCol: Math.max(...positions.map(p => p.col))
      }
    } else if (selectedRows.size > 0) {
      // Handle row-level selection
      const selectedRowIndices = Array.from(selectedRows)
        .map(id => {
          // Find row index by ID
          const index = tableData.findIndex(row => String(row.id || '') === id)
          return index
        })
        .filter(index => index >= 0)
        .sort((a, b) => a - b)
      
      if (selectedRowIndices.length > 0) {
        dataRange = {
          startRow: Math.min(...selectedRowIndices),
          endRow: Math.max(...selectedRowIndices),
          startCol: 0,
          endCol: columns.length - 1
        }
      } else {
        log.warn('[Clipboard] No valid rows found for selected IDs')
        return false
      }
    } else {
      // Select all data
      dataRange = {
        startRow: 0,
        endRow: tableData.length - 1,
        startCol: 0,
        endCol: columns.length - 1
      }
    }
    
    // Extract data for the range
    const extractedData: any[][] = []
    
    // Add headers if requested
    if (includeHeaders) {
      const headerRow = columns
        .slice(dataRange.startCol, dataRange.endCol + 1)
        .map(col => col.header || col.key)
      extractedData.push(headerRow)
    }
    
    // Add data rows  
    if (selectedRows.size > 0 && !activeRange && selectedCells.size === 0) {
      // For row-level selection, extract only selected rows (non-contiguous)
      const selectedRowIndices = Array.from(selectedRows)
        .map(id => tableData.findIndex(row => String(row.id || '') === id))
        .filter(index => index >= 0)
        .sort((a, b) => a - b)
      
      selectedRowIndices.forEach(row => {
        const rowData = tableData[row]
        if (!rowData) return
        
        const dataRow = columns
          .slice(dataRange.startCol, dataRange.endCol + 1)
          .map(col => {
            const value = getNestedValue(rowData, col.field)
            return formatValueForClipboard(value, col.type)
          })
        extractedData.push(dataRow)
      })
    } else {
      // For cell/range selection, extract contiguous range
      for (let row = dataRange.startRow; row <= dataRange.endRow; row++) {
        const rowData = tableData[row]
        if (!rowData) continue
        
        const dataRow = columns
          .slice(dataRange.startCol, dataRange.endCol + 1)
          .map(col => {
            const value = getNestedValue(rowData, col.field)
            return formatValueForClipboard(value, col.type)
          })
        extractedData.push(dataRow)
      }
    }
    
    // Prepare clipboard data in multiple formats
    const clipboardItems: ClipboardItem[] = []
    
    if (format === 'tsv' || format === 'all') {
      const tsvData = extractedData
        .map(row => row.join('\t'))
        .join('\n')
      
      clipboardItems.push(new ClipboardItem({
        'text/tab-separated-values': new Blob([tsvData], { type: 'text/tab-separated-values' }),
        'text/plain': new Blob([tsvData], { type: 'text/plain' })
      }))
    }
    
    if (format === 'json' || format === 'all') {
      const jsonData = JSON.stringify(extractedData, null, 2)
      clipboardItems.push(new ClipboardItem({
        'application/json': new Blob([jsonData], { type: 'application/json' })
      }))
    }
    
    if (format === 'html' || format === 'all') {
      const htmlTable = createHtmlTable(extractedData, includeHeaders)
      clipboardItems.push(new ClipboardItem({
        'text/html': new Blob([htmlTable], { type: 'text/html' })
      }))
    }
    
    // Write to clipboard
    if (clipboardItems.length === 1) {
      await navigator.clipboard.write([clipboardItems[0]])
    } else {
      // For 'all' format, combine into single ClipboardItem
      const tsvData = extractedData.map(row => row.join('\t')).join('\n')
      const jsonData = JSON.stringify(extractedData, null, 2)
      const htmlTable = createHtmlTable(extractedData, includeHeaders)
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/tab-separated-values': new Blob([tsvData], { type: 'text/tab-separated-values' }),
          'text/plain': new Blob([tsvData], { type: 'text/plain' }),
          'application/json': new Blob([jsonData], { type: 'application/json' }),
          'text/html': new Blob([htmlTable], { type: 'text/html' })
        })
      ])
    }
    
    return true
  } catch (error) {
    log.error('[Clipboard] Copy failed:', error)
    return false
  }
}

/**
 * Paste from clipboard and parse data
 * Handles multiple input formats automatically
 */
export async function pasteFromClipboard(): Promise<PasteResult> {
  try {
    const clipboardItems = await navigator.clipboard.read()
    
    for (const item of clipboardItems) {
      // Try JSON format first (richest data)
      if (item.types.includes('application/json')) {
        const jsonBlob = await item.getType('application/json')
        const jsonText = await jsonBlob.text()
        try {
          const data = JSON.parse(jsonText)
          return { success: true, data, format: 'json' }
        } catch (e) {
          log.warn('[Clipboard] Invalid JSON format, trying other formats')
        }
      }
      
      // Try TSV format (Excel compatible)
      if (item.types.includes('text/tab-separated-values')) {
        const tsvBlob = await item.getType('text/tab-separated-values')
        const tsvText = await tsvBlob.text()
        const data = parseTsv(tsvText)
        return { success: true, data, format: 'tsv' }
      }
      
      // Try HTML table format
      if (item.types.includes('text/html')) {
        const htmlBlob = await item.getType('text/html')
        const htmlText = await htmlBlob.text()
        try {
          const data = parseHtmlTable(htmlText)
          return { success: true, data, format: 'html' }
        } catch (e) {
          log.warn('[Clipboard] Invalid HTML table format, trying plain text')
        }
      }
      
      // Fall back to plain text
      if (item.types.includes('text/plain')) {
        const textBlob = await item.getType('text/plain')
        const text = await textBlob.text()
        
        // Try to detect format from content
        if (text.includes('\t')) {
          const data = parseTsv(text)
          return { success: true, data, format: 'tsv' }
        } else {
          // Single value or CSV-like data
          const data = text.split('\n').map(line => line.split(',').map(cell => cell.trim()))
          return { success: true, data, format: 'text' }
        }
      }
    }
    
    return { success: false, error: 'No supported format found in clipboard' }
  } catch (error) {
    log.error('[Clipboard] Paste failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Format value for clipboard output
 */
function formatValueForClipboard(value: any, type?: string): string {
  if (value === null || value === undefined) return ''
  
  switch (type) {
    case 'date':
      if (value instanceof Date) {
        return value.toISOString()
      }
      return new Date(value).toISOString()
    
    case 'number':
      return String(value)
    
    case 'boolean':
      return value ? 'true' : 'false'
    
    case 'object':
      if (Array.isArray(value)) {
        return `[${value.length} items]`
      }
      return JSON.stringify(value)
    
    default:
      return String(value)
  }
}

/**
 * Parse TSV data into 2D array
 */
function parseTsv(text: string): any[][] {
  return text
    .trim()
    .split('\n')
    .map(line => line.split('\t'))
}

/**
 * Parse HTML table into 2D array
 */
function parseHtmlTable(html: string): any[][] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  
  if (!table) {
    throw new Error('No table found in HTML')
  }
  
  const rows = Array.from(table.querySelectorAll('tr'))
  return rows.map(row => {
    const cells = Array.from(row.querySelectorAll('td, th'))
    return cells.map(cell => cell.textContent?.trim() || '')
  })
}

/**
 * Create HTML table from 2D data array
 */
function createHtmlTable(data: any[][], hasHeaders: boolean): string {
  if (data.length === 0) return '<table></table>'
  
  let html = '<table border="1" cellpadding="4" cellspacing="0">'
  
  data.forEach((row, index) => {
    const isHeader = hasHeaders && index === 0
    const tagName = isHeader ? 'th' : 'td'
    
    html += '<tr>'
    row.forEach(cell => {
      const escaped = String(cell || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      html += `<${tagName}>${escaped}</${tagName}>`
    })
    html += '</tr>'
  })
  
  html += '</table>'
  return html
}