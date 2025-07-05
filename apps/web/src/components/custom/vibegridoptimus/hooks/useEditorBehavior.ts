import React from 'react'
import type { 
  EditorBehaviorConfig, 
  EditorBehaviorHook, 
  EditorKeyAction 
} from '../types/editor'

interface UseEditorBehaviorProps {
  config: EditorBehaviorConfig
  onCommit: (value?: any) => void
  onCancel: () => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
  rowId?: string
  fieldKey?: string
  initialValue?: any
  currentValue?: any
}

/**
 * Centralized editor behavior hook for VibeGridOptimus
 * 
 * Provides consistent edit behavior across all editor types including:
 * - Change tracking with hasChanges state
 * - Standardized keyboard handlers (Enter, Escape, Tab)
 * - Configurable commit modes (immediate, onBlur, manual)
 * - Consistent commit/cancel logic
 * 
 * Usage:
 * ```typescript
 * const behavior = useEditorBehavior({
 *   config: EDITOR_BEHAVIORS.text,
 *   onCommit: () => onClose(true),
 *   onCancel: () => onClose(false),
 *   initialValue: row[column.key],
 *   currentValue: currentState
 * })
 * ```
 */
export function useEditorBehavior({
  config,
  onCommit,
  onCancel,
  onUpdate,
  rowId,
  fieldKey,
  initialValue,
  currentValue
}: UseEditorBehaviorProps): EditorBehaviorHook {
  
  // Track whether changes have been made
  const [hasChanges, setHasChanges] = React.useState(false)
  
  // Track if we should prevent auto-close (for multi-select editors)
  const shouldPreventClose = config.preventAutoClose && hasChanges
  
  // Update hasChanges when currentValue differs from initialValue
  React.useEffect(() => {
    // Use simple equality for performance instead of JSON.stringify
    const valueChanged = currentValue !== initialValue
    setHasChanges(valueChanged)
  }, [currentValue, initialValue])
  
  // Manual change tracking for editors that need explicit control
  const markChanged = React.useCallback(() => {
    setHasChanges(true)
  }, [])
  
  const resetChanges = React.useCallback(() => {
    setHasChanges(false)
  }, [])
  
  // Execute the appropriate action based on key binding
  const executeAction = React.useCallback((action: EditorKeyAction, value?: any) => {
    switch (action) {
      case 'commit':
        if (hasChanges || config.commitMode === 'immediate') {
          onCommit(value)
        } else {
          onCancel() // No changes to commit
        }
        break
        
      case 'cancel':
        onCancel()
        break
        
      case 'navigate':
        // For Tab navigation - commit changes and let react-data-grid handle navigation
        if (hasChanges || config.commitMode === 'immediate') {
          onCommit(value)
        } else {
          onCancel()
        }
        break
    }
  }, [hasChanges, config.commitMode, onCommit, onCancel])
  
  // Centralized keyboard handler
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    const { keyBindings } = config
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        executeAction(keyBindings.Enter)
        break
        
      case 'Escape':
        e.preventDefault()
        executeAction(keyBindings.Escape)
        break
        
      case 'Tab':
        e.preventDefault()
        executeAction(keyBindings.Tab)
        break
    }
  }, [config, executeAction])
  
  // Handle commit action (with optional immediate value for immediate mode)
  const handleCommit = React.useCallback((immediateValue?: any) => {
    executeAction('commit', immediateValue)
  }, [executeAction])
  
  // Handle commit with save - triggers save handler regardless of commit mode
  const handleCommitWithSave = React.useCallback(async (value: any) => {
    // When explicitly called, trigger persistence directly regardless of commit mode
    if (onUpdate && rowId && fieldKey) {
      try {
        console.log('[useEditorBehavior] 🚀 Triggering direct update:', { rowId, fieldKey, value })
        // Call onUpdate with correct signature: (id, column, value)
        await onUpdate(rowId, fieldKey, value)
        console.log('[useEditorBehavior] ✅ Direct update successful')
      } catch (error) {
        console.error('[useEditorBehavior] ❌ Direct update failed:', error)
      }
    }
    
    // Always call the commit callback for UI updates
    onCommit(value)
  }, [onUpdate, rowId, fieldKey, onCommit])
  
  // Handle cancel action
  const handleCancel = React.useCallback(() => {
    executeAction('cancel')
  }, [executeAction])
  
  // Handle blur event based on commit mode
  const handleBlur = React.useCallback(() => {
    if (config.commitMode === 'onBlur') {
      const blurAction = config.keyBindings.clickOutside || 'commit'
      executeAction(blurAction)
    }
    // For other commit modes, blur doesn't trigger any action
  }, [config, executeAction])
  
  return {
    hasChanges,
    markChanged,
    resetChanges,
    handleKeyDown,
    handleCommit,
    handleCommitWithSave,
    handleCancel,
    handleBlur,
    shouldPreventClose
  }
}