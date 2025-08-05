import { setup, assign } from 'xstate';
import { checkAuthActor, signInActor, signOutActor } from '../auth-actors';
import type { UserInfo } from '../types';

export interface AuthContext {
  user: UserInfo | null;
  authToken: string | null;
  authError: string | null;
  sessionExpiry: string | null;
  lastActivity: number;
  errorRetryCount?: number;
}

export type AuthEvent =
  | { type: 'SIGN_IN'; credentials: { email: string; password: string } }
  | { type: 'SIGN_OUT' }
  | { type: 'CHECK_AUTH' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESTORED_SESSION' }
  | { type: 'RETRY_AUTH' };

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
    
    persistAuthState: ({ context }) => {
      // Persist auth state to localStorage for recovery
      const stateToStore = {
        context: {
          user: context.user,
          authToken: context.authToken,
          sessionExpiry: context.sessionExpiry,
          lastActivity: context.lastActivity
        },
        value: 'authenticated'
      };
      
      try {
        localStorage.setItem('auth-machine-state', JSON.stringify(stateToStore));
        console.log('[AuthMachine] Persisted auth state to localStorage');
      } catch (error) {
        console.error('[AuthMachine] Failed to persist auth state:', error);
      }
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
            // Successfully authenticated (including from persisted state during errors)
            target: 'authenticated',
            guard: ({ event }) => event.output?.authenticated === true && !!event.output?.user,
            actions: [
              assign({
                user: ({ event }) => event.output.user,
                authToken: ({ event }) => event.output.authToken,
                sessionExpiry: ({ event }) => event.output.sessionExpiry,
                authError: ({ event }) => event.output.fromPersisted ? 
                  `Using cached session (${event.output.error})` : null,
                lastActivity: () => Date.now(),
              }),
              { 
                type: 'dispatchAuthStateChange',
                params: ({ event }) => ({ 
                  authenticated: true, 
                  reason: event.output.fromPersisted ? 'restored-from-persisted' : 'check-success' 
                })
              },
              'persistAuthState'
            ]
          },
          {
            // Definite sign out required (e.g., 401/403 without persisted auth)
            target: 'unauthenticated',
            guard: ({ event }) => event.output?.shouldSignOut === true,
            actions: [
              'clearAuth',
              { 
                type: 'dispatchAuthStateChange',
                params: { authenticated: false, reason: 'check-failed-auth' }
              },
            ]
          },
          {
            // Retryable errors - stay authenticated if we have persisted auth
            target: 'authenticated',
            guard: ({ event, context }) => {
              // Stay authenticated if:
              // 1. Error is retryable (network/server/unknown)
              // 2. We have valid persisted auth data
              // 3. Session hasn't expired
              const hasValidAuth = !!context.user && !!context.authToken;
              const notExpired = !context.sessionExpiry || 
                                new Date(context.sessionExpiry) > new Date();
              const isRetryable = event.output?.retryable === true;
              
              return event.output?.shouldSignOut === false && 
                     hasValidAuth && 
                     notExpired &&
                     isRetryable;
            },
            actions: [
              assign({
                authError: ({ event }) => {
                  const errorType = event.output?.errorType || 'unknown';
                  const baseError = event.output?.error || 'Connection issue';
                  return `${errorType === 'network' ? 'Network issue' : 'Temporary error'}: ${baseError}`;
                },
                lastActivity: () => Date.now(),
              }),
              { 
                type: 'dispatchAuthStateChange',
                params: { authenticated: true, reason: 'persisted-during-error' }
              },
              'persistAuthState' // Make sure we persist the state
            ]
          },
          {
            // Error recovery state - for retryable errors without persisted auth
            target: 'errorRecovery',
            guard: ({ event }) => {
              return event.output?.shouldSignOut === false && 
                     event.output?.retryable === true;
            },
            actions: [
              assign({
                authError: ({ event }) => event.output?.error || 'Auth check failed',
                errorRetryCount: 0,
              }),
              { 
                type: 'dispatchAuthStateChange',
                params: { authenticated: false, reason: 'error-recovery' }
              },
            ]
          },
          {
            // Final fallback - sign out
            target: 'unauthenticated',
            actions: [
              'clearAuth',
              assign({
                authError: ({ event }) => event.output?.error || 'Auth check failed',
              }),
              { 
                type: 'dispatchAuthStateChange',
                params: { authenticated: false, reason: 'check-failed-fallback' }
              },
            ]
          }
        ],
        onError: {
          // onError handles unexpected errors (not the ones we catch in the actor)
          target: 'unauthenticated',
          actions: [
            'clearAuth',
            assign({
              authError: ({ event }) => (event.error as Error)?.message || 'Unexpected auth check error',
            }),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: false, reason: 'check-unexpected-error' }
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
    
    errorRecovery: {
      entry: ({ context }) => {
        console.log('[AuthMachine] Entering error recovery state', {
          error: context.authError,
          retryCount: context.errorRetryCount || 0
        });
      },
      
      // Automatically retry after a delay
      after: {
        // Exponential backoff: 2s, 4s, 8s, then give up
        2000: [
          {
            target: 'checking',
            guard: ({ context }) => (context.errorRetryCount || 0) < 3,
            actions: assign({
              errorRetryCount: ({ context }) => (context.errorRetryCount || 0) + 1,
            })
          },
          {
            // Max retries reached, go to unauthenticated
            target: 'unauthenticated',
            actions: [
              'clearAuth',
              assign({
                authError: ({ context }) => `${context.authError} (max retries reached)`,
              }),
              { 
                type: 'dispatchAuthStateChange',
                params: { authenticated: false, reason: 'error-recovery-failed' }
              },
            ]
          }
        ]
      },
      
      on: {
        // Allow manual retry
        RETRY_AUTH: {
          target: 'checking',
          actions: assign({
            authError: null,
            errorRetryCount: ({ context }) => (context.errorRetryCount || 0) + 1,
          })
        },
        
        // Allow manual sign in
        SIGN_IN: {
          target: 'signingIn',
          actions: assign({
            authError: null,
            errorRetryCount: 0,
          })
        },
        
        // If we get a restored session event, go to authenticated
        RESTORED_SESSION: {
          target: 'authenticated',
          actions: [
            assign({
              authError: null,
              errorRetryCount: 0,
              lastActivity: () => Date.now(),
            }),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: true, reason: 'session-restored-from-error' }
            },
          ]
        }
      }
    },
  },
});