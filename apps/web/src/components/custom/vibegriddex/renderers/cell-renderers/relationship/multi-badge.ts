import type { Column } from '../../../types';

/**
 * Width-aware multi-relationship badge renderer
 * Creates DOM elements with proper badge display and overflow handling
 */
export function relationshipMultiBadge(
  value: any,
  column: Column,
  rowData?: any
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'vibegridx-multi-badge-container';
  container.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    overflow: hidden;
    padding: 4px 0;
  `;

  // Get resolved values from ViewActor
  let items: string[] = [];
  if (rowData && rowData[`__resolved_${column.id}`]) {
    const resolvedValue = rowData[`__resolved_${column.id}`];
    if (Array.isArray(resolvedValue)) {
      items = resolvedValue;
    }
  } else if (Array.isArray(value)) {
    // Fallback to IDs if no resolved values
    items = value.map(id => String(id));
  }
  
  // Debug logging for tags
  if (column.id === 'tags') {
    console.log(`🔍 MultiBadge: Rendering tags`, {
      columnId: column.id,
      rawValue: value,
      resolvedValue: rowData?.[`__resolved_${column.id}`],
      finalItems: items,
      hasRowData: !!rowData
    });
  }

  // Handle empty state
  if (items.length === 0) {
    const emptyState = document.createElement('span');
    emptyState.className = 'text-muted-foreground text-xs italic cursor-pointer hover:text-foreground vibegridx-cell-badge-editable';
    emptyState.textContent = column.placeholder || 'Click to add items';
    container.appendChild(emptyState);
    return container;
  }

  // Create badges wrapper
  const badgesWrapper = document.createElement('div');
  badgesWrapper.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    overflow: hidden;
  `;

  // Create measurement container (hidden)
  const measureContainer = document.createElement('div');
  measureContainer.style.cssText = `
    position: absolute;
    visibility: hidden;
    display: flex;
    gap: 4px;
  `;
  document.body.appendChild(measureContainer);

  // Create all badges for measurement
  const badges: HTMLElement[] = items.map((item, index) => {
    const badge = createBadge(item, index);
    return badge;
  });

  // Use column width directly - more reliable than DOM measurement at render time
  const getAvailableWidth = () => {
    return column.width ? column.width - 24 : 200; // Account for padding
  };
  
  // Function to render badges with given width
  const renderBadges = (availableContainerWidth: number) => {
    // Clear existing badges
    badgesWrapper.innerHTML = '';
    
    // Add badges to measure container to get their widths
    const tempMeasureContainer = document.createElement('div');
    tempMeasureContainer.style.cssText = `
      position: absolute;
      visibility: hidden;
      display: flex;
      gap: 4px;
    `;
    document.body.appendChild(tempMeasureContainer);
    
    const badgeWidths: number[] = [];

    // Measure each badge
    badges.forEach((badge, index) => {
      const tempBadge = badge.cloneNode(true) as HTMLElement;
      tempMeasureContainer.appendChild(tempBadge);
      const width = tempBadge.offsetWidth;
      badgeWidths[index] = width;
    });

    // Clean up measurement container
    document.body.removeChild(tempMeasureContainer);

    // First pass: try to fit all badges without reserving space for "+X more"
    let currentWidth = 0;
    let visibleCount = 0;
    
    for (let i = 0; i < badges.length; i++) {
      const badgeWidth = badgeWidths[i] + (i > 0 ? 4 : 0); // Add gap
      if (currentWidth + badgeWidth <= availableContainerWidth || i === 0) {
        // Always show at least one badge
        currentWidth += badgeWidth;
        visibleCount++;
      } else {
        break;
      }
    }

    // If all badges fit, show them all
    if (visibleCount === badges.length) {
      badges.forEach(badge => badgesWrapper.appendChild(badge.cloneNode(true)));
    } else {
      // We need to show "+X more" - recalculate with reserved space
      const moreButtonWidth = 50; // Approximate width of "+X more" badge
      const availableWidthWithMore = availableContainerWidth - moreButtonWidth;
      
      // Recalculate how many badges fit with "+X more" reserved
      currentWidth = 0;
      visibleCount = 0;
      
      for (let i = 0; i < badges.length; i++) {
        const badgeWidth = badgeWidths[i] + (i > 0 ? 4 : 0);
        if (currentWidth + badgeWidth <= availableWidthWithMore || i === 0) {
          currentWidth += badgeWidth;
          visibleCount++;
        } else {
          break;
        }
      }
      
      // Show visible badges
      for (let i = 0; i < visibleCount; i++) {
        badgesWrapper.appendChild(badges[i].cloneNode(true));
      }

      // Show "+X more" badge
      const remaining = badges.length - visibleCount;
      if (remaining > 0) {
        const moreBadge = document.createElement('span');
        // Use outline variant for "+X more" badge to distinguish from content badges + make it clickable
        moreBadge.className = 'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer vibegridx-cell-badge-editable vibegridx-badge-more';
        moreBadge.textContent = `+${remaining}`;
        moreBadge.title = items.slice(visibleCount).join(', ');
        badgesWrapper.appendChild(moreBadge);
      }
    }
  };

  // Initial render with column width
  renderBadges(getAvailableWidth());
  
  // Clean up original measurement container
  document.body.removeChild(measureContainer);

  container.appendChild(badgesWrapper);
  
  return container;
}

function createBadge(text: string, index: number): HTMLElement {
  const badge = document.createElement('span');
  // Use consistent Badge component classes (secondary variant) + make it clickable
  badge.className = 'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 border-transparent bg-secondary text-secondary-foreground overflow-hidden cursor-pointer hover:bg-secondary/80 vibegridx-cell-badge-editable vibegridx-badge';
  badge.style.cssText = `
    max-width: 120px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  
  badge.textContent = text;
  badge.title = text; // Show full text on hover
  return badge;
}

/**
 * String-based version for standard rendering (returns HTML string)
 */
export function relationshipMultiBadgeString(
  value: any,
  column: Column,
  rowData?: any
): string {
  // For string rendering, fall back to simple display
  let items: string[] = [];
  if (rowData && rowData[`__resolved_${column.id}`]) {
    const resolvedValue = rowData[`__resolved_${column.id}`];
    if (Array.isArray(resolvedValue)) {
      items = resolvedValue;
    }
  } else if (Array.isArray(value)) {
    items = value.map(id => String(id));
  }

  if (items.length === 0) {
    return `<span class="text-muted-foreground text-xs italic cursor-pointer hover:text-foreground vibegridx-cell-badge-editable">${column.placeholder || 'Click to add items'}</span>`;
  }

  // Adaptive display based on column width and text length
  const columnWidth = column.width || 220;
  const estimatedBadgeWidth = 60; // Average badge width
  const moreButtonWidth = 50;
  const availableWidth = columnWidth - 24; // Account for padding
  
  // Calculate approximate number of badges that can fit
  let maxDisplay = Math.max(1, Math.floor(availableWidth / estimatedBadgeWidth));
  
  // If all items fit, show them all
  if (items.length <= maxDisplay) {
    maxDisplay = items.length;
  } else {
    // Reserve space for "+X more" button
    const widthWithMore = availableWidth - moreButtonWidth;
    maxDisplay = Math.max(1, Math.floor(widthWithMore / estimatedBadgeWidth));
  }
  
  const displayItems = items.slice(0, maxDisplay);
  const remaining = items.length - maxDisplay;

  let html = '<span class="flex items-center gap-1">';
  displayItems.forEach((item) => {
    // Use consistent Badge component classes (secondary variant) + clickable
    html += `<span class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 border-transparent bg-secondary text-secondary-foreground overflow-hidden cursor-pointer hover:bg-secondary/80 vibegridx-cell-badge-editable" style="max-width: 120px; text-overflow: ellipsis;" title="${item}">${item}</span>`;
  });

  if (remaining > 0) {
    // Use outline variant for "+X more" badge + clickable
    html += `<span class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer vibegridx-cell-badge-editable" title="${items.slice(maxDisplay).join(', ')}">+${remaining}</span>`;
  }

  html += '</span>';
  return html;
}