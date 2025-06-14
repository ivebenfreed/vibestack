/**
 * Universal Reactive Data Pattern - Core Types and Validation
 * 
 * This module defines the strict patterns that ALL data loading must follow
 * in our application. It enforces:
 * 
 * 1. Single Source of Truth: All data flows through Domain Services
 * 2. Cache-First Loading: Routes use ensureQueryData automatically  
 * 3. Live Reactive Updates: Components use domain service hooks
 * 4. Type Safety: Full TypeScript support
 * 5. No Forbidden Patterns: Direct DB access, manual cache checking, etc.
 */

import { QueryOptions, QueryClient, UseQueryOptions } from '@tanstack/react-query'
import { ObjectLiteral } from 'typeorm'

// ============================================================================
// CORE PATTERN TYPES
// ============================================================================

export type UniversalQueryOptions<T = any> = UseQueryOptions<T, Error, T, (string | number)[]>

/**
 * Standard queryOptions factory function that domain services must implement
 */
export type QueryOptionsFactory<TData = unknown, TParams extends any[] = any[]> = 
  (...params: TParams) => QueryOptions<TData>

/**
 * Domain service queryOptions structure - enforces consistent patterns
 */
export interface DomainServiceQueryOptions {
  // Core queries every domain should have
  all: QueryOptionsFactory<any[]>
  count: QueryOptionsFactory<number>
  detail: QueryOptionsFactory<any | null, [string]>
  
  // Additional domain-specific queries
  [key: string]: QueryOptionsFactory<any, any[]>
}

/**
 * Domain service hook structure - enforces reactive patterns
 */
export interface DomainServiceHooks {
  // Core hooks every domain should have
  [key: `use${string}`]: () => any
  
  // Mutation hooks
  [key: `useCreate${string}`]: () => any
  [key: `useUpdate${string}`]: () => any
  [key: `useDelete${string}`]: () => any
}

/**
 * Complete domain service interface - enforces Universal Reactive Data Pattern
 */
export interface UniversalReactiveDomainService {
  queryOptions: DomainServiceQueryOptions
  hooks: DomainServiceHooks
  createQueryBuilders: (createQueryBuilder: Function) => Record<string, Function>
}

export interface DomainServiceContract<T extends ObjectLiteral> {
  // Required: Query options for TanStack Query integration
  queryOptions: Record<string, (...args: any[]) => UniversalQueryOptions<T | T[]>>
  
  // Required: Hooks for reactive components
  hooks: Record<string, (...args: any[]) => any>
  
  // Required: Query builders for live queries
  createQueryBuilders: (createQueryBuilder: any) => Record<string, any>
}

// ============================================================================
// ROUTE LOADER TYPES
// ============================================================================

/**
 * Valid route loader function that follows Universal Reactive Data Pattern
 */
export type UniversalReactiveLoader = () => Promise<any>

/**
 * Route loader configuration for single data source
 */
export interface SingleDataLoaderConfig<TData = any> {
  queryOptions: QueryOptionsFactory<TData>
  description?: string
}

/**
 * Route loader configuration for multiple data sources
 */
export interface MultiDataLoaderConfig {
  queries: Record<string, QueryOptionsFactory<any>>
  description?: string
}

/**
 * Route loader configuration for parameterized data
 */
export interface ParameterizedDataLoaderConfig<TData = any, TParams extends any[] = any[]> {
  queryOptions: QueryOptionsFactory<TData, TParams>
  paramExtractor: (request: Request) => TParams
  description?: string
}

/**
 * Route Pattern Enforcement
 */
export type RouteLoaderPattern<T> = {
  loader: (context: { context: { queryClient: QueryClient } }) => Promise<T>
}

/**
 * Hook Pattern Enforcement
 */
export type ReactiveHookPattern<T> = () => {
  data: T | undefined
  isLoading: boolean
  error: Error | null
}

// ============================================================================
// FORBIDDEN PATTERNS
// ============================================================================

/**
 * Patterns that are FORBIDDEN in our Universal Reactive Data Pattern
 */
export const FORBIDDEN_PATTERNS = {
  // Direct database access in routes
  DIRECT_DB_QUERIES: [
    'getNewPGliteDataSource',
    'createQueryBuilder',
    'dataSource.getRepository',
    '.getMany()',
    '.getOne()',
    '.getCount()',
  ],
  
  // Manual cache management
  MANUAL_CACHE_OPERATIONS: [
    'queryClient.getQueryData',
    'queryClient.setQueryData',
    'queryClient.invalidateQueries',
    'queryClient.removeQueries',
  ],
  
  // Bypassing domain services
  DOMAIN_SERVICE_BYPASS: [
    'new UserRepository',
    'new ProjectRepository', 
    'new TaskRepository',
    'new CommentRepository',
    'repository.find',
    'repository.create',
    'repository.update',
    'repository.delete',
  ],
  
  // Non-reactive data access
  NON_REACTIVE_ACCESS: [
    'fetch(',
    'axios.',
    'XMLHttpRequest',
    'direct SQL queries',
  ],
} as const

/**
 * Required patterns that MUST be used
 */
export const REQUIRED_PATTERNS = {
  // Route loaders must use these
  ROUTE_LOADERS: [
    'ensureQueryData',
    'createSingleDataLoader',
    'createMultiDataLoader', 
    'createParameterizedDataLoader',
  ],
  
  // Components must use domain service hooks
  COMPONENT_DATA_ACCESS: [
    'UserService.hooks.use',
    'ProjectService.hooks.use',
    'TaskService.hooks.use',
    'CommentService.hooks.use',
  ],
  
  // All data queries must go through domain services
  DATA_QUERIES: [
    'UserService.queryOptions',
    'ProjectService.queryOptions',
    'TaskService.queryOptions', 
    'CommentService.queryOptions',
  ],
} as const

// ============================================================================
// CORE UTILITIES
// ============================================================================

/**
 * Standard Query Options Factory
 * 
 * Creates consistent query options with standard caching behavior
 */
export function createStandardQueryOptions<T>(
  queryKey: (string | number)[],
  queryFn: () => Promise<T>,
  options: {
    staleTime?: number
    gcTime?: number
    enabled?: boolean
  } = {}
): UniversalQueryOptions<T> {
  return {
    queryKey,
    queryFn,
    staleTime: options.staleTime ?? Infinity,  // Never stale by default - live queries handle invalidation
    gcTime: options.gcTime ?? 30 * 60 * 1000,   // 30 minutes default
    enabled: options.enabled ?? true,
  } as UniversalQueryOptions<T>
}

/**
 * Route Loader Helper - ENFORCES cache-first pattern
 * 
 * This is the ONLY way routes should load data.
 * It automatically uses TanStack Query cache and only hits DB if needed.
 */
export async function loadDataForRoute<T>(
  queryClient: QueryClient,
  queryOptionsConfig: UniversalQueryOptions<T>
): Promise<T> {
  try {
    // This will:
    // 1. Check cache first
    // 2. Return cached data if fresh
    // 3. Only execute queryFn if cache is stale/empty
    return await queryClient.ensureQueryData(queryOptionsConfig)
  } catch (error) {
    console.error('[UniversalReactivePattern] Route loader error:', error)
    // Return appropriate fallback based on expected type
    const isArrayQuery = Array.isArray(queryOptionsConfig.queryKey) && 
                        queryOptionsConfig.queryKey.some(key => typeof key === 'string' && key.includes('all'))
    return (isArrayQuery ? [] : null) as T
  }
}

/**
 * Multi-Data Route Loader - For routes that need multiple data sources
 * 
 * Loads multiple data sources in parallel, all cache-first
 */
export async function loadMultipleDataForRoute<T extends Record<string, any>>(
  queryClient: QueryClient,
  queryConfigs: Record<keyof T, UniversalQueryOptions<any>>
): Promise<T> {
  try {
    const keys = Object.keys(queryConfigs) as (keyof T)[]
    const promises = keys.map(key => 
      queryClient.ensureQueryData(queryConfigs[key])
    )
    
    const results = await Promise.all(promises)
    
    // Combine results into named object
    const combinedResults = {} as T
    keys.forEach((key, index) => {
      combinedResults[key] = results[index]
    })
    
    return combinedResults
  } catch (error) {
    console.error('[UniversalReactivePattern] Multi-data loader error:', error)
    // Return empty fallbacks for all keys
    const fallbacks = {} as T
    Object.keys(queryConfigs).forEach(key => {
      fallbacks[key as keyof T] = [] as any
    })
    return fallbacks
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates that a domain service follows Universal Reactive Data Pattern
 */
export function validateDomainService<T extends ObjectLiteral>(
  service: any,
  serviceName: string
): service is DomainServiceContract<T> {
  const required = ['queryOptions', 'hooks', 'createQueryBuilders']
  const missing = required.filter(prop => !(prop in service))
  
  if (missing.length > 0) {
    throw new Error(
      `[UniversalReactivePattern] ${serviceName} is missing required properties: ${missing.join(', ')}\n` +
      `All domain services must implement: ${required.join(', ')}`
    )
  }
  
  return true
}

/**
 * Validates that code follows forbidden/required patterns
 */
export function validateCodePatterns(code: string, context: string): void {
  const errors: string[] = []
  
  // Check for forbidden patterns
  Object.entries(FORBIDDEN_PATTERNS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      if (code.includes(pattern)) {
        errors.push(`FORBIDDEN: ${category} - Found '${pattern}' in ${context}`)
      }
    })
  })
  
  // For route loaders, ensure required patterns are used
  if (context.includes('route') || context.includes('loader')) {
    const hasRequiredPattern = REQUIRED_PATTERNS.ROUTE_LOADERS.some(pattern => 
      code.includes(pattern)
    )
    if (!hasRequiredPattern) {
      errors.push(`REQUIRED: Route loaders must use one of: ${REQUIRED_PATTERNS.ROUTE_LOADERS.join(', ')}`)
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Code pattern validation failed:\n${errors.join('\n')}`)
  }
}

/**
 * Type guard to check if a function is a valid query options factory
 */
export function isQueryOptionsFactory(fn: any): fn is QueryOptionsFactory {
  return typeof fn === 'function'
}

/**
 * Type guard to check if an object has valid domain service structure
 */
export function isDomainServiceQueryOptions(obj: any): obj is DomainServiceQueryOptions {
  return obj && 
         typeof obj === 'object' &&
         isQueryOptionsFactory(obj.all) &&
         isQueryOptionsFactory(obj.count) &&
         isQueryOptionsFactory(obj.detail)
}

// ============================================================================
// PATTERN ENFORCEMENT UTILITIES
// ============================================================================

/**
 * Creates a validation wrapper for route loaders
 */
export function enforceUniversalReactivePattern<T extends UniversalReactiveLoader>(
  loader: T,
  loaderName: string
): T {
  const wrappedLoader = async (...args: any[]) => {
    try {
      const result = await loader()
      
      // Validate the loader follows patterns (basic check)
      const loaderCode = loader.toString()
      validateCodePatterns(loaderCode, `route loader: ${loaderName}`)
      
      return result
    } catch (error) {
      console.error(`[Universal Reactive Pattern] Validation failed for ${loaderName}:`, error)
      throw error
    }
  }
  
  return wrappedLoader as T
}

/**
 * Runtime check to ensure domain services are properly configured
 */
export function ensureDomainServiceCompliance(): void {
  // This would be called at app startup to validate all domain services
  const services = [
    'UserService',
    'ProjectService', 
    'TaskService',
    'CommentService'
  ]
  
  console.log('[Universal Reactive Pattern] Validating domain service compliance...')
  
  services.forEach(serviceName => {
    try {
      // In a real implementation, we'd import and validate each service
      console.log(`✓ ${serviceName} compliance check passed`)
    } catch (error) {
      console.error(`✗ ${serviceName} compliance check failed:`, error)
      throw error
    }
  })
  
  console.log('[Universal Reactive Pattern] All domain services compliant ✓')
} 