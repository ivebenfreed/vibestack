import { useCallback, useState } from 'react'
import type { BaseEntity, OptimusColumn } from '../types'

interface CopiedCellData<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
}

/**
 * Hook for handling clipboard operations (copy/paste)
 */
export function useClipboardOps<TEntity extends BaseEntity>() {
  const [copiedCell, setCopiedCell] = useState<CopiedCellData<TEntity> | null>(null)
  
  const handleCellCopy = useCallback((
    row: TEntity,
    column: OptimusColumn<TEntity>,
    event: React.ClipboardEvent<HTMLDivElement>
  ): void => {
    // Prevent copy if text is selected
    if (window.getSelection()?.isCollapsed === false) {
      setCopiedCell(null)
      return
    }
    
    // Store copied cell data for internal paste operations
    setCopiedCell({ row, column })
    
    // Set clipboard data based on cell type
    const cellValue = row[column.key]
    let clipboardValue = ''
    
    if (column.cellType?.startsWith('relationship')) {
      // For relationships, copy the display value
      if (typeof cellValue === 'object' && cellValue !== null) {
        clipboardValue = (cellValue as any).name || (cellValue as any).id || String(cellValue)
      } else {
        clipboardValue = String(cellValue || '')
      }
    } else if (column.cellType === 'enum' && column.config?.enumValues) {
      // For enums, copy the label
      clipboardValue = column.config.enumValues[String(cellValue)] || String(cellValue)
    } else {
      clipboardValue = String(cellValue || '')
    }
    
    // Set clipboard data
    event.preventDefault()
    event.stopPropagation()
    event.clipboardData.clearData()
    event.clipboardData.setData('text/plain', clipboardValue)
    
    console.log('[VibeGridOptimus] 📋 Copied:', clipboardValue)
  }, [])
  
  const handleCellPaste = useCallback((
    row: TEntity,
    column: OptimusColumn<TEntity>,
    event: React.ClipboardEvent<HTMLDivElement>
  ): TEntity => {
    // Don't allow pasting to system fields
    if (column.systemField) {
      return row
    }
    
    // Don't allow pasting to non-editable fields
    if (!column.config?.editable) {
      return row
    }
    
    // If we have a copied cell from within the grid, use that value
    if (copiedCell !== null && copiedCell.column.cellType === column.cellType) {
      const sourceValue = copiedCell.row[copiedCell.column.key]
      
      // For relationship fields, handle ID copying correctly
      if (column.cellType?.startsWith('relationship') && column.accessorKey) {
        const idValue = copiedCell.row[copiedCell.column.accessorKey]
        return { ...row, [column.accessorKey]: idValue } as TEntity
      }
      
      return { ...row, [column.key]: sourceValue } as TEntity
    }
    
    // Handle external clipboard text
    const clipboardText = event.clipboardData.getData('text/plain')
    if (clipboardText && column.cellType === 'text') {
      return { ...row, [column.key]: clipboardText } as TEntity
    }
    
    return row
  }, [copiedCell])
  
  const clearCopiedCell = useCallback(() => {
    setCopiedCell(null)
  }, [])
  
  return {
    copiedCell,
    handleCellCopy,
    handleCellPaste,
    clearCopiedCell
  }
}