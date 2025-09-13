/**
 * ScrollController - Manages scroll synchronization for VibeGrid
 * Handles viewport scrolling and header-body scroll coordination
 */

import { log } from '@/logger';

const fileLog = log('components/custom/vibegrid/renderers/modules/ScrollController.ts');

export interface ScrollControllerOptions {
  viewport: HTMLElement;
  headerViewport?: HTMLElement | null;
  onScroll?: (scrollLeft: number, scrollTop: number) => void;
}

export class ScrollController {
  private viewport: HTMLElement;
  private headerViewport: HTMLElement | null;
  private scrollRAF: number | null = null;
  private onScroll?: (scrollLeft: number, scrollTop: number) => void;
  private lastScrollLeft: number = 0;
  private lastScrollTop: number = 0;

  constructor(options: ScrollControllerOptions) {
    this.viewport = options.viewport;
    this.headerViewport = options.headerViewport || null;
    this.onScroll = options.onScroll;
    
    this.setupScrollHandling();
  }

  /**
   * Setup scroll event handling
   */
  private setupScrollHandling(): void {
    this.viewport.addEventListener('scroll', this.handleViewportScroll.bind(this), { passive: true });
  }

  /**
   * Handle viewport scroll event
   */
  private handleViewportScroll(event: Event): void {
    const scrollLeft = this.viewport.scrollLeft;
    const scrollTop = this.viewport.scrollTop;
    
    // Only process if scroll position actually changed
    if (scrollLeft !== this.lastScrollLeft || scrollTop !== this.lastScrollTop) {
      this.lastScrollLeft = scrollLeft;
      this.lastScrollTop = scrollTop;
      
      // Sync header scroll
      this.syncHeaderScroll(scrollLeft);
      
      // Call external scroll handler
      if (this.onScroll) {
        this.onScroll(scrollLeft, scrollTop);
      }
      
      fileLog.info('Viewport scrolled', {
        scrollLeft,
        scrollTop,
        viewportWidth: this.viewport.clientWidth,
        viewportHeight: this.viewport.clientHeight,
        scrollWidth: this.viewport.scrollWidth,
        scrollHeight: this.viewport.scrollHeight
      });
    }
  }

  /**
   * Sync header horizontal scroll with body
   */
  private syncHeaderScroll(scrollLeft: number): void {
    if (!this.scrollRAF && this.headerViewport) {
      this.scrollRAF = requestAnimationFrame(() => {
        if (this.headerViewport) {
          this.headerViewport.scrollLeft = scrollLeft;
        }
        this.scrollRAF = null;
      });
    }
  }

  /**
   * Programmatically scroll to a position
   */
  scrollTo(options: { left?: number; top?: number; behavior?: ScrollBehavior }): void {
    if (options.left !== undefined) {
      this.lastScrollLeft = options.left;
    }
    if (options.top !== undefined) {
      this.lastScrollTop = options.top;
    }
    
    this.viewport.scrollTo({
      left: options.left,
      top: options.top,
      behavior: options.behavior || 'auto'
    });
    
    // Sync header if scrolling horizontally
    if (options.left !== undefined && this.headerViewport) {
      this.headerViewport.scrollLeft = options.left;
    }
  }

  /**
   * Scroll a specific element into view
   */
  scrollElementIntoView(element: HTMLElement, options?: ScrollIntoViewOptions): void {
    element.scrollIntoView(options || {
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    });
  }

  /**
   * Get current scroll position
   */
  getScrollPosition(): { left: number; top: number } {
    return {
      left: this.viewport.scrollLeft,
      top: this.viewport.scrollTop
    };
  }

  /**
   * Get viewport dimensions
   */
  getViewportDimensions(): { width: number; height: number } {
    return {
      width: this.viewport.clientWidth,
      height: this.viewport.clientHeight
    };
  }

  /**
   * Get scroll dimensions
   */
  getScrollDimensions(): { width: number; height: number } {
    return {
      width: this.viewport.scrollWidth,
      height: this.viewport.scrollHeight
    };
  }

  /**
   * Check if element is in viewport
   */
  isElementInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const viewportRect = this.viewport.getBoundingClientRect();
    
    return (
      rect.top >= viewportRect.top &&
      rect.left >= viewportRect.left &&
      rect.bottom <= viewportRect.bottom &&
      rect.right <= viewportRect.right
    );
  }

  /**
   * Update header viewport reference
   */
  setHeaderViewport(headerViewport: HTMLElement | null): void {
    this.headerViewport = headerViewport;
  }

  /**
   * Clean up scroll handling
   */
  destroy(): void {
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
      this.scrollRAF = null;
    }
    
    this.viewport.removeEventListener('scroll', this.handleViewportScroll.bind(this));
  }

  /**
   * Reset scroll position
   */
  reset(): void {
    this.scrollTo({ left: 0, top: 0 });
    this.lastScrollLeft = 0;
    this.lastScrollTop = 0;
  }
}