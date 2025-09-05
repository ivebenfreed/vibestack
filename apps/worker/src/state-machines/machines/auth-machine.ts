import { setup, assign, fromPromise } from 'xstate';
import { checkAuthActor, signInActor, signOutActor } from '../auth-actors';
import { loadOrganizationsActor, createOrganizationActor, selectOrganizationActor, loadBillingActor, upgradeSubscriptionActor, switchOrganizationActor } from '../organization-actors';
import { legendStateInitMachine } from './legend-state-init-machine';
import type { UserInfo, OrganizationInfo, CreateOrganizationInput } from '../types';
import { syncLog } from '@/logger';
const log = syncLog('state-machines/machines/auth-machine.ts');

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
  
  // Legend State initialization context - NEW
  legendStateSetupComplete: boolean;
  legendStateError: string | null;
  isInitializingLegendState: boolean;
  legendStateProgress: {
    step: string;
    progress: number;
    entitiesLoaded: number;
    totalEntities: number;
  } | null;
  
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
  | { type: 'SESSION_FAULT' }
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
    legendStateInit: legendStateInitMachine,
    loadOrganizations: loadOrganizationsActor,
    createOrganization: createOrganizationActor,
    selectOrganization: selectOrganizationActor,
    loadBilling: loadBillingActor,
    upgradeSubscription: upgradeSubscriptionActor,
    switchOrganization: switchOrganizationActor,
    // Simple actor to create a default personal org if user has none
    createDefaultPersonalOrg: fromPromise(async ({ input }: { input: { userId: string } }) => {
      log.info('[AuthMachine] Creating default personal organization for user:', input.userId);
      
      // For now, just return a mock personal org
      // In production, this would call the API to create the org
      const personalOrg = {
        id: `personal-${input.userId}`,
        name: 'Personal Workspace',
        slug: `personal-${input.userId}`,
        type: 'personal' as const,
        role: 'owner' as const
      };
      
      return { organization: personalOrg };
    }),
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
      log.info('[AuthMachine] Dispatching auth state change:', { authenticated: params.authenticated, reason: params.reason });
      
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
      // Set or validate currentOrganization
      currentOrganization: ({ context, event }) => {
        const organizations = event.output?.organizations || [];
        
        // If we already have a valid currentOrganization, preserve it and validate against the loaded list
        if (context.currentOrganization) {
          const validOrg = organizations.find(org => org.id === context.currentOrganization.id);
          if (validOrg) {
            log.info('[AuthMachine] Current organization validated against loaded organizations:', validOrg.name);
            return validOrg; // Return the org from the list (may have updated info)
          } else {
            log.info('[AuthMachine] Current organization no longer valid, clearing:', context.currentOrganization.id);
            return null;
          }
        }
        
        // No current organization - don't auto-select, let the state machine handle selection logic
        log.info('[AuthMachine] No current organization - organizations loaded for selection');
        return null;
      },
    }),

    setCurrentOrganization: assign({
      currentOrganization: ({ event }) => {
        const organization = event.output?.organization || null;
        return organization;
      },
      organizationSetupComplete: true,
    }),
    
    autoSelectOrganization: assign({
      currentOrganization: ({ context }) => {
        // Auto-select logic: prefer persisted org, then single org, then first
        if (!context.userOrganizations || context.userOrganizations.length === 0) {
          return null;
        }
        
        // If we already have a current org from persisted context, validate it
        if (context.currentOrganization) {
          const foundOrg = context.userOrganizations.find(org => org.id === context.currentOrganization.id);
          if (foundOrg) {
            return foundOrg;
          }
        }
        
        // If exactly one org, select it
        if (context.userOrganizations.length === 1) {
          return context.userOrganizations[0];
        }
        
        // Fallback: select first organization
        return context.userOrganizations[0];
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

    // Legend State initialization actions - NEW
    setLoadingLegendState: assign({
      isInitializingLegendState: true,
      legendStateError: null,
    }),

    clearLoadingLegendState: assign({
      isInitializingLegendState: false,
    }),

    setLegendStateSuccess: assign({
      legendStateSetupComplete: true,
      legendStateError: null,
      isInitializingLegendState: false,
    }),

    setLegendStateError: assign({
      legendStateError: ({ event }) => event.output?.error || 'Legend State initialization failed',
      legendStateSetupComplete: false,
      isInitializingLegendState: false,
    }),

    updateLegendStateProgress: assign({
      legendStateProgress: ({ event }) => {
        if (event.type === 'legend-state:init-progress') {
          return {
            step: event.detail?.step || 'Initializing',
            progress: event.detail?.progress || 0,
            entitiesLoaded: event.detail?.entitiesLoaded || 0,
            totalEntities: event.detail?.totalEntities || 0
          };
        }
        return null;
      }
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
      
      // Multiple organizations - check if we have persisted organization preference
      if (context.currentOrganization) {
        const foundOrg = context.userOrganizations.find(org => org.id === context.currentOrganization.id);
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
    // Use input or defaults - snapshot restoration will handle persisted context
    log.info('[AuthMachine] Initializing context with input:', input?.user?.email || 'no user');
    return {
      user: input?.user || null,
      authToken: input?.authToken || null,
      authError: null,
      sessionExpiry: input?.sessionExpiry || null,
      lastActivity: Date.now(),
      errorRetryCount: 0,
      
      // Organization context
      currentOrganization: null,
      userOrganizations: [],
      organizationError: null,
      isLoadingOrganizations: false,
      organizationSetupComplete: false,
      needsOrganizationSetup: false,
      
      // Legend State initialization context - NEW
      legendStateSetupComplete: false,
      legendStateError: null,
      isInitializingLegendState: false,
      legendStateProgress: null,
      
      // Billing context
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
      entry: ({ context }) => {
        log.info('[AuthMachine] 🎯 TRANSITION: Starting initial state determination', {
          hasUser: !!context.user,
          hasToken: !!context.authToken,
          hasOrg: !!context.currentOrganization,
          legendStateComplete: context.legendStateSetupComplete
        });
      },
      always: [
        {
          // If we have valid session, organization AND persistence setup, go straight to ready
          guard: ({ context }) => {
            if (!context.user || !context.authToken || !context.sessionExpiry) {
              return false;
            }
            
            const sessionExpiry = new Date(context.sessionExpiry).getTime();
            const now = Date.now();
            const sessionValid = sessionExpiry > now && context.lastActivity && 
                                (now - context.lastActivity) < 24 * 60 * 60 * 1000;
            
            const orgReady = !!context.currentOrganization && context.organizationSetupComplete;
            const legendStateReady = context.legendStateSetupComplete;
            
            return sessionValid && orgReady && legendStateReady;
          },
          target: 'authenticated.ready',
          actions: [
            ({ context }) => log.info(`[AuthMachine] ✅ TRANSITION: Restored complete session: ${context.user?.email}, org: ${context.currentOrganization?.name}, legendState: ${context.legendStateSetupComplete}`),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: true, reason: 'session-restored-complete' }
            }
          ]
        },
        {
          // If we have valid session and org but no Legend State, need Legend State setup
          guard: ({ context }) => {
            if (!context.user || !context.authToken || !context.sessionExpiry) {
              return false;
            }
            
            const sessionExpiry = new Date(context.sessionExpiry).getTime();
            const now = Date.now();
            const sessionValid = sessionExpiry > now && context.lastActivity && 
                                (now - context.lastActivity) < 24 * 60 * 60 * 1000;
            
            const orgReady = !!context.currentOrganization && context.organizationSetupComplete;
            const legendStateNotReady = !context.legendStateSetupComplete;
            
            return sessionValid && orgReady && legendStateNotReady;
          },
          target: 'authenticated.initializingLegendState',
          actions: [
            ({ context }) => log.info(`[AuthMachine] ✅ TRANSITION: Restored session with org but needs Legend State init: ${context.user?.email}, org: ${context.currentOrganization?.name}`),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: true, reason: 'session-restored-needs-legend-state' }
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
            ({ context }) => log.info(`[AuthMachine] Valid session for ${context.user?.email}, loading organizations`),
            { 
              type: 'dispatchAuthStateChange',
              params: { authenticated: true, reason: 'session-restored-needs-org' }
            }
          ]
        },
        {
          // Otherwise, check auth
          target: 'checking',
          actions: () => log.info('[AuthMachine] No persisted session, checking auth status')
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
                // Set organization from session if available
                currentOrganization: ({ event }) => event.output.organization || null,
                organizationSetupComplete: ({ event }) => !!event.output.organization,
                needsOrganizationSetup: ({ event }) => !event.output.organization,
              }),
              { 
                type: 'dispatchAuthStateChange',
                params: ({ event }) => ({ 
                  authenticated: true, 
                  reason: event.output.fromPersisted ? 'restored-from-persisted' : 'check-success' 
                })
              },
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
        log.info('[AuthMachine] 🎯 Entering AUTHENTICATED state', {
          user: context.user?.email,
          hasOrgs: context.userOrganizations?.length > 0,
          currentOrg: context.currentOrganization?.id
        });
        
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

      // NEW: Always go through postAuthSetup for fresh logins
      // For restored sessions with everything already setup, check and skip to ready
      initial: 'determineFlow',
      
      states: {
        // NEW: Determine whether to do full setup or skip to ready
        determineFlow: {
          entry: () => log.info('[AuthMachine] 🔀 Determining auth flow...'),
          always: [
            {
              // ONLY skip to ready if EVERYTHING is truly complete from a restored session
              guard: ({ context }) => {
                const hasEverything = 
                  !!context.currentOrganization &&
                  context.organizationSetupComplete &&
                  context.legendStateSetupComplete &&
                  context.userOrganizations?.length > 0;
                
                if (hasEverything) {
                  log.warn('[AuthMachine] ⚠️ Skipping setup - restored session has everything', {
                    org: context.currentOrganization.id,
                    legendState: context.legendStateSetupComplete
                  });
                }
                return hasEverything;
              },
              target: 'ready'
            },
            {
              // For fresh sign-ins or incomplete sessions, go through full setup
              target: 'postAuthSetup',
              actions: [  
                // CRITICAL: Reset Legend State flag for fresh setup
                assign({
                  legendStateSetupComplete: false,
                  legendStateError: null
                }),
                () => log.info('[AuthMachine] 🚀 Starting post-auth setup sequence')
              ]
            }
          ]
        },
        
        // NEW: Sequential post-auth setup that guarantees all steps happen in order
        postAuthSetup: {
          initial: 'step1_loadOrganizations',
          
          states: {
            step1_loadOrganizations: {
              entry: () => log.info('[AuthMachine] 📋 Step 1: Loading organizations'),
              invoke: {
                src: 'loadOrganizations',
                onDone: {
                  target: 'step2_setupOrganization',
                  actions: [
                    'setUserOrganizations',
                    ({ context }) => log.info('[AuthMachine] ✅ Step 1 complete: Loaded', context.userOrganizations?.length || 0, 'organizations')
                  ]
                },
                onError: {
                  // Don't block on org loading failure - continue with defaults
                  target: 'step2_setupOrganization',
                  actions: [
                    'setOrganizationError',
                    () => log.error('[AuthMachine] ⚠️ Step 1 failed but continuing')
                  ]
                }
              }
            },
            
            step2_setupOrganization: {
              entry: () => log.info('[AuthMachine] 📋 Step 2: Setting up organization'),
              always: [
                {
                  // If we already have an org, continue
                  guard: ({ context }) => !!context.currentOrganization,
                  target: 'step3_initializeLegendState',
                  actions: () => log.info('[AuthMachine] ✅ Step 2: Using existing organization')
                },
                {
                  // Auto-select first org if available
                  guard: ({ context }) => context.userOrganizations?.length > 0,
                  target: 'step3_initializeLegendState',
                  actions: [
                    'autoSelectOrganization',
                    ({ context }) => log.info('[AuthMachine] ✅ Step 2: Auto-selected organization', context.currentOrganization?.id)
                  ]
                },
                {
                  // No orgs available - create default personal org
                  target: 'creatingDefaultOrg'
                }
              ]
            },
            
            creatingDefaultOrg: {
              entry: () => log.info('[AuthMachine] 📋 Step 2b: Creating default personal organization'),
              invoke: {
                src: 'createDefaultPersonalOrg',
                input: ({ context }) => ({ userId: context.user?.id }),
                onDone: {
                  target: 'step3_initializeLegendState',
                  actions: [
                    assign({
                      currentOrganization: ({ event }) => (event as any).output?.organization,
                      userOrganizations: ({ event, context }) => [...(context.userOrganizations || []), (event as any).output?.organization].filter(Boolean)
                    }),
                    () => log.info('[AuthMachine] ✅ Step 2b: Created default organization')
                  ]
                },
                onError: {
                  // Continue even if org creation fails
                  target: 'step3_initializeLegendState',
                  actions: () => log.error('[AuthMachine] ⚠️ Step 2b failed but continuing')
                }
              }
            },
            
            step3_initializeLegendState: {
              entry: () => log.info('[AuthMachine] 📋 Step 3: Initializing Legend State'),
              invoke: {
                src: 'legendStateInit',
                input: ({ context }) => {
                  const organizationIds = context.userOrganizations?.map(org => org.id) || [];
                  const organizationData = context.userOrganizations?.map(org => ({
                    id: org.id,
                    name: org.name
                  })) || [];
                  
                  log.info('[AuthMachine] 🎯 Invoking Legend State machine with:', {
                    userId: context.user?.id,
                    organizationIds,
                    currentOrgId: context.currentOrganization?.id,
                    orgCount: organizationData.length,
                    orgData: organizationData  // Added debug output
                  });
                  return {
                    userId: context.user?.id || '',
                    organizationIds,
                    currentOrgId: context.currentOrganization?.id,
                    organizationData
                  };
                },
                onDone: {
                  target: 'step4_complete',
                  actions: [
                    'setLegendStateSuccess',
                    () => log.info('[AuthMachine] ✅ Step 3 complete: Legend State initialized')
                  ]
                },
                onError: {
                  // Don't block on Legend State failure
                  target: 'step4_complete',
                  actions: [
                    'setLegendStateError',
                    ({ event }) => log.error('[AuthMachine] ⚠️ Step 3 failed:', event.error, 'but continuing')
                  ]
                }
              }
            },
            
            step4_complete: {
              type: 'final' as const,
              entry: () => log.info('[AuthMachine] 🎉 Post-auth setup sequence complete!')
            }
          },
          
          onDone: {
            target: 'ready',
            actions: () => log.info('[AuthMachine] ➡️ Transitioning to READY state')
          }
        },
        
        loadingOrganizations: {
          entry: [
            'setLoadingOrganizations',
            ({ context }) => log.info('[AuthMachine] 📥 LOADING ORGANIZATIONS:', {
              userId: context.user?.id,
              currentLegendStateComplete: context.legendStateSetupComplete,
              currentOrgId: context.currentOrganization?.id,
              organizationSetupComplete: context.organizationSetupComplete
            })
          ],
          invoke: {
            src: 'loadOrganizations',
            onDone: [
              {
                // If we have current organization but no persistence, set up persistence
                target: 'initializingLegendState',
                guard: ({ context }) => !!context.currentOrganization && context.organizationSetupComplete && !context.legendStateSetupComplete,
                actions: [
                  'setUserOrganizations', 
                  'clearLoadingOrganizations',
                  ({ context }) => log.info('[AuthMachine] ✅ From loadingOrganizations -> initializingLegendState (Legend State NOT complete)', {
                    orgId: context.currentOrganization?.id,
                    legendStateSetupComplete: context.legendStateSetupComplete
                  })
                ]
              },
              {
                // If we already have current organization AND persistence is complete, go to ready
                target: 'ready',
                guard: ({ context }) => !!context.currentOrganization && context.organizationSetupComplete && context.legendStateSetupComplete,
                actions: [
                  'setUserOrganizations', 
                  'clearLoadingOrganizations',
                  ({ context }) => log.error('[AuthMachine] ❌ BYPASSING Legend State init - going directly to ready!', {
                    orgId: context.currentOrganization?.id,
                    legendStateSetupComplete: context.legendStateSetupComplete,
                    organizationSetupComplete: context.organizationSetupComplete,
                    note: 'This is the problematic path - Legend State might not actually be initialized!'
                  })
                ]
              },
              {
                // Otherwise, continue with the normal flow (billing then org selection)
                target: 'loadingBilling',
                actions: [
                  'setUserOrganizations', 
                  'clearLoadingOrganizations',
                  ({ context }) => log.info('[AuthMachine] ➡️ From loadingOrganizations -> loadingBilling (normal flow)', {
                    hasCurrentOrg: !!context.currentOrganization,
                    legendStateSetupComplete: context.legendStateSetupComplete
                  })
                ]
              }
            ],
            onError: {
              target: 'checkingOrganizationSetup',
              actions: ['setOrganizationError']
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
              actions: ['setBillingInfo', 'clearLoadingBilling']
            },
            onError: {
              target: 'checkingOrganizationSetup',
              actions: ['setBillingError', 'clearLoadingBilling']
            }
          }
        },

        checkingOrganizationSetup: {
          entry: ({ context }) => {
            log.info('[AuthMachine] 🔍 CHECKING ORGANIZATION SETUP:', {
              hasOrganizations: !!context.userOrganizations?.length,
              orgCount: context.userOrganizations?.length || 0,
              hasCurrentOrg: !!context.currentOrganization,
              currentOrgId: context.currentOrganization?.id,
              legendStateSetupComplete: context.legendStateSetupComplete,
              legendStateError: context.legendStateError
            });
          },
          always: [
            {
              target: 'needsOrganizationSetup',
              guard: 'hasNoOrganizations',
              actions: [() => log.info('[AuthMachine] ➡️ Transitioning to needsOrganizationSetup - no organizations found')]
            },
            {
              target: 'needsOrganizationSelection',
              guard: 'hasNoCurrentOrganization',
              actions: [() => log.info('[AuthMachine] ➡️ Transitioning to needsOrganizationSelection - no current organization')]
            },
            {
              // If we have org but no persistence, set up persistence
              target: 'initializingLegendState',
              guard: ({ context }) => !!context.currentOrganization && !context.legendStateSetupComplete,
              actions: [({ context }) => log.info('[AuthMachine] ➡️ Transitioning to initializingLegendState - have org but Legend State not complete', {
                orgId: context.currentOrganization?.id,
                legendStateSetupComplete: context.legendStateSetupComplete
              })]
            },
            {
              // If we have org and persistence is complete, go to ready
              target: 'ready',
              guard: ({ context }) => !!context.currentOrganization && context.legendStateSetupComplete,
              actions: [({ context }) => log.warn('[AuthMachine] ⚠️ SKIPPING Legend State init - already complete!', {
                orgId: context.currentOrganization?.id,
                legendStateSetupComplete: context.legendStateSetupComplete,
                note: 'This might be stale state - Legend State may not actually be initialized'
              })]
            },
            {
              // Auto-select organization and set up persistence - this is the normal path
              target: 'initializingLegendState',
              actions: [
                'autoSelectOrganization',
                () => log.info('[AuthMachine] ➡️ Auto-selecting organization and transitioning to initializingLegendState')
              ]
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
          entry: [], // Ready for organization selection
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
              target: 'initializingLegendState',
              actions: ['setCurrentOrganization', 'markSetupComplete']
            },
            onError: {
              target: 'needsOrganizationSetup',
              actions: ['setOrganizationError']
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
              target: 'initializingLegendState',
              actions: ['setCurrentOrganization']
            },
            onError: {
              target: 'needsOrganizationSelection',
              actions: ['setOrganizationError']
            }
          }
        },

        trialExpiredSetup: {
          on: {
            UPGRADE_SUBSCRIPTION: {
              target: 'upgradingSubscription'
            },
            CONTINUE_WITH_LIMITS: {
              target: 'initializingLegendState',
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
              target: 'initializingLegendState',
              actions: ['setBillingInfo', 'markSetupComplete']
            },
            onError: {
              target: 'trialExpiredSetup',
              actions: 'setBillingError'
            }
          }
        },

        switchingOrganization: {
          invoke: {
            src: 'switchOrganization',
            input: ({ event }) => ({
              organizationId: event.type === 'SWITCH_ORGANIZATION' ? event.organizationId : ''
            }),
            onDone: {
              target: 'initializingLegendState',
              actions: [
                assign({
                  user: ({ event }) => event.output.user,
                  authToken: ({ event }) => event.output.authToken,
                  sessionExpiry: ({ event }) => event.output.sessionExpiry,
                  currentOrganization: ({ event }) => event.output.organization,
                  organizationSetupComplete: true,
                  organizationError: null,
                  // Reset Legend State setup when switching orgs
                  legendStateSetupComplete: false,
                  legendStateProgress: null,
                }),
                ]
            },
            onError: {
              target: 'ready',
              actions: assign({
                organizationError: ({ event }) => event.error?.message || 'Failed to switch organization'
              })
            }
          }
        },

        initializingLegendState: {
          entry: [
            'setLoadingLegendState',
            ({ context }) => log.info(`[AuthMachine] 🎯 TRANSITION: Entering initializingLegendState for user: ${context.user?.email}, org: ${context.currentOrganization?.name}`)
          ],
          
          // RE-ENABLED: Legend State machine integration for universe context
          invoke: {
            src: 'legendStateInit',
            input: ({ context }) => {
              // Always pass ALL organizations for universe mode
              const organizationIds = context.userOrganizations?.map(org => org.id) || [];
              const organizationData = context.userOrganizations?.map(org => ({
                id: org.id,
                name: org.name
              })) || [];
              
              log.info(`[AuthMachine] Passing to Legend State machine for universe mode:`, {
                organizationIds,
                userId: context.user?.id,
                currentOrgId: context.currentOrganization?.id,
                totalOrgs: organizationIds.length
              });
              
              return {
                userId: context.user?.id || '',
                organizationIds,
                organizationData,
                // Pass current org for reference but Legend State will load all orgs
                currentOrgId: context.currentOrganization?.id
              };
            },
            
            onDone: {
              target: 'ready',
              actions: [
                'setLegendStateSuccess', 
                'clearLoadingLegendState',
                ({ context }) => log.info(`[AuthMachine] ✅ Legend State initialization completed for user: ${context.user?.email}`)
              ]
            },
            
            onError: {
              // Don't block auth flow on Legend State failure - continue to ready with fallback
              target: 'ready',
              actions: ['setLegendStateError', 'clearLoadingLegendState']
            }
          },
          
          // Listen for progress events from the Legend State init machine
          on: {
            'legend-state:init-progress': {
              actions: 'updateLegendStateProgress'
            }
          }
        },

        ready: {
          entry: ({ context }) => {
            log.info(`[AuthMachine] 🎯 TRANSITION: Reached READY state - auth flow complete!`, {
              user: context.user?.email,
              org: context.currentOrganization?.name,
              legendState: context.legendStateSetupComplete
            });
            
            // Dispatch event that the full auth + org flow is complete
            window.dispatchEvent(new CustomEvent('auth:ready', {
              detail: {
                user: context.user,
                organization: context.currentOrganization,
                setupComplete: true
              }
            }));
            
            // 🔄 SYNC: Connect sync machine when auth is fully ready
            const syncActor = (window as any).simpleNotificationSyncMachineActor;
            if (syncActor && context.user?.id && context.currentOrganization?.id) {
              log.info('[AuthMachine] ✅ TRANSITION: Triggering sync connection - auth ready');
              syncActor.send({ 
                type: 'CONNECT', 
                organizationId: context.currentOrganization.id,
                userId: context.user.id
              });
            } else {
              log.warn('[AuthMachine] ⚠️ TRANSITION: Sync actor not found or missing org/user data', {
                syncActor: !!syncActor,
                userId: context.user?.id,
                orgId: context.currentOrganization?.id
              });
            }
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
              target: 'switchingOrganization'
            },
            UPGRADE_SUBSCRIPTION: {
              target: 'upgradingSubscription'
            }
          }
        }
      },
      
      on: {
        SIGN_OUT: 'signingOut',
        SESSION_FAULT: {
          target: 'signingOut',
          actions: [
            ({ context }) => log.info('[AuthMachine] Session fault detected, signing out:', context.user?.email),
            assign({
              authError: 'Session has expired or become invalid'
            })
          ]
        },
        CHECK_AUTH: 'checking',
      }
    },
    
    unauthenticated: {
      // entry: () => log.info('[AuthMachine] User not authenticated'),
      
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
      // entry: () => log.info('[AuthMachine] Starting sign-in process'),
      
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
                // Set organization from session if available
                currentOrganization: ({ event }) => event.output.organization || null,
                organizationSetupComplete: ({ event }) => !!event.output.organization,
                needsOrganizationSetup: ({ event }) => !event.output.organization,
              }),
              assign({
                // Reset Legend State on fresh sign-in to ensure it always initializes
                legendStateSetupComplete: false,
                legendStateError: null,
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
      // entry: () => log.info('[AuthMachine] Starting sign-out process'),
      
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
        log.info('[AuthMachine] Entering error recovery state', {
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