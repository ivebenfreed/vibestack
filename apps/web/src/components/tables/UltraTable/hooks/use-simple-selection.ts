/**
 * Actually Simple Selection Hook
 */

import { useState, useCallback, useRef } from 'react'

export function useSimpleSelection() {
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  
  const handleClick = useCallback((rowIndex: number, columnIndex: number) => {
    const cellKey = `${rowIndex}:${columnIndex}`
    setSelectedCell(cellKey)
  }, [])
  
  const isSelected = useCallback((cellKey: string) => {
    return selectedCell === cellKey
  }, [selectedCell])
  
  const clearSelection = useCallback(() => {
    setSelectedCell(null)
  }, [])
  
  return {
    handleClick,
    isSelected,
    clearSelection,
    getSelectionCount: () => selectedCell ? 1 : 0,
    selectAll: () => {},
    containerRef: useRef<HTMLDivElement>(null)
  }
}