// ====================================
// EVENT SYSTEM MIGRATION LAYER
// ====================================
// 
// This file provides a migration path from the current
// fragmented event systems to the unified EventDelegationManager
//
// It allows gradual transition while maintaining backwards compatibility

import { EventDelegationManager, type EventDelegationConfig } from './EventDelegationManager';
import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from '../machines/table-machine';

// ====================================
// MIGRATION CONFIGURATION
// ====================================

export interface MigrationConfig {
  container: HTMLElement;
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send'];
  
  // Feature flags for gradual migration
  featureFlags: {
    useUnifiedMouseEvents: boolean;
    useUnifiedKeyboardEvents: boolean;
    useUnifiedFocusManagement: boolean;
    useUnifiedScrollEvents: boolean;
    useUnifiedDragEvents: boolean;
  };
  
  // Legacy system references for backwards compatibility
  legacySystems?: {
    eventSystem?: any; // EventSystem.ts instance
    reactHandlers?: {
      handleMouseDown?: (event: MouseEvent) => void;
      handleMouseMove?: (event: MouseEvent) => void;
      handleMouseUp?: (event: MouseEvent) => void;
      handleKeyDown?: (event: KeyboardEvent) => void;
    };
  };
}

// ====================================
// MIGRATION MANAGER
// ====================================

export class EventSystemMigration {
  private config: MigrationConfig;
  private unifiedManager: EventDelegationManager | null = null;
  private isActive = false;

  constructor(config: MigrationConfig) {
    this.config = config;
    console.log('🔄 EventSystemMigration: Created with feature flags:', config.featureFlags);
  }

  // ====================================
  // MIGRATION CONTROL
  // ====================================

  public async startMigration(): Promise<void> {
    if (this.isActive) {
      console.warn('🔄 EventSystemMigration: Already active');
      return;
    }

    console.log('🔄 EventSystemMigration: Starting migration...');
    
    try {
      // Phase 1: Disable conflicting legacy systems
      await this.disableLegacySystems();
      
      // Phase 2: Initialize unified manager
      await this.initializeUnifiedManager();
      
      // Phase 3: Validate migration success
      await this.validateMigration();
      
      this.isActive = true;
      console.log('✅ EventSystemMigration: Migration completed successfully');
      
    } catch (error) {
      console.error('❌ EventSystemMigration: Migration failed:', error);
      await this.rollback();
      throw error;
    }
  }

  public async rollback(): Promise<void> {
    console.log('🔄 EventSystemMigration: Rolling back...');
    
    try {
      // Destroy unified manager
      if (this.unifiedManager) {
        this.unifiedManager.destroy();
        this.unifiedManager = null;
      }
      
      // Re-enable legacy systems
      await this.enableLegacySystems();
      
      this.isActive = false;
      console.log('✅ EventSystemMigration: Rollback completed');
      
    } catch (error) {
      console.error('❌ EventSystemMigration: Rollback failed:', error);
    }
  }

  // ====================================
  // LEGACY SYSTEM MANAGEMENT
  // ====================================

  private async disableLegacySystems(): Promise<void> {
    const { legacySystems, featureFlags } = this.config;
    
    if (featureFlags.useUnifiedMouseEvents && legacySystems?.reactHandlers) {
      // Remove React mouse event listeners
      const viewport = this.config.container.querySelector('.vibegridx-viewport') as HTMLElement;
      if (viewport && legacySystems.reactHandlers.handleMouseDown) {
        console.log('🔄 EventSystemMigration: Disabling React mouse handlers');
        viewport.removeEventListener('mousedown', legacySystems.reactHandlers.handleMouseDown);
        
        if (legacySystems.reactHandlers.handleMouseMove) {
          document.removeEventListener('mousemove', legacySystems.reactHandlers.handleMouseMove);
        }
        
        if (legacySystems.reactHandlers.handleMouseUp) {
          document.removeEventListener('mouseup', legacySystems.reactHandlers.handleMouseUp);
        }
      }
    }
    
    if (featureFlags.useUnifiedKeyboardEvents && legacySystems?.reactHandlers) {
      // Remove React keyboard event listeners
      if (legacySystems.reactHandlers.handleKeyDown) {
        console.log('🔄 EventSystemMigration: Disabling React keyboard handlers');
        this.config.container.removeEventListener('keydown', legacySystems.reactHandlers.handleKeyDown);
      }
    }
    
    if (legacySystems?.eventSystem) {
      // Disable DOM EventSystem
      console.log('🔄 EventSystemMigration: Disabling DOM EventSystem');
      if (typeof legacySystems.eventSystem.cleanup === 'function') {
        legacySystems.eventSystem.cleanup();
      }
    }
  }

  private async enableLegacySystems(): Promise<void> {
    const { legacySystems, featureFlags } = this.config;
    
    // Re-enable systems in reverse order
    if (legacySystems?.eventSystem) {
      console.log('🔄 EventSystemMigration: Re-enabling DOM EventSystem');
      if (typeof legacySystems.eventSystem.setupEventListeners === 'function') {
        legacySystems.eventSystem.setupEventListeners();
      }
    }
    
    if (featureFlags.useUnifiedKeyboardEvents && legacySystems?.reactHandlers) {
      if (legacySystems.reactHandlers.handleKeyDown) {
        console.log('🔄 EventSystemMigration: Re-enabling React keyboard handlers');
        this.config.container.addEventListener('keydown', legacySystems.reactHandlers.handleKeyDown);
      }
    }
    
    if (featureFlags.useUnifiedMouseEvents && legacySystems?.reactHandlers) {
      const viewport = this.config.container.querySelector('.vibegridx-viewport') as HTMLElement;
      if (viewport && legacySystems.reactHandlers.handleMouseDown) {
        console.log('🔄 EventSystemMigration: Re-enabling React mouse handlers');
        viewport.addEventListener('mousedown', legacySystems.reactHandlers.handleMouseDown);
        
        if (legacySystems.reactHandlers.handleMouseMove) {
          document.addEventListener('mousemove', legacySystems.reactHandlers.handleMouseMove);
        }
        
        if (legacySystems.reactHandlers.handleMouseUp) {
          document.addEventListener('mouseup', legacySystems.reactHandlers.handleMouseUp);
        }
      }
    }
  }

  // ====================================
  // UNIFIED MANAGER INITIALIZATION
  // ====================================

  private async initializeUnifiedManager(): Promise<void> {
    console.log('🔄 EventSystemMigration: Initializing unified manager');
    
    const unifiedConfig: EventDelegationConfig = {
      container: this.config.container,
      tableSend: this.config.tableSend,
      // Provide legacy callbacks for smooth transition
      legacyCallbacks: {
        onCellClick: (rowId, columnId, event) => {
          console.log('🔄 Legacy callback: Cell click', { rowId, columnId });
        },
        onCellDoubleClick: (rowId, columnId, event) => {
          console.log('🔄 Legacy callback: Cell double click', { rowId, columnId });
        },
        onColumnClick: (columnId, event) => {
          console.log('🔄 Legacy callback: Column click', { columnId });
        }
      }
    };
    
    this.unifiedManager = new EventDelegationManager(unifiedConfig);
  }

  // ====================================
  // MIGRATION VALIDATION
  // ====================================

  private async validateMigration(): Promise<void> {
    console.log('🔄 EventSystemMigration: Validating migration');
    
    // Check that unified manager is properly initialized
    if (!this.unifiedManager) {
      throw new Error('Unified manager not initialized');
    }
    
    // Check that container is properly set up
    if (!this.config.container.hasAttribute('tabindex')) {
      throw new Error('Container not properly configured for focus');
    }
    
    // Test basic event delegation
    const testEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100
    });
    
    try {
      this.config.container.dispatchEvent(testEvent);
      console.log('✅ EventSystemMigration: Event delegation test passed');
    } catch (error) {
      throw new Error(`Event delegation test failed: ${error}`);
    }
  }

  // ====================================
  // FEATURE FLAG MANAGEMENT
  // ====================================

  public updateFeatureFlags(newFlags: Partial<MigrationConfig['featureFlags']>): void {
    const oldFlags = this.config.featureFlags;
    this.config.featureFlags = { ...oldFlags, ...newFlags };
    
    console.log('🔄 EventSystemMigration: Updated feature flags:', {
      old: oldFlags,
      new: this.config.featureFlags
    });
    
    // If we're active, restart migration with new flags
    if (this.isActive) {
      console.log('🔄 EventSystemMigration: Restarting with new flags');
      this.restartMigration();
    }
  }

  private async restartMigration(): Promise<void> {
    await this.rollback();
    await this.startMigration();
  }

  // ====================================
  // STATUS AND MONITORING
  // ====================================

  public getStatus() {
    return {
      isActive: this.isActive,
      hasUnifiedManager: !!this.unifiedManager,
      featureFlags: this.config.featureFlags,
      currentFocus: this.unifiedManager?.getCurrentFocus()?.className || null,
      dragState: this.unifiedManager?.getDragState() || null
    };
  }

  public getEventCounts(): Record<string, number> {
    // This would be enhanced to track event counts for debugging
    return {
      mouseEvents: 0,
      keyboardEvents: 0,
      focusEvents: 0,
      scrollEvents: 0
    };
  }

  // ====================================
  // LIFECYCLE
  // ====================================

  public destroy(): void {
    if (this.unifiedManager) {
      this.unifiedManager.destroy();
      this.unifiedManager = null;
    }
    this.isActive = false;
    console.log('🔄 EventSystemMigration: Destroyed');
  }
}

// ====================================
// MIGRATION PRESETS
// ====================================

export const MIGRATION_PRESETS = {
  // Conservative: Only migrate mouse events
  CONSERVATIVE: {
    useUnifiedMouseEvents: true,
    useUnifiedKeyboardEvents: false,
    useUnifiedFocusManagement: false,
    useUnifiedScrollEvents: false,
    useUnifiedDragEvents: false
  },
  
  // Moderate: Migrate mouse and keyboard
  MODERATE: {
    useUnifiedMouseEvents: true,
    useUnifiedKeyboardEvents: true,
    useUnifiedFocusManagement: true,
    useUnifiedScrollEvents: false,
    useUnifiedDragEvents: false
  },
  
  // Aggressive: Migrate everything
  FULL: {
    useUnifiedMouseEvents: true,
    useUnifiedKeyboardEvents: true,
    useUnifiedFocusManagement: true,
    useUnifiedScrollEvents: true,
    useUnifiedDragEvents: true
  }
} as const;

// ====================================
// MIGRATION HELPER
// ====================================

export function createEventMigration(
  container: HTMLElement,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send'],
  preset: keyof typeof MIGRATION_PRESETS = 'CONSERVATIVE'
): EventSystemMigration {
  
  return new EventSystemMigration({
    container,
    tableSend,
    featureFlags: MIGRATION_PRESETS[preset]
  });
}