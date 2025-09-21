/**
 * App Initialization Stage Manager
 *
 * Applies VibeGrid's loading pattern to app-wide initialization
 * Coordinates sequential loading with observable dependency tracking
 */

import { observable, batch } from '@legendapp/state';
import { log } from '@/logger';
import { auth$ } from './auth';
import { unifiedAuth$ } from './unified-auth';
import { loadUniverseContext, universeContext$ } from './observables';
import { OptionsManager } from './reference-system/options-manager';

const fileLog = log('legend-state/app-initialization-stages.ts');

// Create a prefixed logger for app initialization
const initLog = {
  info: (message: string, data?: any) => fileLog.debug(`[APP-INIT] ${message}`, data), // Changed to debug level
  debug: (message: string, data?: any) => fileLog.debug(`[APP-INIT] ${message}`, data),
  warn: (message: string, data?: any) => fileLog.warn(`[APP-INIT] ${message}`, data),
  error: (message: string, data?: any) => fileLog.error(`[APP-INIT] ${message}`, data),
};

export type AppLoadingStage =
  | 'idle'                // Initial state
  | 'auth'               // Checking authentication
  | 'organizations'      // Loading user organizations
  | 'universe'          // Loading universe context/schemas
  | 'entities'          // Initial entity data load
  | 'options'           // Preloading common options (needs entities)
  | 'ready'            // Fully initialized
  | 'error';           // Error state

export interface AppLoadingContext {
  startTime: number;
  errors: Error[];
  completedStages: Set<AppLoadingStage>;
  stageTimings: Map<AppLoadingStage, { start: number; end?: number; duration?: number }>;
  currentStageStartTime?: number;
  totalLoadTime?: number;
  retryCount: number;
}

/**
 * Global app initialization stage manager
 */
export const appInitStage$ = observable({
  stage: 'idle' as AppLoadingStage,

  context: {
    startTime: Date.now(),
    errors: [],
    completedStages: new Set<AppLoadingStage>(),
    stageTimings: new Map(),
    currentStageStartTime: undefined,
    totalLoadTime: undefined,
    retryCount: 0
  } as AppLoadingContext,
});

// Define methods as separate functions to avoid circular references
const appInitMethods = {
  // Progress tracking
  get progress(): number {
    const stages: AppLoadingStage[] = ['idle', 'auth', 'organizations', 'universe', 'entities', 'options', 'ready'];
    const currentIndex = stages.indexOf(appInitStage$.stage.get());
    const totalStages = stages.length - 1; // Don't count 'idle'
    return Math.max(0, currentIndex) / totalStages;
  },

  get progressPercent(): number {
    const stages: AppLoadingStage[] = ['idle', 'auth', 'organizations', 'universe', 'entities', 'options', 'ready'];
    const currentIndex = stages.indexOf(appInitStage$.stage.get());
    const totalStages = stages.length - 1; // Don't count 'idle'
    const progress = Math.max(0, currentIndex) / totalStages;
    return Math.round(progress * 100);
  },

  get progressMessage(): string {
    switch (appInitStage$.stage.get()) {
      case 'idle': return 'Starting up...';
      case 'auth': return 'Checking authentication...';
      case 'organizations': return 'Loading organizations...';
      case 'universe': return 'Loading schemas...';
      case 'entities': return 'Loading entity data...';
      case 'options': return 'Loading system options...';
      case 'ready': return 'Ready!';
      case 'error': return 'Initialization failed';
      default: return 'Loading...';
    }
  },

  // Stage progression gates - simplified to just check if we're in the right stage
  get canLoadOrganizations() {
    return appInitStage$.stage.get() === 'auth';
  },

  get canLoadUniverse() {
    return appInitStage$.stage.get() === 'organizations';
  },

  get canLoadEntities() {
    return appInitStage$.stage.get() === 'universe';
  },

  get canLoadOptions() {
    return appInitStage$.stage.get() === 'entities';
  },

  get isReady() {
    return appInitStage$.stage.get() === 'ready';
  },

  get hasError() {
    return appInitStage$.stage.get() === 'error' || appInitStage$.context.errors.get().length > 0;
  },

  // Stage transition methods
  async advanceToStage(targetStage: AppLoadingStage): Promise<boolean> {
    try {
      const previousStage = appInitStage$.stage.get();

      initLog.info(`🔄 Stage transition`, {
        from: previousStage,
        to: targetStage,
        elapsed: Date.now() - appInitStage$.context.startTime.get()
      });

      // Mark previous stage as complete and update timing
      if (previousStage !== 'idle') {
        const timing = appInitStage$.context.stageTimings.get().get(previousStage);
        if (timing) {
          timing.end = Date.now();
          timing.duration = timing.end - timing.start;
        }
      }

      // Start timing for new stage
      const stageStartTime = Date.now();
      appInitStage$.context.stageTimings.get().set(targetStage, { start: stageStartTime });

      batch(() => {
        if (previousStage !== 'idle') {
          appInitStage$.context.completedStages.get().add(previousStage);
        }
        appInitStage$.stage.set(targetStage);
        appInitStage$.context.currentStageStartTime.set(stageStartTime);
      });

      // Execute stage-specific loading
      let success = false;

      switch (targetStage) {
        case 'auth':
          success = await this.executeAuthCheck();
          break;
        case 'organizations':
          success = await this.executeOrganizationsLoad();
          break;
        case 'universe':
          success = await this.executeUniverseLoad();
          break;
        case 'entities':
          success = await this.executeInitialEntitiesLoad();
          break;
        case 'options':
          success = await this.executeOptionsPreload();
          break;
        case 'ready':
          success = this.markReady();
          break;
        default:
          success = true;
          break;
      }

      return success;

    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  },

  async executeAuthCheck(): Promise<boolean> {
    initLog.debug('🔐 Checking authentication status');

    // Wait for auth to stabilize
    if (auth$.loading.get()) {
      await new Promise<void>((resolve) => {
        const unsubscribe = auth$.loading.onChange(() => {
          if (!auth$.loading.get()) {
            unsubscribe();
            resolve();
          }
        });
      });
    }

    const isAuthenticated = unifiedAuth$.isAuthenticated.get();

    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    initLog.info('✅ Authentication verified');

    // Auto-advance to organizations
    if (this.canLoadOrganizations) {
      await this.advanceToStage('organizations');
    }

    return true;
  },

  async executeOrganizationsLoad(): Promise<boolean> {
    initLog.debug('🏢 Loading user organizations');

    // Wait for organizations to load if still loading
    if (auth$.loadingOrganizations.get()) {
      await new Promise<void>((resolve) => {
        const unsubscribe = auth$.loadingOrganizations.onChange(() => {
          if (!auth$.loadingOrganizations.get()) {
            unsubscribe();
            resolve();
          }
        });
      });
    }

    const userOrganizations = unifiedAuth$.userOrganizations.get();

    if (!userOrganizations || userOrganizations.length === 0) {
      throw new Error('No organizations available for user');
    }

    initLog.info(`✅ Loaded ${userOrganizations.length} organizations`);

    // Auto-advance to universe
    if (this.canLoadUniverse) {
      await this.advanceToStage('universe');
    }

    return true;
  },

  async executeUniverseLoad(): Promise<boolean> {
    initLog.debug('🌌 Loading universe context and schemas');

    const user = unifiedAuth$.user.get();
    const userOrganizations = unifiedAuth$.userOrganizations.get();

    if (!user || !userOrganizations) {
      throw new Error('User or organizations not available');
    }

    const orgIds = userOrganizations.map(org => org.id);

    // Load universe context (schemas for all orgs)
    await loadUniverseContext(user.id, orgIds, userOrganizations);

    // Verify universe loaded
    const universeOrgs = Object.keys(universeContext$.organizations.get());
    if (universeOrgs.length === 0) {
      throw new Error('Failed to load universe context');
    }

    initLog.info(`✅ Universe context loaded with ${universeOrgs.length} organizations`);

    // Auto-advance to entities
    if (this.canLoadEntities) {
      await this.advanceToStage('entities');
    }

    return true;
  },

  async executeInitialEntitiesLoad(): Promise<boolean> {
    initLog.debug('📊 Loading initial entity data');

    // Entity data loads reactively via observables
    // We just need to verify the system is ready

    const universeLoading = universeContext$.loading.get();
    if (universeLoading) {
      await new Promise<void>((resolve) => {
        const unsubscribe = universeContext$.loading.onChange(() => {
          if (!universeContext$.loading.get()) {
            unsubscribe();
            resolve();
          }
        });
      });
    }

    initLog.info('✅ Entity system ready');

    // Auto-advance to options
    if (this.canLoadOptions) {
      await this.advanceToStage('options');
    }

    return true;
  },

  async executeOptionsPreload(): Promise<boolean> {
    initLog.debug('⚙️ Preloading system options');

    try {
      // This will now check for organizations before attempting to load
      OptionsManager.preloadSystemOptions();

      initLog.info('✅ System options preload initiated');

      // Mark as ready after options
      this.markReady();

      return true;
    } catch (error) {
      initLog.warn('Options preload failed (non-fatal):', error);
      // Continue anyway - options will load on demand
      return true;
    }
  },

  markReady(): boolean {
    const currentStage = appInitStage$.stage.get();
    const timing = appInitStage$.context.stageTimings.get().get(currentStage);
    if (timing) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;
    }

    batch(() => {
      appInitStage$.context.completedStages.get().add(currentStage);
      appInitStage$.context.totalLoadTime.set(Date.now() - appInitStage$.context.startTime.get());
      appInitStage$.stage.set('ready');
      appInitStage$.context.currentStageStartTime.set(undefined);
    });

    initLog.info(`🎉 App initialization complete`, {
      totalTime: appInitStage$.context.totalLoadTime.get(),
      stages: Array.from(appInitStage$.context.completedStages.get())
    });

    return true;
  },

  handleError(error: Error): void {
    const currentStage = appInitStage$.stage.get();
    initLog.error(`❌ App initialization error in ${currentStage} stage`, {
      stage: currentStage,
      error: error.message
    });

    batch(() => {
      appInitStage$.context.errors.get().push(error);
      appInitStage$.stage.set('error');
      appInitStage$.context.currentStageStartTime.set(undefined);
    });
  },

  reset(): void {
    initLog.info('🔄 Resetting app initialization');

    batch(() => {
      appInitStage$.stage.set('idle');
      appInitStage$.context.startTime.set(Date.now());
      appInitStage$.context.errors.set([]);
      appInitStage$.context.completedStages.get().clear();
      appInitStage$.context.stageTimings.get().clear();
      appInitStage$.context.currentStageStartTime.set(undefined);
      appInitStage$.context.totalLoadTime.set(undefined);
      appInitStage$.context.retryCount.set(0);
    });
  },

  // Initialize the app loading sequence
  async initialize(): Promise<boolean> {
    initLog.info('🚀 Starting app initialization sequence');
    this.reset();

    // Start the initialization chain
    await this.advanceToStage('auth');

    // Wait for initialization to complete or error
    return new Promise<boolean>((resolve) => {
      const checkCompletion = () => {
        const currentStage = appInitStage$.stage.get();
        if (currentStage === 'ready') {
          initLog.info('✅ App initialization completed successfully');
          resolve(true);
        } else if (currentStage === 'error') {
          initLog.error('❌ App initialization failed');
          resolve(false);
        } else {
          // Check again in a moment
          setTimeout(checkCompletion, 50);
        }
      };
      checkCompletion();
    });
  },

  // Retry failed initialization
  async retry(): Promise<boolean> {
    initLog.info('♻️ Retrying app initialization');
    appInitStage$.context.retryCount.set(appInitStage$.context.retryCount.get() + 1);

    // Clear errors and reset to idle
    appInitStage$.context.errors.set([]);
    appInitStage$.stage.set('idle');

    return await this.initialize();
  },

  // Get detailed status for debugging
  getDetailedStatus() {
    return {
      stage: appInitStage$.stage.get(),
      isReady: this.isReady,
      hasError: this.hasError,
      progress: this.progress,
      progressPercent: this.progressPercent,
      progressMessage: this.progressMessage,
      totalElapsed: Date.now() - appInitStage$.context.startTime.get(),
      completedStages: Array.from(appInitStage$.context.completedStages.get()),
      errors: appInitStage$.context.errors.get().map(e => e.message),
      retryCount: appInitStage$.context.retryCount.get(),
      stageTimings: Object.fromEntries(appInitStage$.context.stageTimings.get())
    };
  }
};

// Export methods separately for easier access
export const appInitMethods$ = appInitMethods;

/**
 * Hook for using app initialization state in components
 */
import { useSelector } from '@legendapp/state/react';

export function useAppInitialization() {
  const stage = useSelector(appInitStage$.stage);
  const progress = useSelector(() => appInitMethods.progress);
  const progressPercent = useSelector(() => appInitMethods.progressPercent);
  const progressMessage = useSelector(() => appInitMethods.progressMessage);
  const isReady = useSelector(() => appInitMethods.isReady);
  const hasError = useSelector(() => appInitMethods.hasError);
  const errors = useSelector(() => appInitStage$.context.errors);

  return {
    stage,
    progress,
    progressPercent,
    progressMessage,
    isReady,
    hasError,
    errors,
    retry: () => appInitMethods.retry(),
    getStatus: () => appInitMethods.getDetailedStatus()
  };
}