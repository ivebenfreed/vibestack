import { TimeScaleEngine } from '../engines/TimeScaleEngine';
import type { TaskDependency, TaskLayout } from '../../types';
import { GANTT_COLORS, RENDER_CONFIG } from '../../constants';

interface DependencyRenderOptions {
  isCritical: boolean;
}

export class DependencyRenderer {
  private container: SVGElement;
  private timeScaleEngine: TimeScaleEngine;
  private dependencyElements: Map<string, SVGGElement> = new Map();
  private isDestroyed: boolean = false;
  
  constructor(container: SVGElement, timeScaleEngine: TimeScaleEngine) {
    this.container = container;
    this.timeScaleEngine = timeScaleEngine;
    
    // Create defs for arrow markers
    this.createArrowMarkers();
  }
  
  private createArrowMarkers(): void {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Normal arrow marker
    const normalMarker = this.createArrowMarker('dependency-arrow-normal', GANTT_COLORS.dependency.arrow);
    defs.appendChild(normalMarker);
    
    // Critical path arrow marker
    const criticalMarker = this.createArrowMarker('dependency-arrow-critical', GANTT_COLORS.dependency.critical);
    defs.appendChild(criticalMarker);
    
    this.container.appendChild(defs);
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
    if (this.isDestroyed) return;
    
    const element = this.createDependencyElement(dependency, sourceLayout, targetLayout, options);
    this.container.appendChild(element);
    this.dependencyElements.set(dependency.id, element);
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
    
    const path = this.createDependencyPath(dependency, sourceLayout, targetLayout, options);
    group.appendChild(path);
    
    return group;
  }
  
  private createDependencyPath(
    dependency: TaskDependency,
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout,
    options: DependencyRenderOptions
  ): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    // Calculate connection points based on dependency type
    const { startPoint, endPoint } = this.calculateConnectionPoints(
      dependency.type,
      sourceLayout,
      targetLayout
    );
    
    // Generate path data
    const pathData = this.generatePathData(startPoint, endPoint, dependency.type);
    path.setAttribute('d', pathData);
    
    // Apply styles
    const color = options.isCritical ? GANTT_COLORS.dependency.critical : GANTT_COLORS.dependency.line;
    const markerEnd = options.isCritical ? 'url(#dependency-arrow-critical)' : 'url(#dependency-arrow-normal)';
    
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', markerEnd);
    
    // Add hover effect
    path.style.cursor = 'pointer';
    path.addEventListener('mouseenter', () => {
      path.setAttribute('stroke-width', '3');
      path.style.opacity = '0.8';
    });
    
    path.addEventListener('mouseleave', () => {
      path.setAttribute('stroke-width', '2');
      path.style.opacity = '1';
    });
    
    return path;
  }
  
  private updateDependencyPath(
    group: SVGGElement,
    dependency: TaskDependency,
    sourceLayout: TaskLayout,
    targetLayout: TaskLayout,
    options: DependencyRenderOptions
  ): void {
    const path = group.querySelector('path');
    if (!path) return;
    
    // Recalculate connection points
    const { startPoint, endPoint } = this.calculateConnectionPoints(
      dependency.type,
      sourceLayout,
      targetLayout
    );
    
    // Update path data
    const pathData = this.generatePathData(startPoint, endPoint, dependency.type);
    path.setAttribute('d', pathData);
    
    // Update styles if critical status changed
    const color = options.isCritical ? GANTT_COLORS.dependency.critical : GANTT_COLORS.dependency.line;
    const markerEnd = options.isCritical ? 'url(#dependency-arrow-critical)' : 'url(#dependency-arrow-normal)';
    
    path.setAttribute('stroke', color);
    path.setAttribute('marker-end', markerEnd);
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
    // Simple curved path for now - can be enhanced later
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    
    // Calculate control points for a smooth curve
    const controlPoint1X = startPoint.x + dx * 0.5;
    const controlPoint1Y = startPoint.y;
    const controlPoint2X = startPoint.x + dx * 0.5;
    const controlPoint2Y = endPoint.y;
    
    // Adjust end point to account for arrow marker
    const adjustedEndX = endPoint.x - (dx > 0 ? 5 : -5);
    
    return `M ${startPoint.x},${startPoint.y} C ${controlPoint1X},${controlPoint1Y} ${controlPoint2X},${controlPoint2Y} ${adjustedEndX},${endPoint.y}`;
  }
  
  resize(width: number, height: number): void {
    this.container.setAttribute('width', width.toString());
    this.container.setAttribute('height', height.toString());
  }
  
  clear(): void {
    this.dependencyElements.forEach(element => element.remove());
    this.dependencyElements.clear();
  }
  
  destroy(): void {
    this.isDestroyed = true;
    this.clear();
  }
}