// Minimal working table machine - temporary fix
import { setup, assign } from 'xstate'

export const tableBaseMachine = setup({
  types: {} as {
    context: any
    events: any
  }
}).createMachine({
  id: 'tableBaseMachine',
  initial: 'initializing',
  context: {
    id: '',
    entityType: '',
    columns: [],
    rows: [],
    entities: []
  },
  states: {
    initializing: {
      entry: [],
      on: {
        INITIALIZE_RENDERER: {
          target: 'active'
        }
      }
    },
    active: {
      on: {
        '*': {
          actions: ({ event }) => {
            console.log('TableMachine fallback received event:', event.type)
          }
        }
      }
    }
  }
})

export { tableBaseMachine as default }