/**
 * Editor behavior types and configurations for VibeGridOptimus
 * Provides centralized typing for consistent edit behavior across all editors
 */

export type EditorCommitMode = 
  | 'immediate'  // Commit as soon as value changes (enums, booleans, single relationships)
  | 'onBlur'     // Commit when focus leaves editor (text inputs)
  | 'manual'     // Commit only on explicit user action (multi-relationships)

export type EditorKeyAction = 
  | 'commit'     // Save changes and close
  | 'cancel'     // Discard changes and close
  | 'navigate'   // Save changes and move to next cell

export interface EditorKeyBinding {
  Enter: EditorKeyAction
  Escape: EditorKeyAction
  Tab: EditorKeyAction
  clickOutside?: EditorKeyAction
}

export interface EditorBehaviorConfig {
  commitMode: EditorCommitMode
  keyBindings: EditorKeyBinding
  allowPartialCommits?: boolean  // For multi-select editors that update incrementally
  preventAutoClose?: boolean     // Keep editor open after changes (for multi-select)
}

/**
 * Standard editor behavior configurations
 */
export const EDITOR_BEHAVIORS: Record<string, EditorBehaviorConfig> = {
  text: {
    commitMode: 'onBlur',
    keyBindings: {
      Enter: 'commit',
      Escape: 'cancel', 
      Tab: 'navigate',
      clickOutside: 'commit'
    }
  },
  
  enum: {
    commitMode: 'immediate',
    keyBindings: {
      Enter: 'commit',
      Escape: 'cancel',
      Tab: 'navigate'
    }
  },
  
  boolean: {
    commitMode: 'immediate',
    keyBindings: {
      Enter: 'commit',
      Escape: 'cancel',
      Tab: 'navigate'
    }
  },
  
  singleRelationship: {
    commitMode: 'immediate',
    keyBindings: {
      Enter: 'commit',
      Escape: 'cancel',
      Tab: 'navigate'
    }
  },
  
  multiRelationship: {
    commitMode: 'manual',
    keyBindings: {
      Enter: 'commit',
      Escape: 'cancel',
      Tab: 'navigate'
    },
    allowPartialCommits: true,
    preventAutoClose: true
  },
  
  number: {
    commitMode: 'onBlur',
    keyBindings: {
      Enter: 'commit',
      Escape: 'cancel',
      Tab: 'navigate',
      clickOutside: 'commit'
    }
  },
  
  date: {
    commitMode: 'immediate',
    keyBindings: {
      Enter: 'commit',
      Escape: 'cancel',
      Tab: 'navigate'
    }
  }
}

/**
 * Hook return type for useEditorBehavior
 */
export interface EditorBehaviorHook {
  hasChanges: boolean
  markChanged: () => void
  resetChanges: () => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleCommit: (immediateValue?: any) => void
  handleCommitWithSave: (value: any) => void
  handleCancel: () => void
  handleBlur: () => void
  shouldPreventClose: boolean
}

/**
 * Props interface for editor components using centralized behavior
 */
export interface StandardEditorProps<TEntity = any> {
  row: TEntity
  column: any // OptimusColumn<TEntity> - avoiding circular import
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  behaviorConfig?: EditorBehaviorConfig
}