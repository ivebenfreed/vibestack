import { setup, assign, fromPromise } from 'xstate';

export interface ConnectionContext {
  isOnline: boolean;
  retries: number;
  maxRetries: number;
  lastError: string | null;
  lastAttempt: number | null;
}

export type ConnectionEvent =
  | { type: 'GO_ONLINE' }
  | { type: 'GO_OFFLINE' }
  | { type: 'RETRY' }
  | { type: 'CONNECTION_SUCCESS' }
  | { type: 'CONNECTION_FAILED'; error: string }
  | { type: 'RESET_RETRIES' };

export const connectionMachine = setup({
  types: {
    context: {} as ConnectionContext,
    events: {} as ConnectionEvent,
  },
  actors: {
    checkConnection: fromPromise(async () => {
      // Simple connectivity check
      try {
        const response = await fetch('/api/health', { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        return { connected: response.ok };
      } catch {
        return { connected: false };
      }
    })
  },
  guards: {
    hasRetriesLeft: ({ context }) => context.retries < context.maxRetries,
    isOnline: () => navigator.onLine,
  },
  actions: {
    markOnline: assign({
      isOnline: true,
      retries: 0,
      lastError: null,
      lastAttempt: () => Date.now(),
    }),
    markOffline: assign({
      isOnline: false,
      lastAttempt: () => Date.now(),
    }),
    incrementRetries: assign({
      retries: ({ context }) => context.retries + 1,
    }),
    resetRetries: assign({
      retries: 0,
    }),
    storeError: assign({
      lastError: ({ event }) => 
        event.type === 'CONNECTION_FAILED' ? event.error : null,
    }),
    setupWindowEvents: ({ self }) => {
      const handleOnline = () => {
        console.log('[ConnectionMachine] Window online event');
        self.send({ type: 'GO_ONLINE' });
      };
      const handleOffline = () => {
        console.log('[ConnectionMachine] Window offline event');
        self.send({ type: 'GO_OFFLINE' });
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }
}).createMachine({
  id: 'connection',
  initial: 'checking',
  context: {
    isOnline: navigator.onLine,
    retries: 0,
    maxRetries: 3,
    lastError: null,
    lastAttempt: null,
  },
  entry: 'setupWindowEvents',
  states: {
    checking: {
      invoke: {
        src: 'checkConnection',
        onDone: [
          { target: 'online', guard: ({ event }) => event.output.connected },
          { target: 'offline' }
        ],
        onError: 'offline'
      },
      on: {
        GO_ONLINE: 'online',
        GO_OFFLINE: 'offline'
      }
    },
    online: {
      entry: 'markOnline',
      on: {
        GO_OFFLINE: 'offline',
        CONNECTION_FAILED: 'retrying'
      }
    },
    offline: {
      entry: 'markOffline',
      on: {
        GO_ONLINE: 'checking',
        RETRY: 'checking'
      }
    },
    retrying: {
      entry: 'incrementRetries',
      always: [
        { target: 'checking', guard: 'hasRetriesLeft' },
        { target: 'failed' }
      ],
      on: {
        GO_ONLINE: 'checking',
        GO_OFFLINE: 'offline'
      }
    },
    failed: {
      entry: 'storeError',
      on: {
        RETRY: 'checking',
        RESET_RETRIES: {
          target: 'checking',
          actions: 'resetRetries'
        },
        GO_ONLINE: 'checking',
        GO_OFFLINE: 'offline'
      }
    }
  }
}); 