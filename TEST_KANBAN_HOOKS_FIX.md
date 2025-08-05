# Kanban Hooks Error Fix

## Problem
The error "Rendered fewer hooks than expected" was occurring when dragging cards between columns in the kanban board. The error only happened when dragging to a different column (status change), not when dragging within the same column.

## Root Cause
The issue was in `VibeKan.tsx` where `getInitialEntityOrder` was defined using `useCallback` but was being called inside a `useEffect`. This created a situation where:

1. During drag operations, React would re-render the component
2. The `useEffect` would call `getInitialEntityOrder()` before the `useCallback` hook had been executed in the render
3. This caused React to see fewer hooks than expected

## Solution
Changed from using `useCallback` to a regular function for `getInitialEntityOrder` (now `loadInitialEntityOrder`). This ensures the function is available without relying on hook execution order.

### Changes Made:
1. Replaced `useCallback` with a regular function `loadInitialEntityOrder`
2. Updated the `useEffect` to call `loadInitialEntityOrder()` instead
3. Updated the dependency array to include the actual dependencies instead of the callback

## Files Modified
- `/home/benfreed/vibestack/apps/web/src/components/custom/vibekan/core/VibeKan.tsx`

## Testing Instructions
1. Navigate to the Tasks page
2. Switch to the Kanban view
3. Drag a task card from one column to another (e.g., from "Open" to "In Progress")
4. The task should move without any console errors
5. The task's status should update correctly in the database

## Additional Notes
The fix avoids the React hooks rules violation by not using hooks conditionally or in a way that could change their execution order between renders.