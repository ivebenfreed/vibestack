import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ObjectLiteral } from 'typeorm'
import { createStandardQueryOptions, DomainServiceContract, UniversalQueryOptions } from './universal-reactive-pattern'
import { createLiveQueryCallback } from './transformers'
import { liveQueryManager } from '../../lib/live-query-manager'

/**
 * Domain Service Template - Enforces Universal Reactive Data Pattern
 * 
 * This template ensures all domain services follow the same pattern:
 * 1. queryOptions for TanStack Query integration
 * 2. hooks for reactive components
 * 3. createQueryBuilders for live queries
 */

/**
 * Create Query Options Helper
 * 
 * Standardizes query options creation across all domain services
 */
export function createDomainQueryOptions<T>(
  entityName: string,
  getDataSource: () => Promise<any>,
  createQueryBuilders: (createQueryBuilder: any) => Record<string, any>
) {
  return {
    all: (): UniversalQueryOptions<T[]> => createStandardQueryOptions(
      [entityName, 'all'],
      async () => {
        const dataSource = await getDataSource()
        if (!dataSource.isInitialized) {
          return []
        }
        return createQueryBuilders(dataSource.createQueryBuilder.bind(dataSource)).all().getMany()
      }
    ),

    detail: (id: string): UniversalQueryOptions<T | null> => createStandardQueryOptions(
      [entityName, 'detail', id],
      async () => {
        const dataSource = await getDataSource()
        if (!dataSource.isInitialized || !id) {
          return null
        }
        return createQueryBuilders(dataSource.createQueryBuilder.bind(dataSource)).detail(id).getOne()
      },
      { enabled: !!id }
    ),

    byField: (fieldName: string, value: string): UniversalQueryOptions<T[]> => createStandardQueryOptions(
      [entityName, fieldName, value],
      async () => {
        const dataSource = await getDataSource()
        if (!dataSource.isInitialized || !value) {
          return []
        }
        const builders = createQueryBuilders(dataSource.createQueryBuilder.bind(dataSource))
        if (!builders[`by${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`]) {
          throw new Error(`Query builder for ${fieldName} not found`)
        }
        return builders[`by${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`](value).getMany()
      },
      { enabled: !!value }
    )
  }
}

/**
 * Create Live Query Hook Helper
 * 
 * Standardizes live query hook creation across all domain services
 */
export function createLiveQueryHook<T extends ObjectLiteral>(
  entityName: string,
  queryKey: string[],
  createQueryBuilders: (createQueryBuilder: any) => Record<string, any>,
  queryBuilderMethod: string,
  usePGliteContext: () => any,
  isArray: boolean = true
) {
  return () => {
    const { createQueryBuilder, isDataSourceReady } = usePGliteContext()
    const queryClient = useQueryClient()
    const subscriptionKeyRef = useRef<string | null>(null)

    // Set up live query using global manager
    useEffect(() => {
      if (!isDataSourceReady || !createQueryBuilder) return
      
      const setupLiveQuery = async () => {
        try {
          const queryBuilder = createQueryBuilders(createQueryBuilder)[queryBuilderMethod]()
          const [sql, params] = queryBuilder.getQueryAndParameters()
          
          // Subscribe via global manager (handles deduplication)
          const subscriptionKey = await liveQueryManager.subscribe(
            queryKey,
            sql,
            params,
            createLiveQueryCallback<T>(entityName, queryKey, queryClient, isArray)
          )
          
          subscriptionKeyRef.current = subscriptionKey
        } catch (error) {
          console.error(`[${entityName}Service] Live query setup failed:`, error)
        }
      }

      setupLiveQuery()

      return () => {
        if (subscriptionKeyRef.current) {
          liveQueryManager.unsubscribe(subscriptionKeyRef.current)
          subscriptionKeyRef.current = null
        }
      }
    }, [isDataSourceReady, createQueryBuilder, queryClient])

    // Return the TanStack Query result
    return queryClient.getQueryData(queryKey) || (isArray ? [] : null)
  }
}

/**
 * Simplified Domain Service Contract for easier implementation
 */
export interface SimplifiedDomainServiceContract<T extends ObjectLiteral> {
  queryOptions: {
    all: () => UniversalQueryOptions<T[]>
    detail: (id: string) => UniversalQueryOptions<T | null>
    [key: string]: (...args: any[]) => UniversalQueryOptions<any>
  }
  hooks: Record<string, (...args: any[]) => any>
  createQueryBuilders: (createQueryBuilder: any) => Record<string, any>
}

/**
 * Domain Service Factory
 * 
 * Creates a complete domain service that follows the Universal Reactive Data Pattern
 */
export function createDomainService<T extends ObjectLiteral>(config: {
  entityName: string
  getDataSource: () => Promise<any>
  createQueryBuilders: (createQueryBuilder: any) => Record<string, any>
  usePGliteContext: () => any
}): SimplifiedDomainServiceContract<T> {
  const { entityName, getDataSource, createQueryBuilders, usePGliteContext } = config

  // Create standardized query options
  const queryOptions = createDomainQueryOptions<T>(entityName, getDataSource, createQueryBuilders)

  // Create standardized hooks
  const hooks = {
    [`useAll${entityName.charAt(0).toUpperCase() + entityName.slice(1)}s`]: createLiveQueryHook<T>(
      entityName,
      [entityName, 'all'],
      createQueryBuilders,
      'all',
      usePGliteContext,
      true
    ),

    [`use${entityName.charAt(0).toUpperCase() + entityName.slice(1)}Detail`]: (id: string) => 
      createLiveQueryHook<T>(
        entityName,
        [entityName, 'detail', id],
        createQueryBuilders,
        'detail',
        usePGliteContext,
        false
      )
  }

  return {
    queryOptions,
    hooks,
    createQueryBuilders
  }
}

/**
 * Validation Helper
 * 
 * Ensures domain services are properly structured
 */
export function validateDomainServiceStructure<T extends ObjectLiteral>(
  service: any,
  entityName: string
): asserts service is SimplifiedDomainServiceContract<T> {
  const required = ['queryOptions', 'hooks', 'createQueryBuilders']
  const missing = required.filter(prop => !(prop in service))
  
  if (missing.length > 0) {
    throw new Error(
      `[UniversalReactivePattern] ${entityName}Service is missing: ${missing.join(', ')}\n` +
      `All domain services must implement the DomainServiceContract interface.`
    )
  }

  // Validate queryOptions structure
  if (!service.queryOptions.all || typeof service.queryOptions.all !== 'function') {
    throw new Error(`[UniversalReactivePattern] ${entityName}Service.queryOptions.all must be a function`)
  }

  // Validate hooks structure
  if (!service.hooks || typeof service.hooks !== 'object') {
    throw new Error(`[UniversalReactivePattern] ${entityName}Service.hooks must be an object`)
  }

  console.log(`✅ [UniversalReactivePattern] ${entityName}Service validation passed`)
} 