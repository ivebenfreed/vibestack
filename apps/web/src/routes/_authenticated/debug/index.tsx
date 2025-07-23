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
      title: '🧪 Sync Test',
      description: 'Comprehensive sync functionality testing framework. CRUD operations, offline sync, batch operations, and relationship testing.',
      path: '/debug/sync-test',
      color: 'border-emerald-500/20 hover:border-emerald-500/30 bg-emerald-500/5 dark:border-emerald-400/20 dark:hover:border-emerald-400/30 dark:bg-emerald-400/5',
      badge: 'SYNC TEST'
    },
    {
      title: 'Database Tests',
      description: 'Database connection and operation testing',
      path: '/debug/database',
      color: 'border-blue-500/20 hover:border-blue-500/30 bg-blue-500/5 dark:border-blue-400/20 dark:hover:border-blue-400/30 dark:bg-blue-400/5'
    },
    {
      title: 'Integrity Management',
      description: 'Test integrity validation, resets, and sync recovery',
      path: '/debug/integrity',
      color: 'border-red-500/20 hover:border-red-500/30 bg-red-500/5 dark:border-red-400/20 dark:hover:border-red-400/30 dark:bg-red-400/5'
    },
    {
      title: '🔧 State Machine Test',
      description: 'Test XState machine for grid cell optimistic updates. Eliminates editor flash issues with predictable state transitions.',
      path: '/debug/state-machine-test',
      color: 'border-purple-500/20 hover:border-purple-500/30 bg-purple-500/5 dark:border-purple-400/20 dark:hover:border-purple-400/30 dark:bg-purple-400/5',
      badge: 'STATE MACHINE'
    },
    {
      title: '⚡ VibeGridOptimus Demo',
      description: 'Production-ready declarative data grid with enhanced batch operations. Test all entities, themes, and editor types with intelligent batching.',
      path: '/debug/grid-optimus-projects',
      color: 'border-violet-500/20 hover:border-violet-500/30 bg-violet-500/5 dark:border-violet-400/20 dark:hover:border-violet-400/30 dark:bg-violet-400/5',
      badge: 'PRODUCTION GRID'
    },
    {
      title: '🎛️ Grid Machine Test',
      description: 'Test comprehensive XState grid machine with cell actors, optimistic updates, sorting, filtering, selection, and local persistence.',
      path: '/debug/grid-machine-test',
      color: 'border-orange-500/20 hover:border-orange-500/30 bg-orange-500/5 dark:border-orange-400/20 dark:hover:border-orange-400/30 dark:bg-orange-400/5',
      badge: 'GRID MACHINE'
    },
    {
      title: '🚀 VibeGridX POC Demo',
      description: 'Complete POC demonstration of VibeGridX architecture with XState v5 machines, hybrid rendering, entity integration, and canvas overlays.',
      path: '/debug/vibegridx-demo',
      color: 'border-indigo-500/20 hover:border-indigo-500/30 bg-indigo-500/5 dark:border-indigo-400/20 dark:hover:border-indigo-400/30 dark:bg-indigo-400/5',
      badge: 'VIBEGRIDX POC'
    },
    {
      title: '🏗️ VibeGridX Architecture',
      description: 'Interactive architecture demonstration showing XState v5 coordination, hybrid rendering, virtual scrolling, and complete implementation status.',
      path: '/debug/vibegridx-architecture-demo',
      color: 'border-cyan-500/20 hover:border-cyan-500/30 bg-cyan-500/5 dark:border-cyan-400/20 dark:hover:border-cyan-400/30 dark:bg-cyan-400/5',
      badge: 'ARCHITECTURE'
    },
    {
      title: '🔍 Status Test',
      description: 'Test StatusDefinition queries and task status updates to debug foreign key constraint issues in the relationship system.',
      path: '/debug/status-test',
      color: 'border-yellow-500/20 hover:border-yellow-500/30 bg-yellow-500/5 dark:border-yellow-400/20 dark:hover:border-yellow-400/30 dark:bg-yellow-400/5',
      badge: 'STATUS DEBUG'
    },
    {
      title: '🗄️ TanStack DB POC',
      description: 'Proof of concept testing TanStack DB with Dexie.js persistence. Compare performance with PGLite and test reactive queries.',
      path: '/debug/tanstack-db-poc',
      color: 'border-pink-500/20 hover:border-pink-500/30 bg-pink-500/5 dark:border-pink-400/20 dark:hover:border-pink-400/30 dark:bg-pink-400/5',
      badge: 'TANSTACK DB'
    },
    {
      title: '💾 Dexie POC',
      description: 'Test Dexie implementation with live queries, reactive hooks, and sync integration. Validate TypeORM entity compatibility and performance.',
      path: '/debug/dexie-poc',
      color: 'border-teal-500/20 hover:border-teal-500/30 bg-teal-500/5 dark:border-teal-400/20 dark:hover:border-teal-400/30 dark:bg-teal-400/5',
      badge: 'DEXIE POC'
    },
    {
      title: '🔥 VibeGridDex Test',
      description: 'Test VibeGridDex component with Dexie live queries. Compare performance vs VibeGridX atomic stores and test real-time reactivity.',
      path: '/debug/vibegriddex-test',
      color: 'border-amber-500/20 hover:border-amber-500/30 bg-amber-500/5 dark:border-amber-400/20 dark:hover:border-amber-400/30 dark:bg-amber-400/5',
      badge: 'VIBEGRIDDEX'
    },
    {
      title: '📊 VibeGantt Debug',
      description: 'Test VibeGantt timeline component for project scheduling. Interactive Gantt charts with task dependencies, resource allocation, and real-time updates.',
      path: '/debug/vibegantt',
      color: 'border-rose-500/20 hover:border-rose-500/30 bg-rose-500/5 dark:border-rose-400/20 dark:hover:border-rose-400/30 dark:bg-rose-400/5',
      badge: 'VIBEGANTT'
    }
  ]

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Debug Tools</h1>
        <p className="text-muted-foreground">
          Development and testing utilities for debugging the application
        </p>
        <div className="mt-4 p-4 bg-green-500/5 border border-green-500/20 rounded-lg dark:bg-green-400/5 dark:border-green-400/20">
          <h3 className="font-semibold text-green-900 dark:text-green-100">🧹 Debug Environment Cleaned!</h3>
          <p className="text-green-800 dark:text-green-200 text-sm mt-1">
            Essential debug tools only. All legacy patterns removed, focusing on current architecture: 
            <strong>XState Atoms + VibeGridOptimus + 3-Layer Architecture</strong>.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {debugPages.map((page) => (
          <Card key={page.path} className={`transition-colors ${page.color} relative`}>
            {page.badge && (
              <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ${
                page.badge === 'SYNC DEBUG' 
                  ? 'bg-green-500/10 text-green-700 dark:bg-green-400/10 dark:text-green-300 border border-green-500/20' 
                  : page.badge === 'SYNC TEST'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 border border-emerald-500/20'
                  : page.badge === 'PRODUCTION GRID'
                  ? 'bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300 border border-violet-500/20'
                  : page.badge === 'GRID MACHINE'
                  ? 'bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300 border border-orange-500/20'
                  : page.badge === 'VIBEGRIDX POC'
                  ? 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300 border border-indigo-500/20'
                  : page.badge === 'ARCHITECTURE'
                  ? 'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300 border border-cyan-500/20'
                  : page.badge === 'STATUS DEBUG'
                  ? 'bg-yellow-500/10 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-300 border border-yellow-500/20'
                  : page.badge === 'DEXIE POC'
                  ? 'bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 border border-teal-500/20'
                  : page.badge === 'VIBEGRIDDEX'
                  ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300 border border-amber-500/20'
                  : page.badge === 'VIBEGANTT'
                  ? 'bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300 border border-rose-500/20'
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
                   : page.badge === 'SYNC TEST' ? '🧪 Open Test Framework'
                   : page.badge === 'PRODUCTION GRID' ? '⚡ Open Grid Demo'
                   : page.badge === 'GRID MACHINE' ? '🎛️ Open Grid Machine'
                   : page.badge === 'VIBEGRIDX POC' ? '🚀 Open POC Demo'
                   : page.badge === 'ARCHITECTURE' ? '🏗️ Open Architecture Demo'
                   : page.badge === 'STATUS DEBUG' ? '🔍 Open Status Test'
                   : page.badge === 'TANSTACK DB' ? '🗄️ Open POC'
                   : page.badge === 'DEXIE POC' ? '💾 Open Dexie POC'
                   : page.badge === 'VIBEGRIDDEX' ? '🔥 Open VibeGridDex Test'
                   : page.badge === 'VIBEGANTT' ? '📊 Open VibeGantt Debug'
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
          <li>• <strong>VibeGridOptimus</strong> - Production table with enhanced batch operations and declarative API</li>
        </ul>
      </div>
    </div>
  )
} 