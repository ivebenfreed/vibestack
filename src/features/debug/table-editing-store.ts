import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { subscribeWithSelector } from 'zustand/middleware'
import { log } from '@/logger';
const fileLog = log('features/debug/table-editing-store.ts');

interface EditingCell {
  rowId: string
  columnId: string
}

interface TableEditingState {
  // Current editing state
  editingCell: EditingCell | null
  editingValue: string
  
  // Actions
  startEditing: (cell: EditingCell, initialValue: string) => void
  updateValue: (value: string) => void
  stopEditing: () => void
  
  // Utilities
  isEditing: (rowId: string, columnId: string) => boolean
}

// ✅ ZUSTAND: Editing state completely outside React render cycle
export const useTableEditingStore = create<TableEditingState>((set, get) => ({
  editingCell: null,
  editingValue: '',
  
  startEditing: (cell, initialValue) => {
    fileLog.info(`🔍 [Zustand] Starting edit: ${cell.rowId}.${cell.columnId} = "${initialValue}"`)
    // ✅ PERFORMANCE: Use batch update to prevent cascading re-renders
    set(state => ({ 
      editingCell: cell, 
      editingValue: initialValue 
    }))
  },
  
  updateValue: (value) => {
    set({ editingValue: value })
  },
  
  stopEditing: () => {
    fileLog.info(`🔍 [Zustand] Stopping edit`)
    // ✅ PERFORMANCE: Use batch update to prevent cascading re-renders
    set(state => ({ 
      editingCell: null, 
      editingValue: '' 
    }))
  },
  
  isEditing: (rowId, columnId) => {
    const { editingCell } = get()
    return editingCell?.rowId === rowId && editingCell?.columnId === columnId
  }
}))

// ✅ PERFORMANCE: Selective subscriptions to prevent unnecessary re-renders
export const useIsEditing = (rowId: string, columnId: string) => 
  useTableEditingStore(state => 
    state.editingCell?.rowId === rowId && state.editingCell?.columnId === columnId
  )

export const useEditingValue = () => 
  useTableEditingStore(state => state.editingValue)

// ✅ PERFORMANCE: Only subscribe to editing value if this specific cell is being edited
export const useEditingValueForCell = (rowId: string, columnId: string) => 
  useTableEditingStore(state => {
    const isThisCellEditing = state.editingCell?.rowId === rowId && state.editingCell?.columnId === columnId
    return isThisCellEditing ? state.editingValue : null
  })

export const useEditingActions = () => 
  useTableEditingStore(
    useShallow((state) => ({
      startEditing: state.startEditing,
      updateValue: state.updateValue,
      stopEditing: state.stopEditing
    }))
  ) 