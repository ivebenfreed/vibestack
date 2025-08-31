# VibeGridX Selection Features

## Mouse Selection
- **Single Cell**: Click on any cell
- **Multi-Cell**: Ctrl+Click to add/remove cells
- **Range Selection**: Shift+Click to select rectangular range
- **Column Selection**: Click column header (Ctrl+Click to add columns)

## Keyboard Navigation
- **Arrow Keys**: Move selection one cell
- **Shift+Arrow**: Extend selection in direction
- **Ctrl+A**: Select all cells
- **Escape**: Clear selection

## Keyboard Shortcuts
- **Ctrl+C**: Copy selected cells
- **Ctrl+V**: Paste to selected cells
- **Delete/Backspace**: Clear selected cells
- **Enter**: Start editing selected cell

## Performance
- Canvas overlay provides instant visual feedback (<1ms)
- Selection state managed by XState for persistence
- No DOM re-renders for selection changes
- Supports thousands of selected cells efficiently