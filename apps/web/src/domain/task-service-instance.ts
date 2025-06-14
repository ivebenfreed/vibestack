import { TaskService } from './task';

let taskServiceInstance: TaskService | null = null;

export function setTaskService(service: TaskService): void {
  taskServiceInstance = service;
}

export async function getTaskService(): Promise<TaskService | null> {
  return taskServiceInstance;
}

export function hasTaskService(): boolean {
  return taskServiceInstance !== null;
} 