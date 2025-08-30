/**
 * UltraTable - High-Performance Table with Legend State
 * 
 * Combines VibeGrid's proven performance patterns with Legend State reactivity:
 * - Direct DOM manipulation for maximum performance
 * - Virtual scrolling with element caching
 * - Legend State observe() for reactive updates
 * - No React reconciliation overhead
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { observer } from '@legendapp/state/react';
import { observe } from '@legendapp/state';
import { getEntity$ } from '@/legend-state';
import { getPrecomputedEntityColumns$ } from '@/legend-state/hooks/use-precomputed-entity-columns';
import { UltraTableRenderer } from './core/UltraTableRenderer';
import { generateColumns } from './utils/column-generator';
import type { UltraTableProps, UltraTableState } from './types';
import './styles/ultra-table.css';
import { uiLog } from '@/logger';

// Create logger instance for this file
const log = uiLog('components/custom/ultratable/UltraTable.tsx');

export const UltraTable = observer((props: UltraTableProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<UltraTableRenderer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [columns, setColumns] = useState(props.columns || []);
  const [columnsReady, setColumnsReady] = useState(!!props.columns);
  
  // Initialize columns with proper timing - wait for precomputed columns if needed
  useEffect(() => {
    if (props.columns) {
      // Custom columns provided - use immediately
      setColumns(props.columns);
      setColumnsReady(true);
      return;
    }
    
    log.debug('[UltraTable] Waiting for precomputed columns for', props.entityType);
    
    let columnCheckInterval: NodeJS.Timeout;
    
    const initializeColumns = () => {
      const precomputedColumns$ = getPrecomputedEntityColumns$(props.entityType);
      
      if (!precomputedColumns$) {
        log.debug('[UltraTable] Precomputed columns observable not ready yet...');
        return false;
      }
      
      const vibeGridColumns = precomputedColumns$.peek();
      if (!vibeGridColumns || vibeGridColumns.length === 0) {
        log.debug('[UltraTable] Precomputed columns data not populated yet...');
        return false;
      }
      
      log.debug('[UltraTable] Precomputed columns ready:', vibeGridColumns.length, 'columns found');
      
      // Generate UltraTable columns from precomputed columns
      const ultraColumns = generateColumns(props.entityType);
      log.debug('[UltraTable] Generated columns:', ultraColumns.length, 'columns');
      
      setColumns(ultraColumns);
      setColumnsReady(true);
      
      return true;
    };
    
    // Try immediate initialization
    if (!initializeColumns()) {
      // If not ready, poll every 100ms until columns are available
      columnCheckInterval = setInterval(() => {
        if (initializeColumns()) {
          clearInterval(columnCheckInterval);
        }
      }, 100);
    }
    
    return () => {
      if (columnCheckInterval) {
        clearInterval(columnCheckInterval);
      }
    };
  }, [props.entityType, props.columns]);
  
  // Initialize renderer when container and columns are ready
  useEffect(() => {
    if (!containerRef.current || rendererRef.current || !columnsReady || columns.length === 0) return;
    
    log.debug('[UltraTable] Initializing renderer for', props.entityType);
    
    try {
      // Create high-performance renderer with Legend State integration
      rendererRef.current = new UltraTableRenderer({
        container: containerRef.current,
        columns: columns,
        entityType: props.entityType,
        tableId: props.tableId || `ultra-table-${props.entityType}`,
        
        // Performance options from VibeGrid
        enableVirtualScrolling: props.enableVirtualScrolling ?? true,
        enableSelectionColumn: props.enableSelectionColumn ?? true,
        bufferRows: props.bufferRows ?? 5,
        rowHeight: props.rowHeight ?? 40,
        
        // Event handlers
        onCellClick: props.onCellClick,
        onCellDoubleClick: props.onCellDoubleClick,
        onSelectionChange: props.onSelectionChange,
        onCellEdit: props.onCellEdit,
        onColumnSort: props.onColumnSort,
        onScroll: props.onScroll,
        
        // Debug mode
        debug: import.meta.env.DEV
      });
      
      setIsReady(true);
      log.debug('[UltraTable] Renderer initialized successfully');
      
    } catch (error) {
      console.error('[UltraTable] Failed to initialize renderer:', error);
    }
    
    return () => {
      if (rendererRef.current) {
        log.debug('[UltraTable] Cleaning up renderer');
        rendererRef.current.destroy();
        rendererRef.current = null;
        setIsReady(false);
      }
    };
  }, [props.entityType, columns, columnsReady]);
  
  // Set up Legend State data subscription with proper entity readiness check
  useEffect(() => {
    if (!rendererRef.current || !isReady) return;
    
    log.debug('[UltraTable] Setting up Legend State subscription for', props.entityType);
    
    let entityCheckInterval: NodeJS.Timeout;
    let dataCleanup: (() => void) | null = null;
    
    const setupDataSubscription = () => {
      const entityObs$ = getEntity$(props.entityType);
      if (!entityObs$) {
        log.debug('[UltraTable] Entity observable not ready, waiting...', props.entityType);
        return false;
      }
      
      log.debug('[UltraTable] Entity observable ready, setting up data subscription for', props.entityType);
      
      // Set up the data subscription
      dataCleanup = observe(() => {
        const entityData = entityObs$.get();
        const entities = Object.values(entityData || {});
        
        log.debug('[UltraTable] Legend State update:', {
          entityType: props.entityType,
          entityCount: entities.length,
          timestamp: Date.now()
        });
        
        // Update renderer with new data
        if (rendererRef.current) {
          rendererRef.current.updateData(entities);
        }
      });
      
      return true;
    };
    
    // Try to set up subscription immediately
    if (!setupDataSubscription()) {
      // If entity not ready, poll every 100ms until available
      entityCheckInterval = setInterval(() => {
        if (setupDataSubscription()) {
          clearInterval(entityCheckInterval);
        }
      }, 100);
    }
    
    return () => {
      if (entityCheckInterval) {
        clearInterval(entityCheckInterval);
      }
      if (dataCleanup) {
        dataCleanup();
      }
    };
  }, [props.entityType, isReady]);
  
  // Expose imperative API
  const getSelectedRows = useCallback(() => {
    return rendererRef.current?.getSelectedRows() || new Set<string>();
  }, []);
  
  const clearSelection = useCallback(() => {
    rendererRef.current?.clearSelection();
  }, []);
  
  const scrollToRow = useCallback((rowId: string) => {
    rendererRef.current?.scrollToRow(rowId);
  }, []);
  
  const refresh = useCallback(() => {
    rendererRef.current?.refresh();
  }, []);
  
  // Store API on ref for external access
  React.useImperativeHandle(props.ref, () => ({
    getSelectedRows,
    clearSelection,
    scrollToRow,
    refresh,
    getRenderer: () => rendererRef.current
  }), [getSelectedRows, clearSelection, scrollToRow, refresh]);
  
  return (
    <div
      className={`ultra-table ${props.className || ''}`}
      data-testid={`ultra-table-${props.entityType}`}
      style={{
        width: props.width || '100%',
        height: props.height || 600,
        border: '1px solid var(--border)',
        borderRadius: '8px',
        backgroundColor: 'var(--background)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {!isReady && (
        <div className="ultra-table-loading">
          <div className="loading-content">
            <div className="loading-spinner">⚡</div>
            <div className="loading-text">
              {!columnsReady ? 'Loading schema...' : 'Initializing UltraTable...'}
            </div>
            <div className="loading-subtitle">
              Entity: {props.entityType} • Columns: {columnsReady ? columns.length : 'waiting...'}
            </div>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="ultra-table-container"
        style={{
          width: '100%',
          height: '100%',
          visibility: isReady ? 'visible' : 'hidden'
        }}
      />
    </div>
  );
});

UltraTable.displayName = 'UltraTable';

export default UltraTable;