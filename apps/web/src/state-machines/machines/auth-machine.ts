import { setup, assign } from 'xstate';
import { checkAuthActor, signInActor, signOutActor } from '../auth-actors';
import type { UserInfo } from '../types';

export interface AuthContext {
  user: UserInfo | null;
  authToken: string | null;
  authError: string | null;
  sessionExpiry: string | null;
  lastActivity: number;
}

export type AuthEvent =
  | { type: 'SIGN_IN'; credentials: { email: string; password: string } }
  | { type: 'SIGN_OUT' }
  | { type: 'CHECK_AUTH' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESTORED_SESSION' };

export const authMachine = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvent,
  },
  
  actors: {
    checkAuth: checkAuthActor,
    signIn: signInActor,
    signOut: signOutActor,
  },
  
  actions: {
    clearAuth: assign({
      user: null,
      authToken: null,
      sessionExpiry: null,
      authError: null,
      lastActivity: () => Date.now(),
    }),
    
    dispatchAuthStateChange: ({ context }, params: { authenticated: boolean; reason: string }) => {
      console.log('[AuthMachine] Dispatching auth state change:', { authenticated: params.authenticated, reason: params.reason });
      
      // For sign-out, dispatch signout event immediately for navigation
      if (!params.authenticated && (params.reason === 'sign-out-success' || params.reason === 'sign-out-error')) {
        window.dispatchEvent(new CustomEvent('auth:signout'));
      }
      
      // Note: Orchestrator coordination removed - sync system is now directly auth-aware
      
      // Also dispatch window event for legacy compatibility
      window.dispatchEvent(new CustomEvent('auth:state-changed', {
        detail: { 
          authenticated: params.authenticated, 
          reason: params.reason,
          user: context.user 
        }
      }));
    },
  },
}).createMachine({
  id: 'authMachine',
  initial: 'checking',
  
  // Entry guard: If we have persisted valid session, go directly to authenticated
  // Otherwise start with checking
  entry: ({ context, self }) => {
    // If we have persisted auth data that looks valid, skip to authenticated
    if (context.user && context.authToken && context.sessionExpiry) {
      const sessionExpiry = new Date(context.sessionExpiry).getTime();
      const now = Date.now();
      
      // If session hasn't expired and was active recently, go to authenticated
      if (sessionExpiry > now && context.lastActivity && (now - context.lastActivity) < 24 * 60 * 60 * 1000) {
        console.log('[AuthMachine] Restoring valid session, going to authenticated state');
        // Dispatch auth state change immediately for restored sessions
        setTimeout(() => {
          self.send({ type: 'RESTORED_SESSION' });
        }, 0);
        return;
      }
    }
    
    console.log('[AuthMachine] No valid persisted session, checking auth');
  },
  
  context: ({ input }: { input?: { user?: UserInfo; authToken?: string; sessionExpiry?: string } }) => ({
    user: input?.user || null,
    authToken: input?.authToken || null,
    authError: null,
    sessionExpiry: input?.sessionExpiry || null,
    lastActivity: Date.now(),
  }),
  
  states: {
    checking: {
      entry: ({ context }) => {
        console.log('[AuthMachine] Checking authentication status');
        // If we have persisted auth data, validate it first
        if (context.user && context.authToken) {
          console.log('[AuthMachine] Found persisted auth data, validating session...');
        }
      },
      
      invoke: {
        src: 'checkAuth',
        onDone: [
          {
            target: 'authenticated',
            guard: ({ event }) => !!event.output?.user,
            actions: [
              assign({
                user: ({ event }) => event.output.user,
                authToken: ({ event }) => event.output.authToken,
                sessionExpiry: ({ event }) => event.output.sessionExpiry,
                authError: () => null,
                lastActivity: () => Date.now(),
              }),
              { 
                type: 'dispatchAuthStateChange',
                params: { authenticated: true, reason: 'check-success' }
              },
            ]
          },
          {
            target: 'unauthenticated',
            actions: [
              'clearAuth',
              { 
                type: 'dispatchAuthStateChange',
                params: { authenticated: false, reason: 'check-failed' }
              },
            ]
          }
        ],
        onError: {
          target: 'unauthenticated',
          actions: [
            'clearAuth',
            assign({
              authError: ({ event }) => (event.error as Error)?.message || 'Auth check failed',
            }),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: false, reason: 'check-error' }
            },
          ]
        }
      },
      
      on: {
        RESTORED_SESSION: {
          target: 'authenticated',
          actions: [
            assign({
              lastActivity: () => Date.now(),
            }),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: true, reason: 'session-restored' }
            },
          ]
        }
      }
    },
    
    authenticated: {
      entry: ({ context }) => {
        console.log('[AuthMachine] User authenticated');
        // Always dispatch auth state change when entering authenticated state
        setTimeout(() => {
          const event = new CustomEvent('auth:state-changed', {
            detail: { 
              authenticated: true, 
              reason: 'authenticated',
              user: context.user 
            }
          });
          window.dispatchEvent(event);
        }, 0);
      },
      
      on: {
        SIGN_OUT: 'signingOut',
        CHECK_AUTH: 'checking',
      }
    },
    
    unauthenticated: {
      entry: () => console.log('[AuthMachine] User not authenticated'),
      
      on: {
        SIGN_IN: {
          target: 'signingIn',
          actions: assign({
            // Clear any previous error when starting new sign-in
            authError: null
          })
        },
        CHECK_AUTH: 'checking',
        RESTORED_SESSION: {
          target: 'authenticated',
          actions: [
            assign({
              lastActivity: () => Date.now(),
            }),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: true, reason: 'session-restored' }
            },
          ]
        }
      }
    },
    
    signingIn: {
      entry: () => console.log('[AuthMachine] Starting sign-in process'),
      
      invoke: {
        src: 'signIn',
        input: ({ event }) => {
          if (event.type === 'SIGN_IN') {
            return event.credentials;
          }
          // This shouldn't happen, but provide a fallback
          return { email: '', password: '' };
        },
        onDone: [
          {
            target: 'authenticated',
            guard: ({ event }) => !!event.output?.user,
            actions: [
              assign({
                user: ({ event }) => event.output.user,
                authToken: ({ event }) => event.output.authToken,
                sessionExpiry: ({ event }) => event.output.sessionExpiry,
                authError: () => null,
                lastActivity: () => Date.now(),
              }),
              { 
                type: 'dispatchAuthStateChange',
                params: { authenticated: true, reason: 'sign-in-success' }
              },
            ]
          },
          {
            target: 'unauthenticated',
            actions: [
              assign({
                authError: ({ event }) => event.output.error || 'Sign-in failed',
                lastActivity: () => Date.now(),
              }),
            ]
          }
        ],
        onError: {
          target: 'unauthenticated',
          actions: [
            assign({
              authError: ({ event }) => (event.error as Error)?.message || 'Sign-in failed',
              lastActivity: () => Date.now(),
            }),
          ]
        }
      }
    },
    
    signingOut: {
      entry: () => console.log('[AuthMachine] Starting sign-out process'),
      
      invoke: {
        src: 'signOut',
        onDone: {
          target: 'unauthenticated',
          actions: [
            'clearAuth',
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: false, reason: 'sign-out-success' }
            },
          ]
        },
        onError: {
          target: 'unauthenticated',
          actions: [
            'clearAuth',
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: false, reason: 'sign-out-error' }
            },
          ]
        }
      }
    },
  },
});