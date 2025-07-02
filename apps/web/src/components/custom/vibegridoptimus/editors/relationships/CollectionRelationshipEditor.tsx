import React from 'react'
import type { BaseEntity, OptimusColumn } from '../../types'

interface CollectionRelationshipEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
}

/**
 * Dedicated editor for collection relationship fields (one-to-many)
 * Currently read-only with option to browse - complex editing would need a modal
 */
export function CollectionRelationshipEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose
}: CollectionRelationshipEditorProps<TEntity>) {
  // Get the current value
  const currentKey = column.accessorKey || column.key
  const currentValue = row[currentKey] || []
  const count = Array.isArray(currentValue) ? currentValue.length : 0
  
  React.useEffect(() => {
    // Auto-close since collections are read-only for now
    const timer = setTimeout(() => onClose(false), 1000)
    return () => clearTimeout(timer)
  }, [onClose])
  
  return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      <div className="text-center">
        <div>{count} {count === 1 ? 'item' : 'items'}</div>
        <div className="text-xs mt-1">Collection is read-only</div>
      </div>
    </div>
  )
}