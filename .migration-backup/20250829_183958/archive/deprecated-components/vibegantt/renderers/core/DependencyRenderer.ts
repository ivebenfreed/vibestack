import { TimeScaleEngine } from '../engines/TimeScaleEngine';
import type { TaskDependency, TaskLayout } from '../../types';
import { GANTT_COLORS, RENDER_CONFIG } from '../../constants';

interface DependencyRenderOptions {
  isCritical: boolean;
  isSelected?: boolean;
}

export class DependencyRenderer {
  private container: SVGElement;
  private timeScaleEngine: TimeScaleEngine;
  private dependencyElements: Map<string, SVGGElement> = new Map();
  private dependencyLayouts: Map<string, { dependency: TaskDependency; sourceLayout: TaskLayout; targetLayout: TaskLayout }> = new Map();
  private selectedDependencyId: string | null = null;
  private isDestroyed: boolean = false;
  private eventHandler: ((event: any) => void) | null = null;
  
  constructor(container: SVGElement, timeScaleEngine: TimeScaleEngine, eventHandler?: (event: any) => void) {
    this.container = container;
    this.timeScaleEngine = timeScaleEngine;
    this.eventHandler = eventHandler || null;
    
    // Create defs for arrow markers
    this.createArrowMarkers();
    
    // Enable pointer events on the container for click handling
    this.container.style.pointerEvents = 'auto';
  }
  
  private createArrowMarkers(): void {
    // Professional Gantt charts don't use arrows - they use clean lines
    // Removing arrow markers for a cleaner, more professional appearance
  }
  
  private createArrowMarker(id: string, color: string): SVGMarkerElement {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    path.setAttribute('fill', color);
    
    marker.appendChild(path);
    return marker;
  }
  
  createDependency(
    dependency: TaskDependency,
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout,
    options: DependencyRenderOptions
  ): void {
    console.log('DependencyRenderer.createDependency: Called', {
      dependencyId: dependency.id,
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type,
      sourceLayout,
      targetLayout,
      isDestroyed: this.isDestroyed
    });
    
    if (this.isDestroyed) return;
    
    // Store layouts for later use in selection elements
    this.dependencyLayouts.set(dependency.id, { dependency, sourceLayout, targetLayout });
    
    const element = this.createDependencyElement(dependency, sourceLayout, targetLayout, options);
    console.log('DependencyRenderer.createDependency: Created element', {
      dependencyId: dependency.id,
      element,
      containerChildren: this.container.children.length
    });
    
    this.container.appendChild(element);
    this.dependencyElements.set(dependency.id, element);
    
    console.log('DependencyRenderer.createDependency: Element appended', {
      dependencyId: dependency.id,
      containerChildrenAfter: this.container.children.length,
      storedElements: this.dependencyElements.size
    });
  }
  
  updateDependency(
    dependency: TaskDependency,
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout,
    options: DependencyRenderOptions
  ): void {
    if (this.isDestroyed) return;
    
    const existingElement = this.dependencyElements.get(dependency.id);
    if (existingElement) {
      // Update existing element
      this.updateDependencyPath(existingElement, dependency, sourceLayout, targetLayout, options);
    } else {
      // Create new element
      this.createDependency(dependency, sourceLayout, targetLayout, options);
    }
  }
  
  deleteDependency(dependencyId: string): void {
    const element = this.dependencyElements.get(dependencyId);
    if (element) {
      element.remove();
      this.dependencyElements.delete(dependencyId);
    }
    
    // Clean up stored layouts
    this.dependencyLayouts.delete(dependencyId);
    
    // Clear selection if this dependency was selected
    if (this.selectedDependencyId === dependencyId) {
      this.selectedDependencyId = null;
    }
  }
  
  private createDependencyElement(
    dependency: TaskDependency,
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout,
    options: DependencyRenderOptions
  ): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'vibegantt-dependency');
    group.setAttribute('data-dependency-id', dependency.id);
    
    const pathGroup = this.createDependencyPath(dependency, sourceLayout, targetLayout, options);
    group.appendChild(pathGroup);
    
    // Add selection elements if this dependency is selected
    if (options.isSelected) {
      this.addSelectionElements(group, dependency, sourceLayout, targetLayout);
    }
    
    return group;
  }
  
  private createDependencyPath(
    dependency: TaskDependency,
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout,
    options: DependencyRenderOptions
  ): SVGGElement {
    // Calculate connection points based on dependency type
    const { startPoint, endPoint } = this.calculateConnectionPoints(
      dependency.type,
      sourceLayout,
      targetLayout
    );
    
    // Generate path data
    const pathData = this.generatePathData(startPoint, endPoint, dependency.type);
    
    // Apply clean, professional styling without arrows
    const isSelected = options.isSelected || false;
    const color = options.isCritical ? GANTT_COLORS.dependency.critical : GANTT_COLORS.dependency.line;
    const selectedColor = GANTT_COLORS.selection.border;
    
    // Create a group to hold both the hit area and visible path
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-dependency-id', dependency.id);
    
    // Create invisible wider hit area (12px wide for easier clicking)
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.setAttribute('d', pathData);
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('stroke-width', '12');
    hitArea.setAttribute('fill', 'none');
    hitArea.style.cursor = 'pointer';
    hitArea.style.pointerEvents = 'stroke';
    
    // Create the main visible path
    const visiblePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    visiblePath.setAttribute('d', pathData);
    visiblePath.setAttribute('stroke', isSelected ? selectedColor : color);
    visiblePath.setAttribute('stroke-width', isSelected ? '2.5' : '1.5');
    visiblePath.setAttribute('fill', 'none');
    visiblePath.setAttribute('stroke-opacity', isSelected ? '1' : '0.7');
    visiblePath.style.pointerEvents = 'none'; // Let hit area handle clicks
    
    // Add click handler to hit area
    hitArea.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Path clicked for dependency:', dependency.id);
      this.handleDependencyClick(dependency.id);
    });
    
    // Add hover effect to visible path via hit area events
    hitArea.addEventListener('mouseenter', () => {
      if (!isSelected) {
        visiblePath.setAttribute('stroke-width', '2');
        visiblePath.setAttribute('stroke-opacity', '1');
      }
    });
    
    hitArea.addEventListener('mouseleave', () => {
      if (!isSelected) {
        visiblePath.setAttribute('stroke-width', isSelected ? '2.5' : '1.5');
        visiblePath.setAttribute('stroke-opacity', isSelected ? '1' : '0.7');
      }
    });
    
    // Add both paths to the group (hit area first, then visible path)
    group.appendChild(hitArea);
    group.appendChild(visiblePath);
    
    return group;
  }
  
  private updateDependencyPath(
    group: SVGGElement,
    dependency: TaskDependency,
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout,
    options: DependencyRenderOptions
  ): void {
    const pathGroup = group.querySelector('g[data-dependency-id]') as SVGGElement;
    if (!pathGroup) return;
    
    const hitArea = pathGroup.children[0] as SVGPathElement;
    const visiblePath = pathGroup.children[1] as SVGPathElement;
    if (!hitArea || !visiblePath) return;
    
    // Recalculate connection points
    const { startPoint, endPoint } = this.calculateConnectionPoints(
      dependency.type,
      sourceLayout,
      targetLayout
    );
    
    // Update path data for both hit area and visible path
    const pathData = this.generatePathData(startPoint, endPoint, dependency.type);
    hitArea.setAttribute('d', pathData);
    visiblePath.setAttribute('d', pathData);
    
    // Update styles if critical status changed
    const isSelected = options.isSelected || false;
    const color = options.isCritical ? GANTT_COLORS.dependency.critical : GANTT_COLORS.dependency.line;
    const selectedColor = GANTT_COLORS.selection.border;
    
    visiblePath.setAttribute('stroke', isSelected ? selectedColor : color);
    visiblePath.setAttribute('stroke-width', isSelected ? '2.5' : '1.5');
    visiblePath.setAttribute('stroke-opacity', isSelected ? '1' : '0.7');
    // No marker-end - professional Gantt charts use simple lines
  }
  
  private calculateConnectionPoints(
    type: TaskDependency['type'],
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout
  ): { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } } {
    const sourceCenter = sourceLayout.y + sourceLayout.height / 2;
    const targetCenter = targetLayout.y + targetLayout.height / 2;
    
    let startPoint: { x: number; y: number };
    let endPoint: { x: number; y: number };
    
    switch (type) {
      case 'finish-to-start':
        // Most common: from end of source to start of target
        startPoint = {
          x: sourceLayout.x + sourceLayout.width,
          y: sourceCenter
        };
        endPoint = {
          x: targetLayout.x,
          y: targetCenter
        };
        break;
        
      case 'start-to-start':
        // From start of source to start of target
        startPoint = {
          x: sourceLayout.x,
          y: sourceCenter
        };
        endPoint = {
          x: targetLayout.x,
          y: targetCenter
        };
        break;
        
      case 'finish-to-finish':
        // From end of source to end of target
        startPoint = {
          x: sourceLayout.x + sourceLayout.width,
          y: sourceCenter
        };
        endPoint = {
          x: targetLayout.x + targetLayout.width,
          y: targetCenter
        };
        break;
        
      case 'start-to-finish':
        // From start of source to end of target
        startPoint = {
          x: sourceLayout.x,
          y: sourceCenter
        };
        endPoint = {
          x: targetLayout.x + targetLayout.width,
          y: targetCenter
        };
        break;
        
      default:
        // Default to finish-to-start
        startPoint = {
          x: sourceLayout.x + sourceLayout.width,
          y: sourceCenter
        };
        endPoint = {
          x: targetLayout.x,
          y: targetCenter
        };
    }
    
    return { startPoint, endPoint };
  }
  
  private generatePathData(
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    type: TaskDependency['type']
  ): string {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    
    // Create clean, professional curved path similar to Microsoft Project
    if (Math.abs(dx) < 20) {
      // For very close tasks, use a simple vertical line with small horizontal offset
      const midY = startPoint.y + dy * 0.5;
      return `M ${startPoint.x},${startPoint.y} L ${startPoint.x + 10},${startPoint.y} L ${startPoint.x + 10},${midY} L ${endPoint.x - 10},${midY} L ${endPoint.x - 10},${endPoint.y} L ${endPoint.x},${endPoint.y}`;
    } else {
      // For normal spacing, use smooth curve with minimal control points
      const controlOffset = Math.min(Math.abs(dx) * 0.3, 40); // Limit curve intensity
      const controlPoint1X = startPoint.x + controlOffset;
      const controlPoint1Y = startPoint.y;
      const controlPoint2X = endPoint.x - controlOffset;
      const controlPoint2Y = endPoint.y;
      
      return `M ${startPoint.x},${startPoint.y} C ${controlPoint1X},${controlPoint1Y} ${controlPoint2X},${controlPoint2Y} ${endPoint.x},${endPoint.y}`;
    }
  }
  
  resize(width: number, height: number): void {
    this.container.setAttribute('width', width.toString());
    this.container.setAttribute('height', height.toString());
    this.container.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  
  clear(): void {
    this.dependencyElements.forEach(element => element.remove());
    this.dependencyElements.clear();
  }
  
  // Handle dependency selection
  private handleDependencyClick(dependencyId: string): void {
    console.log('DependencyRenderer: Dependency clicked', dependencyId);
    
    // Update selection state
    const wasSelected = this.selectedDependencyId === dependencyId;
    this.selectedDependencyId = wasSelected ? null : dependencyId;
    
    // Notify parent component
    if (this.eventHandler) {
      this.eventHandler({
        type: 'DEPENDENCY_SELECT',
        dependencyId: wasSelected ? null : dependencyId
      });
    }
    
    // Update visual state of all dependencies
    this.updateAllDependencySelections();
  }
  
  // Update selection visual state for all dependencies
  private updateAllDependencySelections(): void {
    this.dependencyElements.forEach((element, dependencyId) => {
      const isSelected = this.selectedDependencyId === dependencyId;
      this.updateDependencySelection(element, isSelected);
    });
  }
  
  // Update selection visual state for a single dependency
  private updateDependencySelection(group: SVGGElement, isSelected: boolean): void {
    const pathGroup = group.querySelector('g[data-dependency-id]') as SVGGElement;
    if (pathGroup) {
      const visiblePath = pathGroup.children[1] as SVGPathElement;
      if (visiblePath) {
        const currentStroke = visiblePath.getAttribute('stroke');
        const isCritical = currentStroke === GANTT_COLORS.dependency.critical;
        const color = isCritical ? GANTT_COLORS.dependency.critical : GANTT_COLORS.dependency.line;
        const selectedColor = GANTT_COLORS.selection.border;
        
        visiblePath.setAttribute('stroke', isSelected ? selectedColor : color);
        visiblePath.setAttribute('stroke-width', isSelected ? '2.5' : '1.5');
        visiblePath.setAttribute('stroke-opacity', isSelected ? '1' : '0.7');
      }
    }
    
    // Remove existing selection elements
    const existingSelection = group.querySelector('.dependency-selection-elements');
    if (existingSelection) {
      existingSelection.remove();
    }
    
    // Add selection elements if selected
    if (isSelected) {
      const dependencyId = group.getAttribute('data-dependency-id');
      if (dependencyId) {
        console.log('DependencyRenderer: Dependency selected', dependencyId);
        const dependencyData = this.dependencyLayouts.get(dependencyId);
        if (dependencyData) {
          this.addSelectionElements(group, dependencyData.dependency, dependencyData.sourceLayout, dependencyData.targetLayout);
        }
      }
    }
  }
  
  // Add connection points and delete button for selected dependency
  private addSelectionElements(
    group: SVGGElement,
    dependency: TaskDependency,
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout
  ): void {
    const selectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    selectionGroup.setAttribute('class', 'dependency-selection-elements');
    
    // Calculate connection points
    const { startPoint, endPoint } = this.calculateConnectionPoints(
      dependency.type,
      sourceLayout,
      targetLayout
    );
    
    // Add draggable connection point at start
    const startHandle = this.createConnectionHandle(startPoint, 'start', dependency.id);
    selectionGroup.appendChild(startHandle);
    
    // Add draggable connection point at end
    const endHandle = this.createConnectionHandle(endPoint, 'end', dependency.id);
    selectionGroup.appendChild(endHandle);
    
    // Add delete button at midpoint
    const midPoint = {
      x: (startPoint.x + endPoint.x) / 2,
      y: (startPoint.y + endPoint.y) / 2
    };
    const deleteButton = this.createDeleteButton(midPoint, dependency.id);
    selectionGroup.appendChild(deleteButton);
    
    group.appendChild(selectionGroup);
  }
  
  // Create draggable connection handle
  private createConnectionHandle(
    point: { x: number; y: number },
    type: 'start' | 'end',
    dependencyId: string
  ): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `connection-handle connection-handle-${type}`);
    group.setAttribute('data-dependency-id', dependencyId);
    group.setAttribute('data-handle-type', type);
    
    // Create circular handle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', point.x.toString());
    circle.setAttribute('cy', point.y.toString());
    circle.setAttribute('r', '6');
    circle.setAttribute('fill', GANTT_COLORS.selection.border);
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');
    circle.style.cursor = 'grab';
    
    // Add drag handlers
    circle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startConnectionDrag(dependencyId, type, e);
    });
    
    group.appendChild(circle);
    return group;
  }
  
  // Create delete button
  private createDeleteButton(
    point: { x: number; y: number },
    dependencyId: string
  ): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'delete-button');
    group.setAttribute('data-dependency-id', dependencyId);
    
    // Create circular background
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', point.x.toString());
    circle.setAttribute('cy', point.y.toString());
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', '#ef4444');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');
    
    // Create X symbol
    const xPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const xSize = 4;
    xPath.setAttribute('d', `M ${point.x - xSize},${point.y - xSize} L ${point.x + xSize},${point.y + xSize} M ${point.x + xSize},${point.y - xSize} L ${point.x - xSize},${point.y + xSize}`);
    xPath.setAttribute('stroke', '#ffffff');
    xPath.setAttribute('stroke-width', '2');
    xPath.setAttribute('stroke-linecap', 'round');
    xPath.style.pointerEvents = 'none';
    
    // Set pointer events on the group to capture clicks
    group.style.cursor = 'pointer';
    group.style.pointerEvents = 'all';
    
    // Add click handler to the group instead of circle
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('Delete button clicked for dependency:', dependencyId);
      this.handleDependencyDelete(dependencyId);
    });
    
    group.appendChild(circle);
    group.appendChild(xPath);
    return group;
  }
  
  // Handle connection point drag start
  private startConnectionDrag(dependencyId: string, handleType: 'start' | 'end', event: MouseEvent): void {
    console.log('DependencyRenderer: Starting connection drag', { dependencyId, handleType });
    
    // Get the dependency data
    const dependencyData = this.dependencyLayouts.get(dependencyId);
    if (!dependencyData) return;
    
    // Create drag line preview
    const dragLine = this.createDragLine(event.clientX, event.clientY);
    this.container.appendChild(dragLine);
    
    // Store drag state
    const dragState = {
      dependencyId,
      handleType,
      dragLine,
      startX: event.clientX,
      startY: event.clientY,
      originalDependency: dependencyData.dependency
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      // Update drag line end position
      const containerRect = this.container.getBoundingClientRect();
      const relativeX = e.clientX - containerRect.left;
      const relativeY = e.clientY - containerRect.top;
      
      const startX = dragState.startX - containerRect.left;
      const startY = dragState.startY - containerRect.top;
      
      dragLine.setAttribute('d', `M ${startX},${startY} L ${relativeX},${relativeY}`);
      
      // Highlight potential drop targets
      this.highlightDropTargets(e);
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Remove drag line
      dragLine.remove();
      
      // Clear drop target highlights
      this.clearDropTargetHighlights();
      
      // Find drop target
      const dropTarget = this.findDropTarget(e);
      if (dropTarget) {
        console.log('DependencyRenderer: Connection dropped on task', dropTarget);
        
        // Notify parent about dependency reassignment
        if (this.eventHandler) {
          this.eventHandler({
            type: 'DEPENDENCY_REASSIGN',
            dependencyId,
            handleType,
            newTaskId: dropTarget,
            originalPredecessorId: dependencyData.dependency.predecessorId,
            originalSuccessorId: dependencyData.dependency.successorId
          });
        }
      } else {
        console.log('DependencyRenderer: Connection drag cancelled - no valid drop target');
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Notify parent about drag start
    if (this.eventHandler) {
      this.eventHandler({
        type: 'DEPENDENCY_DRAG_START',
        dependencyId,
        handleType,
        x: event.clientX,
        y: event.clientY
      });
    }
  }
  
  // Handle dependency deletion
  private handleDependencyDelete(dependencyId: string): void {
    console.log('DependencyRenderer: Deleting dependency', dependencyId);
    
    if (this.eventHandler) {
      this.eventHandler({
        type: 'DEPENDENCY_DELETE',
        dependencyId
      });
    }
  }
  
  // Create drag line for connection dragging
  private createDragLine(startX: number, startY: number): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', GANTT_COLORS.selection.border);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '5,5');
    path.setAttribute('fill', 'none');
    path.style.pointerEvents = 'none';
    path.style.zIndex = '1000';
    
    // Convert screen coordinates to container-relative coordinates
    const containerRect = this.container.getBoundingClientRect();
    const relativeX = startX - containerRect.left;
    const relativeY = startY - containerRect.top;
    
    path.setAttribute('d', `M ${relativeX},${relativeY} L ${relativeX},${relativeY}`);
    return path;
  }
  
  // Highlight potential drop targets during drag
  private highlightDropTargets(event: MouseEvent): void {
    // Find task element under mouse
    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    const taskElement = elements.find(el => el.classList.contains('vibegantt-task'));
    
    // Clear previous highlights
    this.clearDropTargetHighlights();
    
    if (taskElement && taskElement instanceof HTMLElement) {
      taskElement.style.outline = `2px solid ${GANTT_COLORS.selection.border}`;
      taskElement.style.outlineOffset = '2px';
      taskElement.classList.add('dependency-drop-target');
    }
  }
  
  // Clear drop target highlights
  private clearDropTargetHighlights(): void {
    const highlightedElements = document.querySelectorAll('.dependency-drop-target');
    highlightedElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.classList.remove('dependency-drop-target');
      }
    });
  }
  
  // Find drop target task ID
  private findDropTarget(event: MouseEvent): string | null {
    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    const taskElement = elements.find(el => el.classList.contains('vibegantt-task'));
    
    if (taskElement && taskElement instanceof HTMLElement) {
      return taskElement.dataset.taskId || null;
    }
    
    return null;
  }
  
  // Public method to update dependency selection from external source
  updateDependencySelectionState(dependencyId: string | null): void {
    this.selectedDependencyId = dependencyId;
    this.updateAllDependencySelections();
  }
  
  destroy(): void {
    this.isDestroyed = true;
    this.clear();
  }
}