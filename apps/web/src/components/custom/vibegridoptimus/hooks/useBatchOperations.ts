/**
 * useBatchOperations - Intelligent batch update operations for performance
 * 
 * Handles batching of multiple updates to reduce API calls
 * Enhanced version from VibeGridFinal with intelligent timing and error handling
 */

import React from 'react'

interface BatchOperation {
  id: string
  column: string
  value: any
  timestamp: number
}

interface UseBatchOperationsReturn {
  processBatch: (id: string, column: string, value: any) => Promise<void>
  pendingUpdates: number
  clearBatch: () => void
}

// Performance constants
const PERFORMANCE = {
  BATCH_SIZE_THRESHOLD: 10, // operations
  BATCH_TIMEOUT: 300, // ms
  MAX_BATCH_SIZE: 50 // maximum operations per batch
} as const

/**
 * Intelligent batch operations hook for performance optimization
 */
export function useBatchOperations(
  onSave?: (id: string, column: string, value: any) => Promise<void>
): UseBatchOperationsReturn {
  const [batch, setBatch] = React.useState<BatchOperation[]>([])
  const [isProcessing, setIsProcessing] = React.useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout>()

  // Process accumulated batch operations
  const flushBatch = React.useCallback(async (operations: BatchOperation[]) => {
    if (operations.length === 0 || !onSave) return

    setIsProcessing(true)
    try {
      if (operations.length === 1) {
        // Single operation - use direct call for optimal performance
        const { id, column, value } = operations[0]
        await onSave(id, column, value)
      } else {
        // Multiple operations - process in parallel with error handling
        const results = await Promise.allSettled(
          operations.map(({ id, column, value }) => onSave(id, column, value))
        )
        
        // Log any failures for debugging
        const failures = results.filter(result => result.status === 'rejected')
        if (failures.length > 0) {
          console.warn('[useBatchOperations] Some operations failed:', failures.length, 'out of', operations.length)
        }
      }
    } catch (error) {
      console.error('[useBatchOperations] Batch processing error:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [onSave])

  // Process batch with intelligent timing
  const processBatch = React.useCallback(async (id: string, column: string, value: any) => {
    const operation: BatchOperation = {
      id,
      column,
      value,
      timestamp: Date.now()
    }

    setBatch(prev => {
      const newBatch = [...prev, operation]
      
      // If we hit the batch size threshold, process immediately
      if (newBatch.length >= PERFORMANCE.BATCH_SIZE_THRESHOLD) {
        // Clear any pending timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }
        
        // Process batch immediately and clear
        flushBatch(newBatch)
        return []
      }
      
      return newBatch
    })

    // Set timeout for delayed processing (debounce)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setBatch(currentBatch => {
        if (currentBatch.length > 0) {
          flushBatch(currentBatch)
          return []
        }
        return currentBatch
      })
    }, PERFORMANCE.BATCH_TIMEOUT)
  }, [flushBatch])

  // Clear batch manually
  const clearBatch = React.useCallback(() => {
    setBatch([])
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  // Cleanup on unmount - flush any pending operations
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      // Note: We don't flush on unmount as the component might be unmounting
      // due to navigation and we don't want to trigger async operations
    }
  }, [])

  // Flush batch when component unmounts with pending operations
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      if (batch.length > 0) {
        // Attempt to flush batch before page unload
        flushBatch(batch)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [batch, flushBatch])

  return React.useMemo(() => ({
    processBatch,
    pendingUpdates: batch.length,
    clearBatch
  }), [processBatch, batch.length, clearBatch])
}