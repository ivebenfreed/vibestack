/**
 * Debug Grid Toggle Component
 * Adds debug outlines to visualize the grid layout system
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function GridDebugToggle() {
  const [isDebugMode, setIsDebugMode] = useState(false)

  useEffect(() => {
    // Add or remove debug class from document body
    if (isDebugMode) {
      document.body.classList.add('debug-grid')
    } else {
      document.body.classList.remove('debug-grid')
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('debug-grid')
    }
  }, [isDebugMode])

  // Only show in development
  if (import.meta.env.PROD) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2">
      <Badge variant={isDebugMode ? "default" : "outline"}>
        Grid Debug: {isDebugMode ? 'ON' : 'OFF'}
      </Badge>
      <Button
        size="sm"
        variant={isDebugMode ? "default" : "outline"}
        onClick={() => setIsDebugMode(!isDebugMode)}
      >
        {isDebugMode ? '🔍 Hide Grid' : '🔍 Show Grid'}
      </Button>
    </div>
  )
}

export default GridDebugToggle