import { QueryClient } from '@tanstack/react-query'

interface LiveQuerySubscription {
  unsubscribe: () => Promise<void>
  refCount: number
  queryKey: (string | number)[]
  sql: string
  params: any[]
}

/**
 * Global Live Query Manager
 * 
 * Smart persistent queries: The first component to subscribe to any query 
 * automatically makes it persistent. This creates a self-organizing system
 * where commonly used queries stay active in the background.
 */
class LiveQueryManager {
  private subscriptions = new Map<string, LiveQuerySubscription>()
  private queryClient: QueryClient | null = null

  setQueryClient(client: QueryClient) {
    this.queryClient = client
  }

  /**
   * Initialize persistent live queries for core application data
   * These queries will stay active in the background regardless of component lifecycle
   */
  async initializePersistentQueries(): Promise<void> {
    // No longer needed - queries self-organize based on usage
    console.log('[LiveQueryManager] Using smart auto-persistence - no manual setup needed')
  }

  /**
   * Generate a unique key for a live query based on SQL and parameters
   */
  private generateQueryKey(sql: string, params: any[]): string {
    return `${sql}|${JSON.stringify(params)}`
  }



  /**
   * Subscribe to a live query. If already subscribed, increment reference count.
   * If not subscribed, create new subscription.
   */
  async subscribe(
    queryKey: (string | number)[],
    sql: string, 
    params: any[],
    onUpdate: (data: any[]) => void
  ): Promise<string> {
    if (!this.queryClient) {
      throw new Error('QueryClient not set on LiveQueryManager')
    }

    const subscriptionKey = this.generateQueryKey(sql, params)
    const existing = this.subscriptions.get(subscriptionKey)

    if (existing) {
      // Increment reference count for existing subscription
      existing.refCount++
      console.log(`[LiveQueryManager] Reusing existing subscription: ${subscriptionKey} (refCount: ${existing.refCount})`)
      
      // Don't call onUpdate when reusing - cache is already populated by route loader
      // The subscription will continue to provide live updates automatically
      console.log(`[LiveQueryManager] Skipping cached data callback - route loader already populated cache`)
      
      return subscriptionKey
    }

    // Create new subscription
    console.log(`[LiveQueryManager] Creating new live query subscription: ${subscriptionKey}`)
    
    try {
      const { getDatabase } = await import('@/db/db')
      const db = await getDatabase()
      
      if (!db.live?.query) {
        throw new Error('Live query not available')
      }

      let isInitialResult = true // Track if this is the first callback
      
      const liveQueryResult = await db.live.query(sql, params, (results: any) => {
        console.log(`[LiveQueryManager] Live query update for ${subscriptionKey}:`, results.rows?.length || 0, 'rows')
        
        // Skip the very first callback since cache is already populated by route loader
        if (isInitialResult) {
          isInitialResult = false
          console.log(`[LiveQueryManager] Skipping initial results - cache already populated by route loader`)
          return
        }
        
        // Only call the update callback for subsequent real-time updates
        onUpdate(results.rows || [])
      })

      // Store subscription with reference count
      this.subscriptions.set(subscriptionKey, {
        unsubscribe: liveQueryResult.unsubscribe,
        refCount: 1,
        queryKey,
        sql,
        params
      })

      console.log(`[LiveQueryManager] Successfully created subscription: ${subscriptionKey}`)
      return subscriptionKey

    } catch (error) {
      console.error(`[LiveQueryManager] Failed to create subscription: ${subscriptionKey}`, error)
      throw error
    }
  }

  /**
   * Unsubscribe from a live query. Decrements reference count.
   * 
   * SMART PERSISTENCE: Once a query is created, it stays active forever.
   * This creates a self-organizing system where used queries become persistent.
   */
  async unsubscribe(subscriptionKey: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionKey)
    
    if (!subscription) {
      console.warn(`[LiveQueryManager] Attempted to unsubscribe from non-existent subscription: ${subscriptionKey}`)
      return
    }

    subscription.refCount--
    console.log(`[LiveQueryManager] Decremented refCount for ${subscriptionKey} (refCount: ${subscription.refCount}) - keeping persistent`)

    // Smart persistence: Never actually unsubscribe
    // Once a query is created, it stays active in the background
    // This creates better UX with instant cache hits on subsequent visits
  }

  /**
   * Get current subscription stats for debugging
   */
  getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      subscriptions: Array.from(this.subscriptions.entries()).map(([key, sub]) => ({
        key,
        refCount: sub.refCount,
        queryKey: sub.queryKey,
        sql: sub.sql.substring(0, 100) + (sub.sql.length > 100 ? '...' : '')
      }))
    }
  }

  /**
   * Debug method to log current subscription stats
   */
  logStats() {
    const stats = this.getStats()
    console.log('[LiveQueryManager] Current subscription stats:', stats)
    return stats
  }

  /**
   * Force cleanup all subscriptions (for debugging/testing)
   */
  async cleanup(): Promise<void> {
    console.log(`[LiveQueryManager] Cleaning up ${this.subscriptions.size} subscriptions`)
    
    const cleanupPromises = Array.from(this.subscriptions.values()).map(sub => 
      sub.unsubscribe().catch(console.error)
    )
    
    await Promise.all(cleanupPromises)
    this.subscriptions.clear()
    
    console.log('[LiveQueryManager] Cleanup complete')
  }
}

// Global singleton instance
export const liveQueryManager = new LiveQueryManager()

// Debug helper
if (typeof window !== 'undefined') {
  (window as any).liveQueryManager = liveQueryManager
  // Add convenient debug methods
  ;(window as any).debugLiveQueries = () => liveQueryManager.logStats()
  ;(window as any).cleanupLiveQueries = () => liveQueryManager.cleanup()
} 