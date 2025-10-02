/**
 * App Initialization Stage Manager
 *
 * Applies VibeGrid's loading pattern to app-wide initialization
 * Coordinates sequential loading with observable dependency tracking
 */

import { observable, batch, when } from '@legendapp/state';
import { log } from '@/logger';
import { auth$ } from './auth';
import { unifiedAuth$ } from './unified-auth';
import { loadUniverseContext, universeContext$, universeSchema$ } from './observables';
import { OptionsManager } from './reference-system/options-manager';
import { initializeDexieDB } from './persistence/DexieEntityDB';
import { initializeSyncLayer } from './persistence/DexieSyncLayer';

const fileLog = log('legend-state/app-initialization-stages.ts');

// Create a prefixed logger for app initialization
const initLog = {
  info: (message: string, data?: any) => fileLog.info(`[APP-INIT] ${message}`, data),
  debug: (message: string, data?: any) => fileLog.debug(`[APP-INIT] ${message}`, data),
  warn: (message: string, data?: any) => fileLog.warn(`[APP-INIT] ${message}`, data),
  error: (message: string, data?: any) => fileLog.error(`[APP-INIT] ${message}`, data),
};

export type AppLoadingStage =
  | 'idle'                // Initial state
  | 'auth'               // Checking authentication
  | 'organizations'      // Loading user organizations
  | 'universe'          // Loading universe context/schemas
  | 'persistence'       // Setting up IndexedDB persistence (after schemas load)
  | 'entities'          // Initial entity data load
  | 'sync'              // Initialize sync connection
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
 * Global app initialization stage manager with HMR persistence
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

// HMR: Preserve app initialization state across hot reloads
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    initLog.info('🔥 HMR: Preserving app initialization state');
    // Legend State observables persist automatically
  });

  import.meta.hot.accept(() => {
    initLog.info('🔥 HMR: App initialization state preserved');
    // Don't reset if already ready
    if (appInitStage$.stage.get() === 'ready') {
      initLog.info('🔥 HMR: App already initialized, skipping reset');
    }
  });
}

// Define methods as separate functions to avoid circular references
const appInitMethods = {
  // Progress tracking
  get progress(): number {
    const stages: AppLoadingStage[] = ['idle', 'auth', 'organizations', 'universe', 'persistence', 'entities', 'sync', 'options', 'ready'];
    const currentIndex = stages.indexOf(appInitStage$.stage.get());
    const totalStages = stages.length - 1; // Don't count 'idle'
    return Math.max(0, currentIndex) / totalStages;
  },

  get progressPercent(): number {
    const stages: AppLoadingStage[] = ['idle', 'auth', 'organizations', 'universe', 'persistence', 'entities', 'sync', 'options', 'ready'];
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
      case 'persistence': return 'Setting up local cache...';
      case 'entities': return 'Loading entity data...';
      case 'sync': return 'Connecting to sync...';
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

  get canSetupPersistence() {
    return appInitStage$.stage.get() === 'universe';
  },

  get canLoadEntities() {
    return appInitStage$.stage.get() === 'persistence';
  },

  get canLoadSync() {
    return appInitStage$.stage.get() === 'entities';
  },

  get canLoadOptions() {
    return appInitStage$.stage.get() === 'sync';
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
        case 'persistence':
          success = await this.executePersistenceSetup();
          break;
        case 'entities':
          success = await this.executeInitialEntitiesLoad();
          break;
        case 'sync':
          success = await this.executeSyncConnection();
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

    try {
      const user = unifiedAuth$.user.get();
      const userOrganizations = unifiedAuth$.userOrganizations.get();

      initLog.info('🌌 Universe load debug - user and orgs:', {
        hasUser: !!user,
        userEmail: user?.email,
        orgCount: userOrganizations?.length || 0
      });

      if (!user || !userOrganizations) {
        throw new Error('User or organizations not available');
      }

      // FIXED: Actually call loadUniverseContext to populate universe context from auth organizations
      initLog.info('🌌 Loading universe context from auth organizations');

      const organizationIds = userOrganizations.map(org => org.id);
      const organizationData = userOrganizations.map(org => ({ id: org.id, name: org.name }));

      try {
        await loadUniverseContext(user.id, organizationIds, organizationData);
        initLog.info(`✅ Universe context loaded with ${organizationIds.length} organizations`);
      } catch (error) {
        initLog.error(`❌ loadUniverseContext failed:`, error);
        throw error;
      }

      // ✅ Auto-advance to persistence stage after universe context is loaded
      if (this.canSetupPersistence) {
        initLog.info(`🌌 Advancing to persistence stage...`);
        await this.advanceToStage('persistence');
      }

      return true;

    } catch (error) {
      initLog.error('❌ [Universe] executeUniverseLoad failed:', error);
      this.handleError(error as Error);
      return false;
    }
  },

  async executePersistenceSetup(): Promise<boolean> {
    initLog.debug('💾 Setting up Dexie entity cache');

    try {
      const user = unifiedAuth$.user.get();
      const userOrganizations = unifiedAuth$.userOrganizations.get();

      if (!user) {
        throw new Error('User not available for cache setup');
      }

      // Load schema from localStorage for instant warm start
      const { loadSchemaFromLocalStorage, storeSchemaInLocalStorage } = await import('./persistence/DexieEntityDB');
      const cachedSchemas = loadSchemaFromLocalStorage(user.id);

      if (cachedSchemas && Object.keys(cachedSchemas).length > 0) {
        initLog.info(`💾 Warm start: ${Object.keys(cachedSchemas).length} entities from cache`);

        // Open Dexie with cached schema
        const dexie = initializeDexieDB(user.id, cachedSchemas);
        await dexie.open();

        // Initialize sync layer - will check schema hash
        const syncLayer = initializeSyncLayer();
        const entityTypes = Object.keys(cachedSchemas);

        // Returns immediately if hash matches, or triggers background rebuild if changed
        await syncLayer.initializeWithSchemaCheck(user.id, cachedSchemas);

        // Setup queries for entities
        syncLayer.setupLiveQueries(entityTypes);
        syncLayer.initializeSyncListeners(entityTypes);

      } else {
        initLog.info('💾 Cold start: Loading schemas...');

        // Cold start - wait for schemas to create tables
        await when(() => {
          const schema = universeSchema$.get();
          const entityCount = schema?.entities ? Object.keys(schema.entities).length : 0;
          return entityCount >= 20;
        });

        const schemas = universeSchema$.peek();

        // Store schema in localStorage for future instant warm starts
        storeSchemaInLocalStorage(user.id, schemas.entities);

        const dexie = initializeDexieDB(user.id, schemas.entities);
        await dexie.open();

        // Initialize sync layer
        const syncLayer = initializeSyncLayer();
        const entityTypes = Object.keys(schemas.entities);

        await syncLayer.initializeWithSchemaCheck(user.id, schemas.entities);

        syncLayer.setupLiveQueries(entityTypes);
        syncLayer.initializeSyncListeners(entityTypes);
      }

      initLog.info('✅ Dexie cache ready');

      // Auto-advance to entities
      if (this.canLoadEntities) {
        await this.advanceToStage('entities');
      }

      return true;

    } catch (error) {
      initLog.error('❌ [Dexie] executePersistenceSetup failed:', error);

      // Continue without cache (server-only mode)
      initLog.warn('Continuing without Dexie cache, using direct API calls');

      if (this.canLoadEntities) {
        await this.advanceToStage('entities');
      }

      return true;  // Don't fail app initialization
    }
  },

  async executeInitialEntitiesLoad(): Promise<boolean> {
    initLog.debug('📊 Verifying entity system ready');

    // Entity data loads reactively via observables
    // Just verify universe is not loading

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

    initLog.debug('✅ Entity system ready');

    // Auto-advance to sync
    if (this.canLoadSync) {
      await this.advanceToStage('sync');
    }

    return true;
  },

  async executeSyncConnection(): Promise<boolean> {
    initLog.debug('🔗 Initializing sync connection');

    try {
      // Get user and organization info
      const user = unifiedAuth$.user.get();
      const userOrganizations = unifiedAuth$.userOrganizations.get();

      if (!user || !userOrganizations || userOrganizations.length === 0) {
        throw new Error('User or organizations not available for sync connection');
      }

      // Use the first organization for sync connection
      const primaryOrganization = userOrganizations[0];

      initLog.info('🔗 Connecting sync to organization:', {
        orgId: primaryOrganization.id,
        orgName: primaryOrganization.name,
        userId: user.id
      });

      // Import sync actions
      const { syncActions } = await import('./sync-manager');

      // Connect to sync
      await syncActions.connect(primaryOrganization.id, user.id);

      initLog.info('✅ Sync connection established');

      // Auto-advance to options
      if (this.canLoadOptions) {
        await this.advanceToStage('options');
      }

      return true;

    } catch (error) {
      initLog.error('❌ Sync connection failed:', error);
      // Don't fail the entire initialization if sync fails - continue to options
      initLog.warn('⚠️ Continuing without sync (sync will retry automatically)');

      // Auto-advance to options even if sync fails
      if (this.canLoadOptions) {
        await this.advanceToStage('options');
      }

      return true; // Don't fail initialization
    }
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
    // Don't reset if already ready (preserve across HMR)
    if (appInitStage$.stage.get() === 'ready') {
      initLog.info('🔄 Skipping reset - app already initialized and ready');
      return;
    }

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
    // Don't restart if already ready
    if (appInitStage$.stage.get() === 'ready') {
      initLog.info('🚀 App already initialized, skipping restart');
      return true;
    }

    console.log('🚀 INIT METHOD CALLED - Starting app initialization sequence');
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

// Export methods with proper binding
export const appInitMethods$ = {
  initialize: appInitMethods.initialize.bind(appInitMethods),
  reset: appInitMethods.reset.bind(appInitMethods),
  markReady: appInitMethods.markReady.bind(appInitMethods),
  retry: appInitMethods.retry.bind(appInitMethods),
  getDetailedStatus: appInitMethods.getDetailedStatus.bind(appInitMethods)
};

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