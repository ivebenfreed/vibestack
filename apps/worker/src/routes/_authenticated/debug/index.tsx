import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authenticated/debug/')({
  component: DebugIndexPage,
})

function DebugIndexPage() {
  const debugPages = [
    {
      title: '🚀 Sync System',
      description: 'Enhanced debug panel for sync architecture. Debug sync-machine-v2, monitor WebSocket connections, and inspect service states.',
      path: '/debug/sync',
      color: 'border-green-500/20 hover:border-green-500/30 bg-green-500/5 dark:border-green-400/20 dark:hover:border-green-400/30 dark:bg-green-400/5',
      badge: 'SYNC DEBUG'
    },
    {
      title: '⚡ Entity Operations',
      description: 'Test all Legend State observable operations for entity CRUD. Debug schema creation, record mutations, and real-time UI updates.',
      path: '/debug/entity-operations',
      color: 'border-violet-500/20 hover:border-violet-500/30 bg-violet-500/5 dark:border-violet-400/20 dark:hover:border-violet-400/30 dark:bg-violet-400/5',
      badge: 'OBSERVABLES'
    },
    {
      title: '🌟 VibeGrid + Legend State',
      description: 'Test VibeGrid table component with Legend State observables instead of atomic store. Direct fromObservable integration.',
      path: '/debug/vibegrid-legend-state',
      color: 'border-cyan-500/20 hover:border-cyan-500/30 bg-cyan-500/5 dark:border-cyan-400/20 dark:hover:border-cyan-400/30 dark:bg-cyan-400/5',
      badge: 'LEGEND STATE'
    },
    {
      title: '🏷️ System Options Test',
      description: 'Test system options API and Legend State hooks. Display priority, status, and category reference data for all entity archetypes.',
      path: '/debug/system-options',
      color: 'border-emerald-500/20 hover:border-emerald-500/30 bg-emerald-500/5 dark:border-emerald-400/20 dark:hover:border-emerald-400/30 dark:bg-emerald-400/5',
      badge: 'SYSTEM OPTIONS'
    }
  ]

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Debug Tools</h1>
        <p className="text-muted-foreground">
          Development and testing utilities for debugging the application
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {debugPages.map((page) => (
          <Card key={page.path} className={`transition-colors ${page.color} relative`}>
            {page.badge && (
              <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ${
                page.badge === 'SYNC DEBUG' 
                  ? 'bg-green-500/10 text-green-700 dark:bg-green-400/10 dark:text-green-300 border border-green-500/20' 
                  : page.badge === 'OBSERVABLES'
                  ? 'bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300 border border-violet-500/20'
                  : page.badge === 'LEGEND STATE'
                  ? 'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300 border border-cyan-500/20'
                  : page.badge === 'SYSTEM OPTIONS'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 border border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}>
                {page.badge}
              </div>
            )}
            <CardHeader className={page.badge ? 'pr-24' : ''}>
              <CardTitle className="text-lg">{page.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {page.description}
              </p>
              <Link to={page.path}>
                <Button variant="outline" className="w-full">
                  {page.badge === 'SYNC DEBUG' ? '🚀 Open Sync Panel' 
                   : page.badge === 'OBSERVABLES' ? '⚡ Open Entity Operations'
                   : page.badge === 'LEGEND STATE' ? '🌟 Open Legend State Test'
                   : page.badge === 'SYSTEM OPTIONS' ? '🏷️ Open System Options Test'
                   : 'Open Tool'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-8 p-6 bg-blue-500/5 border border-blue-500/20 rounded-lg dark:bg-blue-400/5 dark:border-blue-400/20">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🧪 Current Architecture Testing</h3>
        <p className="text-blue-800 dark:text-blue-200 text-sm mb-3">
          Essential debug tools for the production architecture:
        </p>
        <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
          <li>• <strong>Sync System</strong> - WebSocket sync, state transitions, and service testing</li>
          <li>• <strong>Database Operations</strong> - Connection testing and query performance</li>
          <li>• <strong>Data Integrity</strong> - Validation, recovery, and consistency checks</li>
          <li>• <strong>VibeGrid</strong> - Production table with real-time Dexie integration and declarative API</li>
        </ul>
      </div>
    </div>
  )
} 