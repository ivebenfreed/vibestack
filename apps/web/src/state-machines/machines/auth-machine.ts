import { setup, assign } from 'xstate';
import { checkAuthActor, signInActor, signOutActor } from '../auth-actors';
import { loadOrganizationsActor, createOrganizationActor, selectOrganizationActor, loadBillingActor, upgradeSubscriptionActor } from '../organization-actors';
import type { UserInfo, OrganizationInfo, CreateOrganizationInput } from '../types';

export interface AuthContext {
  user: UserInfo | null;
  authToken: string | null;
  authError: string | null;
  sessionExpiry: string | null;
  lastActivity: number;
  errorRetryCount?: number;
  
  // Organization context
  currentOrganization: OrganizationInfo | null;
  userOrganizations: OrganizationInfo[];
  organizationError: string | null;
  isLoadingOrganizations: boolean;
  organizationSetupComplete: boolean;
  needsOrganizationSetup: boolean;
  
  // Billing context
  subscriptionInfo: any | null;
  billingError: string | null;
  isLoadingBilling: boolean;
  trialStatus: any | null;
  usageStats: any | null;
  isTrialExpired: boolean;
  needsBillingSetup: boolean;
}

export type AuthEvent =
  | { type: 'SIGN_IN'; credentials: { email: string; password: string } }
  | { type: 'SIGN_OUT' }
  | { type: 'CHECK_AUTH' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESTORED_SESSION' }
  | { type: 'RETRY_AUTH' }
  
  // Organization events
  | { type: 'LOAD_ORGANIZATIONS' }
  | { type: 'SELECT_ORGANIZATION'; organizationId: string }
  | { type: 'CREATE_ORGANIZATION'; organizationData: CreateOrganizationInput }
  | { type: 'SKIP_ORGANIZATION_SETUP' }
  | { type: 'REFRESH_ORGANIZATIONS' }
  | { type: 'SWITCH_ORGANIZATION'; organizationId: string }
  | { type: 'RETRY_LOAD_ORGANIZATIONS' }
  
  // Billing events
  | { type: 'LOAD_BILLING' }
  | { type: 'UPGRADE_SUBSCRIPTION'; upgradeData: any }
  | { type: 'CONTINUE_WITH_LIMITS' }
  | { type: 'REFRESH_BILLING' }
  | { type: 'START_TRIAL' }
  | { type: 'SETUP_BILLING' };

export const authMachine = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvent,
  },
  
  actors: {
    checkAuth: checkAuthActor,
    signIn: signInActor,
    signOut: signOutActor,
    loadOrganizations: loadOrganizationsActor,
    createOrganization: createOrganizationActor,
    selectOrganization: selectOrganizationActor,
    loadBilling: loadBillingActor,
    upgradeSubscription: upgradeSubscriptionActor,
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
          lastActivity: context.lastActivity,
          currentOrganization: context.currentOrganization,
          userOrganizations: context.userOrganizations, // 🔥 FIX: Persist all organizations for org switcher
          organizationSetupComplete: context.organizationSetupComplete
        },
        value: 'authenticated'
      };
      
      try {
        localStorage.setItem('auth-machine-state', JSON.stringify(stateToStore));
        // Silent persistence - no logging needed for normal operation
      } catch (error) {
        console.error('[AuthMachine] Failed to persist auth state:', error);
      }
    },

    // Organization actions
    setLoadingOrganizations: assign({
      isLoadingOrganizations: true,
      organizationError: null,
    }),

    clearLoadingOrganizations: assign({
      isLoadingOrganizations: false,
    }),

    setUserOrganizations: assign({
      userOrganizations: ({ event }) => event.output?.organizations || [],
      organizationError: event => event.output?.error || null,
      // Validate that currentOrganization is still valid
      currentOrganization: ({ context, event }) => {
        const organizations = event.output?.organizations || [];
        const currentOrgId = context.currentOrganization?.id;
        
        // If no current org, return null
        if (!currentOrgId) return null;
        
        // Check if current org is in the loaded organizations
        const validOrg = organizations.find(org => org.id === currentOrgId);
        
        if (!validOrg) {
          console.log('[AuthMachine] Current organization no longer valid, clearing:', currentOrgId);
          // Clear invalid org from localStorage too
          localStorage.removeItem('vibestack-last-organization-id');
          return null;
        }
        
        // Update with fresh org data from server
        return validOrg;
      },
    }),

    setCurrentOrganization: assign({
      currentOrganization: ({ event }) => {
        const organization = event.output?.organization || null;
        // Save the selected organization preference
        if (organization) {
          localStorage.setItem('vibestack-last-organization-id', organization.id);
        }
        return organization;
      },
      organizationSetupComplete: true,
    }),
    
    autoSelectOrganization: assign({
      currentOrganization: ({ context }) => {
        // Auto-select logic: prefer single org, then last used, then first
        if (!context.userOrganizations || context.userOrganizations.length === 0) {
          return null;
        }
        
        // If exactly one org, select it
        if (context.userOrganizations.length === 1) {
          const selectedOrg = context.userOrganizations[0];
          // Save this preference
          localStorage.setItem('vibestack-last-organization-id', selectedOrg.id);
          return selectedOrg;
        }
        
        // Check for last used organization
        const lastOrgId = localStorage.getItem('vibestack-last-organization-id');
        if (lastOrgId) {
          const foundOrg = context.userOrganizations.find(org => org.id === lastOrgId);
          if (foundOrg) {
            return foundOrg;
          }
        }
        
        // Fallback: select first organization
        const selectedOrg = context.userOrganizations[0];
        
        localStorage.setItem('vibestack-last-organization-id', selectedOrg.id);
        return selectedOrg;
      },
      organizationSetupComplete: true,
    }),

    setOrganizationError: assign({
      organizationError: ({ event }) => event.output?.error || 'Organization operation failed',
      isLoadingOrganizations: false,
    }),

    markSetupComplete: assign({
      organizationSetupComplete: true,
      needsOrganizationSetup: false,
    }),

    // Billing actions
    setLoadingBilling: assign({
      isLoadingBilling: true,
      billingError: null,
    }),

    clearLoadingBilling: assign({
      isLoadingBilling: false,
    }),

    setBillingInfo: assign({
      subscriptionInfo: ({ event }) => event.output?.billingInfo || null,
      trialStatus: ({ event }) => event.output?.trialInfo || null,
      usageStats: ({ event }) => event.output?.usage || null,
      isTrialExpired: ({ event, context }) => {
        const trialInfo = event.output?.trialInfo;
        if (!trialInfo || !trialInfo.trialEndsAt) return false;
        return new Date(trialInfo.trialEndsAt) < new Date();
      },
      needsBillingSetup: ({ event }) => event.output?.needsSetup || false,
      billingError: null,
    }),

    setBillingError: assign({
      billingError: ({ event }) => event.output?.error || 'Billing operation failed',
      isLoadingBilling: false,
    }),
  },

  guards: {
    hasNoOrganizations: ({ context }) => {
      return !context.userOrganizations || context.userOrganizations.length === 0;
    },

    hasNoCurrentOrganization: ({ context }) => {
      // Only return true if we truly need manual organization selection
      // This guard should be restrictive - only trigger selection UI when absolutely necessary
      
      if (context.currentOrganization) {
        return false; // We already have a current organization
      }
      
      if (!context.userOrganizations || context.userOrganizations.length === 0) {
        return false; // No organizations available - handled by hasNoOrganizations guard
      }
      
      // Single organization - always auto-selectable, no manual selection needed
      if (context.userOrganizations.length === 1) {
        return false;
      }
      
      // Multiple organizations - check if we have a clear preference to auto-select
      const lastOrgId = localStorage.getItem('vibestack-last-organization-id');
      if (lastOrgId) {
        const foundOrg = context.userOrganizations.find(org => org.id === lastOrgId);
        if (foundOrg) {
          return false; // We can auto-select the preferred org
        }
      }
      
      // Multiple orgs with no saved preference - auto-select first organization (usually the one created first)
      return false; // Allow auto-selection of first organization
    },

    isTrialExpiredAndNeedsUpgrade: ({ context }) => {
      return context.isTrialExpired && context.needsBillingSetup;
    },

    hasValidCurrentOrganization: ({ context }) => {
      return !!context.currentOrganization && context.organizationSetupComplete;
    },
  },
}).createMachine({
  id: 'authMachine',
  // 🚀 OPTIMIZED: Use XState's context to determine initial state
  initial: 'determiningInitialState',
  
  context: ({ input }: { input?: { user?: UserInfo; authToken?: string; sessionExpiry?: string } }) => {
    // Try to load persisted state first
    let persistedContext = null;
    try {
      const stored = localStorage.getItem('auth-machine-state');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.context) {
          // Found persisted context - will be logged when determining initial state
          persistedContext = parsed.context;
        }
      }
    } catch (error) {
      console.warn('[AuthMachine] Failed to load persisted context:', error);
      localStorage.removeItem('auth-machine-state');
    }
    
    // Use persisted context if available, otherwise use input or defaults
    return {
      user: persistedContext?.user || input?.user || null,
      authToken: persistedContext?.authToken || input?.authToken || null,
      authError: null,
      sessionExpiry: persistedContext?.sessionExpiry || input?.sessionExpiry || null,
      lastActivity: persistedContext?.lastActivity || Date.now(),
      errorRetryCount: 0,
      
      // Organization context from persisted state
      currentOrganization: persistedContext?.currentOrganization || null,
      userOrganizations: persistedContext?.userOrganizations || [],
      organizationError: null,
      isLoadingOrganizations: false,
      organizationSetupComplete: persistedContext?.organizationSetupComplete || false,
      needsOrganizationSetup: false,
      
      // Billing context (reset on startup)
      subscriptionInfo: null,
      billingError: null,
      isLoadingBilling: false,
      trialStatus: null,
      usageStats: null,
      isTrialExpired: false,
      needsBillingSetup: false,
    };
  },
  
  states: {
    // 🚀 OPTIMIZED: Determine initial state based on persisted context
    determiningInitialState: {
      always: [
        {
          // If we have valid session and organization, go straight to ready
          guard: ({ context }) => {
            if (!context.user || !context.authToken || !context.sessionExpiry) {
              return false;
            }
            
            const sessionExpiry = new Date(context.sessionExpiry).getTime();
            const now = Date.now();
            const sessionValid = sessionExpiry > now && context.lastActivity && 
                                (now - context.lastActivity) < 24 * 60 * 60 * 1000;
            
            const orgReady = !!context.currentOrganization && context.organizationSetupComplete;
            
            return sessionValid && orgReady;
          },
          target: 'authenticated.ready',
          actions: [
            ({ context }) => console.log(`[AuthMachine] ✅ Restored session: ${context.user?.email}, org: ${context.currentOrganization?.name}`),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: true, reason: 'session-restored-with-org' }
            }
          ]
        },
        {
          // If we have valid session but no org, go to authenticated (will load orgs)
          guard: ({ context }) => {
            if (!context.user || !context.authToken || !context.sessionExpiry) {
              return false;
            }
            
            const sessionExpiry = new Date(context.sessionExpiry).getTime();
            const now = Date.now();
            
            return sessionExpiry > now && context.lastActivity && 
                   (now - context.lastActivity) < 24 * 60 * 60 * 1000;
          },
          target: 'authenticated',
          actions: [
            ({ context }) => console.log(`[AuthMachine] Valid session for ${context.user?.email}, loading organizations`),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: true, reason: 'session-restored-needs-org' }
            }
          ]
        },
        {
          // Otherwise, check auth
          target: 'checking',
          actions: () => console.log('[AuthMachine] No persisted session, checking auth status')
        }
      ]
    },
    
    checking: {
      // No entry logging - determiningInitialState already logged what's happening
      
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

      // 🚀 OPTIMIZED: Use guards to determine initial state based on context
      initial: 'checkingOrganizationState',
      
      states: {
        // 🚀 OPTIMIZED: Determine where to start based on existing context without redundant checks
        checkingOrganizationState: {
          always: [
            {
              // If org is already setup (from persisted state), go straight to ready
              guard: ({ context }) => 
                !!context.currentOrganization && context.organizationSetupComplete,
              target: 'ready'
              // No logging here - we already logged in determiningInitialState if this was from persistence
            },
            {
              // If we have orgs loaded but none selected, need selection
              guard: ({ context }) => 
                context.userOrganizations.length > 0 && !context.currentOrganization,
              target: 'needsOrganizationSelection',
              actions: () => console.log('[AuthMachine] Have organizations but none selected')
            },
            {
              // Otherwise, need to load organizations (fresh login, no persisted orgs)
              target: 'loadingOrganizations',
              actions: () => console.log('[AuthMachine] Loading organizations for authenticated user')
            }
          ]
        },
        
        loadingOrganizations: {
          entry: 'setLoadingOrganizations',
          invoke: {
            src: 'loadOrganizations',
            onDone: {
              target: 'loadingBilling',
              actions: ['setUserOrganizations', 'clearLoadingOrganizations', 'persistAuthState']
            },
            onError: {
              target: 'checkingOrganizationSetup',
              actions: ['setOrganizationError', 'persistAuthState']
            }
          }
        },

        loadingBilling: {
          entry: 'setLoadingBilling',
          always: [
            {
              target: 'checkingOrganizationSetup',
              guard: ({ context }) => !context.currentOrganization,
              actions: ['clearLoadingBilling']
            },
            {
              target: 'loadingBillingData'
            }
          ]
        },

        loadingBillingData: {
          invoke: {
            src: 'loadBilling',
            input: ({ context }) => ({ organizationId: context.currentOrganization?.id }),
            onDone: {
              target: 'checkingOrganizationSetup',
              actions: ['setBillingInfo', 'clearLoadingBilling', 'persistAuthState']
            },
            onError: {
              target: 'checkingOrganizationSetup',
              actions: ['setBillingError', 'clearLoadingBilling', 'persistAuthState']
            }
          }
        },

        checkingOrganizationSetup: {
          always: [
            {
              target: 'needsOrganizationSetup',
              guard: 'hasNoOrganizations'
            },
            {
              target: 'needsOrganizationSelection',
              guard: 'hasNoCurrentOrganization'
            },
            {
              target: 'ready',
              guard: ({ context }) => !!context.currentOrganization,
              actions: ['persistAuthState']
            },
            {
              // Auto-select organization and go to ready - this is the fast path
              target: 'ready',
              actions: ['autoSelectOrganization', 'persistAuthState']
            }
          ]
        },

        needsOrganizationSetup: {
          on: {
            CREATE_ORGANIZATION: {
              target: 'creatingOrganization'
            },
            SKIP_ORGANIZATION_SETUP: {
              target: 'ready',
              actions: 'markSetupComplete'
            }
          }
        },

        needsOrganizationSelection: {
          entry: 'persistAuthState', // Persist state even when waiting for org selection
          on: {
            SELECT_ORGANIZATION: {
              target: 'selectingOrganization'
            },
            CREATE_ORGANIZATION: {
              target: 'creatingOrganization'
            },
            RETRY_LOAD_ORGANIZATIONS: {
              target: 'loadingOrganizations'
            }
          }
        },

        creatingOrganization: {
          invoke: {
            src: 'createOrganization',
            input: ({ event }) => event.organizationData,
            onDone: {
              target: 'ready',
              actions: ['setCurrentOrganization', 'markSetupComplete', 'persistAuthState']
            },
            onError: {
              target: 'needsOrganizationSetup',
              actions: ['setOrganizationError', 'persistAuthState']
            }
          }
        },

        selectingOrganization: {
          invoke: {
            src: 'selectOrganization',
            input: ({ event }) => {
              const orgId = event.type === 'SELECT_ORGANIZATION' ? event.organizationId : 
                            event.type === 'SWITCH_ORGANIZATION' ? event.organizationId : null;
              return { organizationId: orgId };
            },
            onDone: {
              target: 'loadingBilling',
              actions: ['setCurrentOrganization', 'persistAuthState']
            },
            onError: {
              target: 'needsOrganizationSelection',
              actions: ['setOrganizationError', 'persistAuthState']
            }
          }
        },

        trialExpiredSetup: {
          on: {
            UPGRADE_SUBSCRIPTION: {
              target: 'upgradingSubscription'
            },
            CONTINUE_WITH_LIMITS: {
              target: 'ready',
              actions: 'markSetupComplete'
            },
            SELECT_ORGANIZATION: {
              target: 'selectingOrganization'
            }
          }
        },

        upgradingSubscription: {
          invoke: {
            src: 'upgradeSubscription',
            input: ({ event, context }) => ({
              organizationId: context.currentOrganization?.id,
              planType: event.upgradeData?.planType || 'starter',
              paymentData: event.upgradeData?.paymentData
            }),
            onDone: {
              target: 'ready',
              actions: ['setBillingInfo', 'markSetupComplete']
            },
            onError: {
              target: 'trialExpiredSetup',
              actions: 'setBillingError'
            }
          }
        },

        ready: {
          entry: ({ context }) => {
            // 🚀 OPTIMIZED: Only log if we're reaching ready for the first time (not from restoration)
            // The determiningInitialState already logged if we restored directly to ready
            // Dispatch event that the full auth + org flow is complete
            window.dispatchEvent(new CustomEvent('auth:ready', {
              detail: {
                user: context.user,
                organization: context.currentOrganization,
                setupComplete: true
              }
            }));
          },
          
          on: {
            REFRESH_ORGANIZATIONS: {
              target: 'loadingOrganizations'
            },
            REFRESH_BILLING: {
              target: 'loadingBilling'
            },
            SELECT_ORGANIZATION: {
              target: 'selectingOrganization'
            },
            SWITCH_ORGANIZATION: {
              target: 'selectingOrganization'
            },
            UPGRADE_SUBSCRIPTION: {
              target: 'upgradingSubscription'
            }
          }
        }
      },
      
      on: {
        SIGN_OUT: 'signingOut',
        CHECK_AUTH: 'checking',
      }
    },
    
    unauthenticated: {
      // entry: () => console.log('[AuthMachine] User not authenticated'),
      
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
      // entry: () => console.log('[AuthMachine] Starting sign-in process'),
      
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
      // entry: () => console.log('[AuthMachine] Starting sign-out process'),
      
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