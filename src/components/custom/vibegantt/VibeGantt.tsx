import React, { useRef, useEffect, useMemo } from 'react';
import { useSelector } from '@legendapp/state/react';
import { createVibeGanttCore$ } from './stores/gantt-core';
import { createGanttInteraction$ } from './stores/gantt-interaction';
import { GanttRenderer } from './renderers/GanttRenderer';
import type { VibeGanttProps, GanttTask, TaskDependency, TimeScale } from './types';
import { GANTT_CONSTANTS } from './utils/calculations';
import './vibegantt.css';

export function VibeGantt({
  tableId,
  height = 600,
  width = '100%',
  className = '',
  enableDragAndDrop = true,
  enableDependencies = true,
  enableZoom = true,
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  onDependencyCreate,
  onDependencyDelete
}: VibeGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GanttRenderer | null>(null);

  // Create Gantt observables (like VibeGrid pattern)
  const ganttCore$ = useMemo(() => createVibeGanttCore$(tableId), [tableId]);
  const ganttInteraction$ = useMemo(() => createGanttInteraction$(ganttCore$), [ganttCore$]);

  // Subscribe to reactive state (VibeGrid pattern)
  const tasks = useSelector(ganttCore$.tasks);
  const dependencies = useSelector(ganttCore$.dependencies);
  const taskPositions = useSelector(ganttCore$.taskPositions);
  const dependencyPaths = useSelector(ganttCore$.dependencyPaths);
  const timeMarkers = useSelector(ganttCore$.timeMarkers);
  const timelineWidth = useSelector(ganttCore$.timelineWidth);
  const timelineHeight = useSelector(ganttCore$.timelineHeight);
  const viewState = useSelector(ganttCore$.viewState);

  // Subscribe to interaction state (like VibeGrid's tableInteraction$)
  const selectedTaskId = useSelector(ganttInteraction$.selectedTaskId);
  const selectedDependencyId = useSelector(ganttInteraction$.selectedDependencyId);
  const hoveredTaskId = useSelector(ganttInteraction$.hoveredTaskId);
  const isDragging = useSelector(ganttInteraction$.isDragging);
  const dragTaskId = useSelector(ganttInteraction$.dragTaskId);


  // Initialize renderer (like VibeGrid pattern)
  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new GanttRenderer({
      container: containerRef.current,
      ganttCore$,
      enableDragAndDrop,
      enableDependencies,
      enableZoom,
      onTaskUpdate,
      onTaskCreate,
      onTaskDelete,
      onDependencyCreate,
      onDependencyDelete,
    });

    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [enableDragAndDrop, enableDependencies, enableZoom]);

  const handleTimeScaleChange = (scale: TimeScale) => {
    ganttCore$.operations.setTimeScale(scale);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const currentZoom = viewState.zoomLevel;
    const factor = direction === 'in' ? 1.25 : 0.8;
    ganttCore$.operations.setZoom(currentZoom * factor);
  };

  const handleZoomToFit = () => {
    ganttCore$.operations.zoomToFit();
  };

  const handleAddTask = () => {
    const newTask = ganttCore$.operations.createTask({
      title: 'New Task',
      startDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 0,
      priority: 'medium',
      color: '#6b7280'
    });
    onTaskCreate?.(newTask);
  };

  const handleDeleteSelected = () => {
    if (viewState.selectedTaskId) {
      ganttCore$.operations.deleteTask(viewState.selectedTaskId);
      onTaskDelete?.(viewState.selectedTaskId);
    } else if (viewState.selectedDependencyId) {
      ganttCore$.operations.deleteDependency(viewState.selectedDependencyId);
      onDependencyDelete?.(viewState.selectedDependencyId);
    }
  };

  const handleResetData = () => {
    ganttCore$.operations.resetToMockData();
  };

  const handleClearData = () => {
    ganttCore$.operations.clearAllData();
  };


  // Render task bars
  const renderTaskBars = () => {
    return taskPositions.map((pos) => {
      const task = tasks.find(t => t.id === pos.taskId);
      if (!task) return null;

      const isSelected = selectedTaskId === pos.taskId;
      const isTaskDragging = isDragging && dragTaskId === pos.taskId;

      // Priority-based styling using Tailwind
      const priorityClasses = {
        high: 'bg-destructive text-destructive-foreground border-l-destructive',
        medium: 'bg-primary text-primary-foreground border-l-primary',
        low: 'bg-muted-foreground text-background border-l-muted-foreground'
      };

      return (
        <div
          key={pos.taskId}
          className={`vibegantt-task-bar ${priorityClasses[task.priority]} ${isSelected ? 'ring-2 ring-primary' : ''} ${isTaskDragging ? 'opacity-80 scale-105' : ''} rounded border border-black/10 flex items-center px-2 overflow-hidden shadow-sm transition-all hover:-translate-y-px hover:shadow-md`}
          style={{
            left: pos.x,
            top: pos.y + GANTT_CONSTANTS.TASK_BAR_MARGIN,
            width: pos.width,
            cursor: enableDragAndDrop ? 'grab' : 'pointer'
          }}
          data-task-id={pos.taskId}
          title={`${task.title} (${task.progress}%)`}
        >
          <div className="flex items-center w-full overflow-hidden">
            <div className="text-xs font-medium text-white drop-shadow-sm overflow-hidden text-ellipsis whitespace-nowrap flex-1">{pos.title}</div>
          </div>
          <div
            className="vibegantt-task-bar-progress"
            style={{ width: `${pos.progress}%` }}
          />
        </div>
      );
    });
  };

  // Render dependency lines
  const renderDependencies = () => {
    if (!enableDependencies) return null;

    return (
      <div className="vibegantt-dependencies">
        <svg className="vibegantt-dependency-svg" style={{ width: timelineWidth, height: timelineHeight }}>
          {dependencyPaths.map((path) => {
            const isSelected = viewState.selectedDependencyId === path.id;

            return (
              <g key={path.id}>
                <path
                  d={path.points}
                  className={`vibegantt-dependency-line ${isSelected ? 'selected' : ''}`}
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  style={{ color: isSelected ? 'oklch(var(--primary))' : 'oklch(var(--muted-foreground))' }}
                  data-dependency-id={path.id}
                />
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // Render time markers
  const renderTimeMarkers = () => {
    return (
      <div className="absolute inset-0 flex whitespace-nowrap" style={{ width: timelineWidth }}>
        {timeMarkers.map((marker, index) => (
          <div
            key={index}
            className={`relative border-l ${marker.type === 'major' ? 'border-l-muted-foreground bg-muted/30' : 'border-l-border'} flex flex-col justify-center px-1 min-w-[60px]`}
            style={{ left: marker.position }}
          >
            <div className={`text-xs font-medium text-center ${marker.type === 'major' ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
              {marker.label}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render task list
  const renderTaskList = () => {
    return (
      <div className="w-[280px] bg-muted/30 border-r-2 border-border flex-shrink-0 overflow-y-auto" ref={taskListRef}>
        <div className="h-10 bg-muted border-b border-border flex items-center px-3 font-semibold text-foreground text-xs uppercase tracking-wide">
          Tasks ({tasks.length})
        </div>
        {tasks.map((task) => {
          const isSelected = viewState.selectedTaskId === task.id;

          return (
            <div
              key={task.id}
              className={`h-10 border-b border-border flex items-center px-3 cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary pl-2' : 'hover:bg-muted/50'}`}
              data-task-id={task.id}
            >
              <div className="text-sm text-foreground font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</div>
              <div className="text-xs text-muted-foreground ml-2">{task.assignedTo}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`bg-background border border-border rounded-lg overflow-hidden relative ${className}`}
      style={{ height, width }}
      data-testid="vibegantt-container"
    >
      {/* Header with controls */}
      <div className="bg-muted border-b border-border p-3 flex items-center justify-between gap-4">
        <div className="text-lg font-semibold text-foreground">Project Timeline</div>

        <div className="flex items-center gap-2">
          {/* Time scale controls */}
          <div className="flex items-center gap-2 px-2 border-r border-border">
            <span className="text-sm text-muted-foreground font-medium">Scale:</span>
            <select
              className="px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
              value={viewState.timeScale}
              onChange={(e) => handleTimeScaleChange(e.target.value as TimeScale)}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>

          {/* Zoom controls */}
          {enableZoom && (
            <div className="flex items-center gap-1 px-2 border-r border-border">
              <span className="text-sm text-muted-foreground font-medium">Zoom:</span>
              <button className="px-2 py-1 border border-border bg-background hover:bg-muted rounded text-foreground" onClick={() => handleZoom('out')}>-</button>
              <span className="text-sm text-muted-foreground min-w-[50px] text-center">{Math.round(viewState.zoomLevel * 100)}%</span>
              <button className="px-2 py-1 border border-border bg-background hover:bg-muted rounded text-foreground" onClick={() => handleZoom('in')}>+</button>
              <button className="px-2 py-1 border border-border bg-background hover:bg-muted rounded text-foreground" onClick={handleZoomToFit}>Fit</button>
            </div>
          )}

          {/* Task controls */}
          <div className="flex items-center gap-1 px-2 border-r border-border">
            <button className="px-3 py-1 border border-border bg-background hover:bg-muted rounded text-foreground" onClick={handleAddTask}>+ Task</button>
            <button
              className="px-3 py-1 border border-border bg-background hover:bg-muted rounded text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleDeleteSelected}
              disabled={!selectedTaskId && !selectedDependencyId}
            >
              Delete
            </button>
          </div>

          {/* Data controls */}
          <div className="flex items-center gap-1">
            <button className="px-3 py-1 border border-border bg-background hover:bg-muted rounded text-foreground" onClick={handleResetData}>Reset</button>
            <button className="px-3 py-1 border border-border bg-background hover:bg-muted rounded text-foreground" onClick={handleClearData}>Clear</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col h-[calc(100%-60px)] overflow-hidden">
        {/* Time header */}
        <div className="bg-muted border-b-2 border-border h-[60px] relative overflow-hidden flex-shrink-0">
          {renderTimeMarkers()}
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden min-h-[400px]">
          {/* Task list */}
          {renderTaskList()}

          {/* Timeline */}
          <div
            className="flex-1 overflow-auto relative bg-background"
            ref={timelineRef}
          >
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              {timeMarkers.map((marker, index) => (
                <div
                  key={index}
                  className={`vibegantt-grid-line ${marker.type === 'major' ? 'bg-muted-foreground/30' : 'bg-border'}`}
                  style={{ left: marker.position }}
                />
              ))}
              {/* Header row line */}
              <div
                className="vibegantt-row-line bg-border"
                style={{ top: GANTT_CONSTANTS.ROW_HEIGHT }}
              />
              {/* Task row lines */}
              {tasks.map((_, index) => (
                <div
                  key={index}
                  className="vibegantt-row-line bg-border"
                  style={{ top: (index + 2) * GANTT_CONSTANTS.ROW_HEIGHT }}
                />
              ))}
            </div>

            {/* Task bars */}
            <div style={{ position: 'relative', width: timelineWidth, height: timelineHeight }}>
              {renderTaskBars()}
              {renderDependencies()}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default VibeGantt;