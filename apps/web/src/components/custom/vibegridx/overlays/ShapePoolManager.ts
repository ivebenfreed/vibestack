import Konva from 'konva';

// ====================================
// SHAPE POOL MANAGER
// ====================================

export type ShapeType = 'selection' | 'border' | 'preview' | 'editing' | 'indicator';

interface PooledShape<T extends Konva.Shape> {
  shape: T;
  inUse: boolean;
}

class ObjectPool<T extends Konva.Shape> {
  private pool: PooledShape<T>[] = [];
  private factory: () => T;
  private resetFn: (shape: T) => void;
  private maxSize: number;
  private lastUsedMap: WeakMap<T, number> = new WeakMap();
  
  constructor(factory: () => T, resetFn: (shape: T) => void, maxSize: number = 100) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }
  
  acquire(count: number): T[] {
    const shapes: T[] = [];
    const now = Date.now();
    
    // First, try to reuse existing shapes
    let reused = 0;
    for (const pooled of this.pool) {
      if (!pooled.inUse && reused < count) {
        pooled.inUse = true;
        this.lastUsedMap.set(pooled.shape, now);
        shapes.push(pooled.shape);
        reused++;
      }
    }
    
    // Create new shapes if needed
    for (let i = reused; i < count; i++) {
      // Check if we need to evict before creating new shapes
      if (this.pool.length >= this.maxSize) {
        this.evictLRU();
      }
      
      const shape = this.factory();
      const pooled = { shape, inUse: true };
      this.pool.push(pooled);
      this.lastUsedMap.set(shape, now);
      shapes.push(shape);
    }
    
    return shapes;
  }
  
  private evictLRU(): void {
    // Find the least recently used shape that's not in use
    let lruIndex = -1;
    let lruTime = Infinity;
    
    for (let i = 0; i < this.pool.length; i++) {
      const pooled = this.pool[i];
      if (!pooled.inUse) {
        const lastUsed = this.lastUsedMap.get(pooled.shape) || 0;
        if (lastUsed < lruTime) {
          lruTime = lastUsed;
          lruIndex = i;
        }
      }
    }
    
    // Evict the LRU shape
    if (lruIndex !== -1) {
      const evicted = this.pool.splice(lruIndex, 1)[0];
      evicted.shape.destroy();
      this.lastUsedMap.delete(evicted.shape);
    }
  }
  
  release(shapes: T[]): void {
    for (const shape of shapes) {
      const pooled = this.pool.find(p => p.shape === shape);
      if (pooled) {
        pooled.inUse = false;
        
        // Clear any running animations
        if ((shape as any)._dashAnimation) {
          (shape as any)._dashAnimation.stop();
          delete (shape as any)._dashAnimation;
        }
        
        // Stop any animations on the shape itself
        shape.stopDrag();
        shape.to({
          duration: 0
        });
        
        this.resetFn(shape);
        shape.visible(false);
      }
    }
  }
  
  releaseAll(): void {
    for (const pooled of this.pool) {
      pooled.inUse = false;
      
      // Clear any running animations
      if ((pooled.shape as any)._dashAnimation) {
        (pooled.shape as any)._dashAnimation.stop();
        delete (pooled.shape as any)._dashAnimation;
      }
      
      // Stop any animations on the shape itself
      pooled.shape.stopDrag();
      pooled.shape.to({
        duration: 0
      });
      
      this.resetFn(pooled.shape);
      pooled.shape.visible(false);
    }
  }
  
  getStats() {
    const total = this.pool.length;
    const inUse = this.pool.filter(p => p.inUse).length;
    return { total, inUse, available: total - inUse };
  }
}

export class ShapePoolManager {
  private pools: Map<ShapeType, ObjectPool<Konva.Shape>>;
  private layer: Konva.Layer;
  private config: {
    cellWidth: number;
    cellHeight: number;
    selectionColor: string;
    selectionBorderColor: string;
    editingColor: string;
    editingBorderColor: string;
    borderWidth: number;
  };
  
  constructor(
    layer: Konva.Layer,
    config: {
      cellWidth: number;
      cellHeight: number;
      selectionColor: string;
      selectionBorderColor: string;
      editingColor: string;
      editingBorderColor: string;
      borderWidth: number;
    }
  ) {
    this.layer = layer;
    this.config = config;
    this.pools = new Map();
    
    this.initializePools();
  }
  
  private initializePools(): void {
    // Selection rectangles - allow more shapes for large selections
    this.pools.set('selection', new ObjectPool(
      () => {
        const rect = new Konva.Rect({
          width: this.config.cellWidth,
          height: this.config.cellHeight,
          fill: this.config.selectionColor,
          opacity: 0.2,
          visible: false,
          listening: false
        });
        this.layer.add(rect);
        return rect;
      },
      (shape) => {
        shape.position({ x: 0, y: 0 });
        shape.size({ width: this.config.cellWidth, height: this.config.cellHeight });
      },
      200 // Max 200 selection rectangles
    ));
    
    // Border rectangles - same limit as selection
    this.pools.set('border', new ObjectPool(
      () => {
        const rect = new Konva.Rect({
          width: this.config.cellWidth - 1,
          height: this.config.cellHeight - 1,
          stroke: this.config.selectionBorderColor,
          strokeWidth: this.config.borderWidth,
          fill: 'transparent',
          visible: false,
          listening: false
        });
        this.layer.add(rect);
        return rect;
      },
      (shape) => {
        shape.position({ x: 0, y: 0 });
        shape.size({ width: this.config.cellWidth - 1, height: this.config.cellHeight - 1 });
      },
      200 // Max 200 border rectangles
    ));
    
    // Preview rectangles (for fill preview, drag preview)
    this.pools.set('preview', new ObjectPool(
      () => {
        const rect = new Konva.Rect({
          width: this.config.cellWidth - 1,
          height: this.config.cellHeight - 1,
          fill: this.config.selectionColor,
          opacity: 0.1,
          stroke: this.config.selectionBorderColor,
          strokeWidth: 1,
          dash: [3, 3],
          visible: false,
          listening: false
        });
        this.layer.add(rect);
        return rect;
      },
      (shape) => {
        shape.position({ x: 0, y: 0 });
        shape.size({ width: this.config.cellWidth - 1, height: this.config.cellHeight - 1 });
      },
      100 // Max 100 preview rectangles
    ));
    
    // Editing shapes - only need a few
    this.pools.set('editing', new ObjectPool(
      () => {
        const rect = new Konva.Rect({
          width: this.config.cellWidth - 1,
          height: this.config.cellHeight - 1,
          stroke: this.config.editingBorderColor,
          strokeWidth: this.config.borderWidth + 1,
          fill: this.config.editingColor,
          opacity: 0.1,
          visible: false,
          listening: false
        });
        this.layer.add(rect);
        return rect;
      },
      (shape) => {
        shape.position({ x: 0, y: 0 });
        shape.size({ width: this.config.cellWidth - 1, height: this.config.cellHeight - 1 });
      },
      10 // Max 10 editing shapes
    ));
    
    // Indicator shapes (copy indicator, etc) - very few needed
    this.pools.set('indicator', new ObjectPool(
      () => {
        const rect = new Konva.Rect({
          stroke: '#6366f1',
          strokeWidth: 2,
          dash: [5, 5],
          fill: 'transparent',
          visible: false,
          listening: false
        });
        this.layer.add(rect);
        return rect;
      },
      (shape) => {
        shape.position({ x: 0, y: 0 });
        shape.dashOffset(0);
      },
      5 // Max 5 indicator shapes
    ));
  }
  
  acquire<T extends Konva.Shape = Konva.Shape>(type: ShapeType, count: number): T[] {
    const pool = this.pools.get(type);
    if (!pool) {
      throw new Error(`Pool type ${type} not found`);
    }
    return pool.acquire(count) as T[];
  }
  
  release(type: ShapeType, shapes: Konva.Shape[]): void {
    const pool = this.pools.get(type);
    if (pool) {
      pool.release(shapes);
    }
  }
  
  releaseAll(): void {
    for (const pool of this.pools.values()) {
      pool.releaseAll();
    }
  }
  
  getStats(): Record<ShapeType, { total: number; inUse: number; available: number }> {
    const stats: any = {};
    for (const [type, pool] of this.pools) {
      stats[type] = pool.getStats();
    }
    return stats;
  }
  
  // Utility method to configure a shape for a specific cell
  configureForCell(
    shape: Konva.Rect,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    shape.position({ x, y });
    shape.size({ width, height });
    shape.visible(true);
  }
  
  // Create special shapes that aren't pooled
  createFillHandle(x: number, y: number): Konva.Rect {
    console.log('ShapePoolManager.createFillHandle: Creating fill handle', {
      x, y, 
      adjustedX: x - 5, 
      adjustedY: y - 5
    });
    
    const handle = new Konva.Rect({
      x: x - 5,
      y: y - 5,
      width: 10,
      height: 10,
      fill: this.config.selectionBorderColor,
      stroke: 'white',
      strokeWidth: 2,
      draggable: false, // Don't make it freely draggable
      cornerRadius: 2,
      shadowColor: 'black',
      shadowBlur: 3,
      shadowOffset: { x: 1, y: 1 },
      shadowOpacity: 0.4,
      listening: true, // Ensure it can receive events
      cursor: 'crosshair'
    });
    
    console.log('ShapePoolManager.createFillHandle: Fill handle properties', {
      draggable: handle.draggable(),
      listening: handle.listening(),
      visible: handle.visible(),
      position: handle.position(),
      size: handle.size()
    });
    
    this.layer.add(handle);
    handle.moveToTop();
    
    console.log('ShapePoolManager.createFillHandle: Added to layer, moved to top');
    
    return handle;
  }
  
  destroy(): void {
    this.releaseAll();
    this.pools.clear();
  }
}