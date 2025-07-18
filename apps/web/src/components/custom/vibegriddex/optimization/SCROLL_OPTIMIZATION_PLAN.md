# VibeGridX Scroll Performance Optimization Plan

## Current Issues

1. **High Frequency Updates** - Throttled at 60fps (16ms) causing many updates
2. **Redundant Logging** - Every scroll event logs table state debug
3. **Multiple Actor Updates** - Canvas actor, overlay, and renderer all get updates
4. **No Viewport Change Detection** - Updates sent even when viewport rows haven't changed

## Optimization Strategies

### 1. Smarter Throttling
```typescript
// Instead of fixed 16ms, use adaptive throttling
const THROTTLE_MS = {
  SCROLLING: 50,    // 20fps during active scrolling
  IDLE: 100,        // 10fps when nearly stopped
  FAST: 16          // 60fps for smooth animations
};
```

### 2. Viewport Row Change Detection
```typescript
// Only update when visible rows change
const calculateViewportRows = (scrollTop: number, rowHeight: number) => {
  const start = Math.floor(scrollTop / rowHeight);
  const end = start + Math.ceil(viewportHeight / rowHeight);
  return { start, end };
};

// Compare with previous viewport
if (prevViewport.start === newViewport.start && 
    prevViewport.end === newViewport.end) {
  // Only update canvas position, skip data updates
  return;
}
```

### 3. Separate Canvas Updates from Data Updates
```typescript
// Canvas needs frequent updates for smooth scrolling
// Data updates only when visible rows change
const updateCanvas = () => {
  // Update canvas transform for smooth scrolling
  canvas.style.transform = `translateY(-${scrollTop}px)`;
};

const updateData = debounce(() => {
  // Update table data when scrolling stops
  tableMachine.send({ type: 'view.viewport.update', viewport });
}, 150);
```

### 4. Request Animation Frame
```typescript
let rafId: number | null = null;

const handleScroll = (e: Event) => {
  if (rafId) return;
  
  rafId = requestAnimationFrame(() => {
    updateViewport();
    rafId = null;
  });
};
```

### 5. Virtualization Improvements
- Pre-render rows outside viewport (overscan)
- Recycle DOM nodes instead of creating new ones
- Use CSS transforms for smoother scrolling

### 6. Reduce Console Logging
```typescript
// Add debug flag
const DEBUG_SCROLL = false;

if (DEBUG_SCROLL) {
  console.log('Viewport update:', viewport);
}
```

## Implementation Priority

1. **Quick Wins** (High impact, low effort)
   - Increase throttle to 50ms
   - Add viewport row change detection
   - Reduce console logging

2. **Medium Term** (Medium impact, medium effort)
   - Separate canvas from data updates
   - Use requestAnimationFrame
   - Add overscan rows

3. **Long Term** (High impact, high effort)
   - Full DOM recycling
   - WebWorker for data processing
   - Virtual scrolling with intersection observer