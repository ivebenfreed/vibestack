import { QueryClient } from '@tanstack/react-query'
import { loadDataForRoute, loadMultipleDataForRoute, UniversalQueryOptions } from './universal-reactive-pattern'

/**
 * Route Helpers - Enforce Universal Reactive Data Pattern
 * 
 * These helpers ensure routes ONLY use domain services and cache-first loading
 */

/**
 * Single Data Route Loader
 * 
 * Use this for routes that load one type of data
 * Example: Tasks list, Projects list, etc.
 */
export function createSingleDataLoader<T>(
  getQueryOptions: () => UniversalQueryOptions<T>
) {
  return async ({ context }: { context: { queryClient: QueryClient } }) => {
    const data = await loadDataForRoute(context.queryClient, getQueryOptions())
    return { data }
  }
}

/**
 * Multi Data Route Loader
 * 
 * Use this for routes that need multiple data sources
 * Example: Project detail page (project + users + tasks)
 */
export function createMultiDataLoader<T extends Record<string, any>>(
  getQueryConfigs: () => Record<keyof T, UniversalQueryOptions<any>>
) {
  return async ({ context }: { context: { queryClient: QueryClient } }) => {
    return await loadMultipleDataForRoute(context.queryClient, getQueryConfigs())
  }
}

/**
 * Parameterized Data Route Loader
 * 
 * Use this for routes with parameters (like project detail)
 */
export function createParameterizedDataLoader<T, P extends Record<string, string>>(
  getQueryOptions: (params: P) => UniversalQueryOptions<T>
) {
  return async ({ 
    params, 
    context 
  }: { 
    params: P
    context: { queryClient: QueryClient } 
  }) => {
    const data = await loadDataForRoute(context.queryClient, getQueryOptions(params))
    return { data }
  }
}

/**
 * Multi Parameterized Data Route Loader
 * 
 * Use this for complex routes with parameters and multiple data sources
 */
export function createMultiParameterizedDataLoader<T extends Record<string, any>, P extends Record<string, string>>(
  getQueryConfigs: (params: P) => Record<keyof T, UniversalQueryOptions<any>>
) {
  return async ({ 
    params, 
    context 
  }: { 
    params: P
    context: { queryClient: QueryClient } 
  }) => {
    return await loadMultipleDataForRoute(context.queryClient, getQueryConfigs(params))
  }
}

/**
 * Route Pattern Examples and Documentation
 * 
 * CORRECT USAGE:
 * 
 * // Simple list route
 * export const Route = createFileRoute('/tasks/')({
 *   component: Tasks,
 *   loader: createSingleDataLoader(() => TaskService.queryOptions.all())
 * })
 * 
 * // Detail route with parameter
 * export const Route = createFileRoute('/projects/$projectId')({
 *   component: ProjectDetail,
 *   loader: createParameterizedDataLoader((params) => 
 *     ProjectService.queryOptions.detail(params.projectId)
 *   )
 * })
 * 
 * // Complex route with multiple data sources
 * export const Route = createFileRoute('/projects/$projectId')({
 *   component: ProjectDetail,
 *   loader: createMultiParameterizedDataLoader((params) => ({
 *     project: ProjectService.queryOptions.detail(params.projectId),
 *     users: UserService.queryOptions.all(),
 *     tasks: TaskService.queryOptions.byProject(params.projectId)
 *   }))
 * })
 * 
 * FORBIDDEN PATTERNS:
 * ❌ Direct DB queries in routes
 * ❌ Manual cache checking
 * ❌ Bypassing domain services
 * ❌ Custom data fetching logic in routes
 */ 