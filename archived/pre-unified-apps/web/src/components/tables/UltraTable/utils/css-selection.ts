import { uiLog } from '@/logger';
const log = uiLog('components/tables/UltraTable/utils/css-selection.ts);
/**
 * CSS-based selection for UltraTable
 * Updates DOM data attributes directly for zero React re-renders
 */

export function updateCellSelection(
  tableContainer: HTMLElement | null,
  selectedCells: Set<string>,
  focusedCell: { row: number; col: number } | null,
  activeRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null
) {
  if (!tableContainer) {
    log.info('[CSS Selection] No table container')
    return
  }

  log.info('[CSS Selection] Updating selection:', {
    selectedCells: Array.from(selectedCells),
    focusedCell,
    activeRange
  })

  // Clear all existing selection states
  const allCells = tableContainer.querySelectorAll('td[data-row][data-col]')
  const allTds = tableContainer.querySelectorAll('td')
  log.info('[CSS Selection] Found cells with data attrs:', allCells.length)
  log.info('[CSS Selection] Found all tds:', allTds.length)
  
  // Debug: check first few cells
  if (allTds.length > 0) {
    log.info('[CSS Selection] First td attributes:', {
      dataRow: allTds[0].getAttribute('data-row'),
      dataCol: allTds[0].getAttribute('data-col'),
      allAttributes: Array.from(allTds[0].attributes).map(attr => `${attr.name}="${attr.value}"`).slice(0, 10)
    })
  }
  
  allCells.forEach(cell => {
    cell.setAttribute('data-selected', 'false')
    cell.setAttribute('data-focused', 'false')
    cell.setAttribute('data-in-range', 'false')
  })

  // Set selected cells
  selectedCells.forEach(cellKey => {
    const [row, col] = cellKey.split(':').map(Number)
    const cell = tableContainer.querySelector(`td[data-row="${row}"][data-col="${col}"]`)
    log.info('[CSS Selection] Setting selected cell:', { 
      row, col, found: !!cell,
      selector: `td[data-row="${row}"][data-col="${col}"]`,
      cellAttributes: cell ? {
        dataRow: cell.getAttribute('data-row'),
        dataCol: cell.getAttribute('data-col'),
        dataSelected: cell.getAttribute('data-selected')
      } : null
    })
    if (cell) {
      cell.setAttribute('data-selected', 'true')
      // Apply styles directly with maximum specificity
      cell.style.setProperty('background-color', 'red', 'important')
      cell.style.setProperty('border', '5px solid blue', 'important')
      cell.style.setProperty('box-sizing', 'border-box', 'important')
      log.info('[CSS Selection] After setting - data-selected:', cell.getAttribute('data-selected'))
      log.info('[CSS Selection] Applied direct styles')
    }
  })

  // Set focused cell
  if (focusedCell) {
    const focusedElement = tableContainer.querySelector(
      `td[data-row="${focusedCell.row}"][data-col="${focusedCell.col}"]`
    )
    log.info('[CSS Selection] Setting focused cell:', { focusedCell, found: !!focusedElement })
    if (focusedElement) {
      focusedElement.setAttribute('data-focused', 'true')
    }
  }

  // Set range cells
  if (activeRange) {
    for (let row = activeRange.startRow; row <= activeRange.endRow; row++) {
      for (let col = activeRange.startCol; col <= activeRange.endCol; col++) {
        const cell = tableContainer.querySelector(`td[data-row="${row}"][data-col="${col}"]`)
        if (cell) {
          cell.setAttribute('data-in-range', 'true')
        }
      }
    }
  }
}