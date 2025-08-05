# VibeGridX Overlay Scroll Fix

## Problem Description
After scrolling in VibeGridX, overlay shapes (selections, editing indicators, etc.) were not visible. The logs showed shapes were being rendered, but they appeared to be positioned incorrectly.

## Root Cause
There was a coordinate system mismatch between:
1. **Canvas layer transform**: The layer was being transformed by `-scrollOffset` to account for scrolling
2. **Mouse event handling**: Mouse Y coordinates were being adjusted by adding `scrollTop`
3. **Shape rendering**: Shapes were positioned without accounting for the layer transform

This created a double transformation where shapes were rendered at one position but the layer transform moved them out of view.

## Solution
Removed the layer transform approach and implemented consistent coordinate calculations:

### 1. CanvasOverlayCoreV2.ts
- Removed `layer.y(-scrollOffset)` transform in `repositionCanvasIfNeeded()`
- Canvas stays viewport-sized without layer transformation
- All scrolling is now handled through coordinate calculations

### 2. CoordinateSystem.ts
- Updated `cellToViewport()` to subtract `scrollTop` from Y coordinates
- This ensures shapes are positioned relative to the viewport, not the document

### 3. OverlayRenderer.ts
- Mouse event handlers continue to add `scrollTop` to get absolute document position
- Fill preview calculations also adjusted to add `scrollTop` for consistency

## Benefits
1. **Consistent coordinate system**: All components use the same coordinate calculations
2. **Better performance**: No need to transform entire layer on scroll
3. **Simpler debugging**: Coordinates match what's expected in viewport
4. **More reliable**: Eliminates edge cases from double transformations

## Testing
Use the test component at `test-overlay-scroll.tsx` to verify:
1. Selections remain visible after scrolling
2. Mouse clicks work correctly at any scroll position
3. Drag selection works across scroll boundaries
4. Fill handle operates correctly after scrolling

## Future Considerations
If performance becomes an issue with many shapes, consider:
1. Culling shapes outside viewport bounds before rendering
2. Using layer clipping to hide off-screen shapes
3. Implementing virtual rendering for shapes