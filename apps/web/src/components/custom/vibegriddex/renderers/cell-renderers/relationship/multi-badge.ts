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

  // Handle empty state
  if (items.length === 0) {
    const emptyState = document.createElement('span');
    emptyState.className = 'vibegridx-empty-badge';
    emptyState.style.cssText = `
      color: var(--muted-foreground);
      font-size: 12px;
      font-style: italic;
    `;
    emptyState.textContent = column.placeholder || 'No items';
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

  // Measure available width from the cell container
  // We'll get the actual width after the component is mounted
  const measureWidth = () => {
    const cellElement = container.closest('.vibegridx-cell');
    if (cellElement) {
      const computedStyle = window.getComputedStyle(cellElement);
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 12;
      const paddingRight = parseFloat(computedStyle.paddingRight) || 12;
      return cellElement.clientWidth - paddingLeft - paddingRight;
    }
    return column.width ? column.width - 24 : 200; // Fallback
  };
  
  // Defer measurement to next frame to ensure DOM is ready
  requestAnimationFrame(() => {
    const containerWidth = measureWidth();
    renderBadges(containerWidth);
  });
  
  // Also render immediately with estimated width
  const containerWidth = column.width ? column.width - 24 : 200;
  
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
    
    badges.forEach(badge => tempMeasureContainer.appendChild(badge.cloneNode(true)));
    
    let currentWidth = 0;
    let visibleCount = 0;
    const badgeWidths: number[] = [];

    // Measure each badge
    tempMeasureContainer.querySelectorAll('.vibegridx-badge').forEach((badge, index) => {
      const width = (badge as HTMLElement).offsetWidth;
      badgeWidths[index] = width;
    });

    // Clean up measurement container
    document.body.removeChild(tempMeasureContainer);

    // Calculate how many badges can fit
    const moreButtonWidth = 50; // Approximate width of "+X more" badge
    let availableWidth = availableContainerWidth - moreButtonWidth;

    for (let i = 0; i < badges.length; i++) {
      const badgeWidth = badgeWidths[i] + (i > 0 ? 4 : 0); // Add gap
      if (currentWidth + badgeWidth <= availableWidth || i === 0) {
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
      // Show visible badges and "+X more"
      for (let i = 0; i < visibleCount; i++) {
        badgesWrapper.appendChild(badges[i].cloneNode(true));
      }

      const remaining = badges.length - visibleCount;
      const moreBadge = document.createElement('span');
      moreBadge.className = 'vibegridx-badge vibegridx-badge-more';
      moreBadge.style.cssText = `
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        font-size: 11px;
        border-radius: 12px;
        background: var(--accent);
        color: var(--accent-foreground);
        font-weight: 500;
      `;
      moreBadge.textContent = `+${remaining}`;
      moreBadge.title = items.slice(visibleCount).join(', ');
      badgesWrapper.appendChild(moreBadge);
    }
  };

  // Initial render with estimated width
  renderBadges(containerWidth);
  
  // Clean up original measurement container
  document.body.removeChild(measureContainer);

  container.appendChild(badgesWrapper);
  
  // Add resize observer to handle column width changes
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
      const newWidth = measureWidth();
      renderBadges(newWidth);
    });
    
    // Observe the cell element when it's available
    requestAnimationFrame(() => {
      const cellElement = container.closest('.vibegridx-cell');
      if (cellElement) {
        resizeObserver.observe(cellElement);
        
        // Store observer for cleanup
        (container as any)._resizeObserver = resizeObserver;
      }
    });
  }
  
  return container;
}

function createBadge(text: string, index: number): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'vibegridx-badge';
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    font-size: 11px;
    border-radius: 12px;
    background: var(--primary);
    color: var(--primary-foreground);
    font-weight: 500;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  
  // Alternate colors for visual distinction
  if (index % 2 === 1) {
    badge.style.background = 'var(--secondary)';
    badge.style.color = 'var(--secondary-foreground)';
  }
  
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
    return `<span class="vibegridx-empty-badge">${column.placeholder || 'No items'}</span>`;
  }

  // Simple string version - show first few items
  const maxDisplay = 3;
  const displayItems = items.slice(0, maxDisplay);
  const remaining = items.length - maxDisplay;

  let html = '<span class="vibegridx-multi-badges">';
  displayItems.forEach((item, index) => {
    const bgColor = index % 2 === 0 ? 'var(--primary)' : 'var(--secondary)';
    const color = index % 2 === 0 ? 'var(--primary-foreground)' : 'var(--secondary-foreground)';
    html += `<span class="vibegridx-badge" style="background: ${bgColor}; color: ${color}; padding: 2px 8px; font-size: 11px; border-radius: 12px; margin-right: 4px;">${item}</span>`;
  });

  if (remaining > 0) {
    html += `<span class="vibegridx-badge vibegridx-badge-more" style="background: var(--accent); color: var(--accent-foreground); padding: 2px 8px; font-size: 11px; border-radius: 12px;">+${remaining}</span>`;
  }

  html += '</span>';
  return html;
}