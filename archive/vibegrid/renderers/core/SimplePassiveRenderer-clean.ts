// This is a sample of the cleaner initialization approach
// Showing the key changes needed for SimplePassiveRenderer.ts

export class SimplePassiveRendererClean {
  // ... existing properties ...

  // Initialization control flags
  private observersActive: boolean = false;
  private initialRenderComplete: boolean = false;

  constructor(options: any) {
    // ... existing constructor code ...

    this.initDOM();
    this.initControllers();
    this.initDOMFactory();
    this.initPhase2Managers();
    this.initOverlayManager();
    this.initHeaderRenderer();

    // Set up observers but DON'T activate them yet
    this.setupObservers();

    // Do initialization with observers disabled
    this.performInitialRender();
  }

  /**
   * Set up all observers but keep them inactive during initialization
   */
  private setupObservers(): void {
    console.log('🎯 Setting up observers (inactive)');

    // SCROLL TRANSFORM OBSERVER: Lightweight, only updates CSS
    this.scrollTransformObserver = observe(() => {
      // Guard: Only run when observers are active
      if (!this.observersActive) return;

      const scrollLeft = this.visualState.scrollLeft.get();

      // Just update the transform, nothing else
      if (this.headerViewport) {
        this.headerViewport.style.transform = `translateX(-${scrollLeft}px)`;
      }
    });

    // VIRTUAL RANGE OBSERVER: Heavy, triggers re-renders
    this.virtualRangeObserver = observe(() => {
      // Guard: Only run when fully initialized
      if (!this.observersActive || !this.initialRenderComplete) return;

      // Must have baseline to compare against
      if (!this.lastVisibleColumns || !this.lastVisibleRows) return;

      const currentColumns = this.visualState.visibleColumnRange.get();
      const currentRows = this.visualState.visibleRowRange.get();

      // Check for actual changes
      const columnsChanged = !this.rangesEqual(currentColumns, this.lastVisibleColumns);
      const rowsChanged = !this.rangesEqual(currentRows, this.lastVisibleRows);

      if (columnsChanged || rowsChanged) {
        // Schedule re-render
        this.scheduleVirtualRangeUpdate(currentColumns, currentRows);
      }
    });

    // DATA OBSERVER: Watches for data changes
    this.dataObserver = observe(() => {
      // Guard: Only run when observers are active
      if (!this.observersActive) return;

      // Handle data changes...
    });
  }

  /**
   * Perform the initial render with observers disabled
   */
  private performInitialRender(): void {
    console.log('🎨 Starting initial render (observers disabled)');

    // Phase 1: Quick synchronous setup
    const bounds = this.container.getBoundingClientRect();
    this.visualState.updateViewportDimensions(bounds.width, bounds.height);
    this.initializePositionTracking();

    // Phase 2: Initial render (observers still disabled)
    requestAnimationFrame(() => {
      // Initialize controllers that need DOM
      this.initializeScrollController();
      this.initializeMouseController();

      // Phase 3: Render header
      requestAnimationFrame(() => {
        batch(() => {
          this.renderHeader();
        });

        // Phase 4: Render body and finalize
        requestAnimationFrame(() => {
          batch(() => {
            this.renderBody();

            // CRITICAL: Capture baseline BEFORE activating observers
            this.lastVisibleColumns = this.visualState.visibleColumnRange.get();
            this.lastVisibleRows = this.visualState.visibleRowRange.get();
          });

          // NOW we can activate observers
          this.activateObservers();

          // Mark initialization complete
          this.initManager.markReady('rendererInitialized');
          console.log('✅ Initial render complete, observers active');
        });
      });
    });
  }

  /**
   * Activate all observers after initial render
   */
  private activateObservers(): void {
    console.log('🔌 Activating observers');
    this.observersActive = true;
    this.initialRenderComplete = true;
  }

  /**
   * Schedule a virtual range update (debounced)
   */
  private scheduleVirtualRangeUpdate(newColumns: Range, newRows: Range): void {
    // Cancel pending update
    if (this.pendingRAF) {
      cancelAnimationFrame(this.pendingRAF);
    }

    this.pendingRAF = requestAnimationFrame(() => {
      this.pendingRAF = null;

      // Update baseline
      this.lastVisibleColumns = newColumns;
      this.lastVisibleRows = newRows;

      // Re-render
      this.renderBody();
    });
  }

  /**
   * Helper to compare ranges
   */
  private rangesEqual(a: Range | null, b: Range | null): boolean {
    if (!a || !b) return false;
    return a.start === b.start && a.end === b.end;
  }
}

// Key improvements:
// 1. Clear separation between setup and activation
// 2. Observers have guards that check if they should run
// 3. Initial render captures baseline BEFORE activating observers
// 4. No complex conditional checks scattered throughout
// 5. Clean phases of initialization