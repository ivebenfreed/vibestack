/**
 * Global registry for grid cell state machines
 * Allows editors to find and notify the correct state machine for a cell
 */

interface StateMachineActions {
  startEdit: () => void
  changeValue: (value: any) => void
  commitEdit: (value: any) => void
  cancelEdit: () => void
}

class StateMachineRegistry {
  private machines = new Map<string, StateMachineActions>()

  register(cellId: string, columnKey: string, actions: StateMachineActions) {
    const key = `${cellId}:${columnKey}`
    this.machines.set(key, actions)
  }

  unregister(cellId: string, columnKey: string) {
    const key = `${cellId}:${columnKey}`
    this.machines.delete(key)
  }

  getActions(cellId: string, columnKey: string): StateMachineActions | undefined {
    const key = `${cellId}:${columnKey}`
    return this.machines.get(key)
  }

  notifyCommit(cellId: string, columnKey: string, value: any) {
    const actions = this.getActions(cellId, columnKey)
    if (actions) {
      console.log('[StateMachineRegistry] 🚀 Notifying state machine of commit:', { cellId, columnKey, value })
      actions.commitEdit(value)
    } else {
      console.warn('[StateMachineRegistry] ❌ No state machine found for cell:', { cellId, columnKey })
    }
  }

  notifyStart(cellId: string, columnKey: string) {
    const actions = this.getActions(cellId, columnKey)
    if (actions) {
      console.log('[StateMachineRegistry] 🎯 Notifying state machine of edit start:', { cellId, columnKey })
      actions.startEdit()
    }
  }

  notifyChange(cellId: string, columnKey: string, value: any) {
    const actions = this.getActions(cellId, columnKey)
    if (actions) {
      actions.changeValue(value)
    }
  }

  notifyCancel(cellId: string, columnKey: string) {
    const actions = this.getActions(cellId, columnKey)
    if (actions) {
      console.log('[StateMachineRegistry] ❌ Notifying state machine of cancel:', { cellId, columnKey })
      actions.cancelEdit()
    }
  }
}

// Global singleton instance
export const stateMachineRegistry = new StateMachineRegistry()