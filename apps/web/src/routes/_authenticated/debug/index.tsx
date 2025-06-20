import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authenticated/debug/')({
  component: DebugIndexPage,
})

function DebugIndexPage() {
  const debugPages = [
    {
      title: '🚀 Sync Machine V2',
      description: 'NEW: Enhanced debug panel for the pure services sync architecture. Test sync-machine-v2 with WebSocketService, IncomingChangeService, and OutgoingChangeService.',
      path: '/debug/sync',
      color: 'border-green-200 hover:border-green-300 bg-green-50',
      badge: 'NEW ARCHITECTURE'
    },
    {
      title: 'Integrity Management',
      description: 'Test integrity validation, resets, and sync recovery',
      path: '/debug/integrity',
      color: 'border-red-200 hover:border-red-300'
    },
    {
      title: 'Database Tests',
      description: 'Database connection and operation testing',
      path: '/debug/database',
      color: 'border-blue-200 hover:border-blue-300'
    },
    {
      title: 'Legacy Sync Testing',
      description: 'Legacy manual sync testing and debugging (old SyncManager)',
      path: '/debug/sync-test',
      color: 'border-gray-200 hover:border-gray-300 opacity-75',
      badge: 'LEGACY'
    },
    {
      title: 'Sync Changes Monitor',
      description: 'Monitor sync changes in real-time',
      path: '/debug/sync-changes',
      color: 'border-yellow-200 hover:border-yellow-300'
    },
    {
      title: 'Live Query Tests',
      description: 'Test live query functionality',
      path: '/debug/live-query',
      color: 'border-purple-200 hover:border-purple-300'
    },
    {
      title: 'Performance Tests',
      description: 'Performance and load testing tools',
      path: '/debug/performance',
      color: 'border-orange-200 hover:border-orange-300'
    },
    {
      title: 'Data Table Tests',
      description: 'Data table component testing',
      path: '/debug/data-table',
      color: 'border-gray-200 hover:border-gray-300'
    },
    {
      title: '🔥 VibeGrid Native (Clean Break)',
      description: 'NEWEST: Pure TanStack Table implementation with native meta property configuration. Zero XState complexity, instant performance, ~150 lines vs 950+ old lines.',
      path: '/debug/vibegrid-native',
      color: 'border-emerald-200 hover:border-emerald-300 bg-emerald-50',
      badge: 'CLEAN BREAK'
    },
    {
      title: '🔥 VibeGrid Generated (Fully Generated)',
      description: 'NEWEST: Fully generated columns using TaskColumns from generated config. Universal cell renderer with all metadata, business logic, and relationships automatically included.',
      path: '/debug/vibegrid-generated',
      color: 'border-red-200 hover:border-red-300 bg-red-50',
      badge: 'FULLY GENERATED'
    },
    {
      title: '🔥 VibeGrid Registry (Scalable)',
      description: 'SCALABLE: Uses existing native cell components with registry pattern. Supports 20+ cell types with component isolation and tree shaking. No universal renderer complexity.',
      path: '/debug/vibegrid-registry',
      color: 'border-purple-200 hover:border-purple-300 bg-purple-50',
      badge: 'SCALABLE REGISTRY'
    },
    {
      title: '🎯 VibeGrid Tasks Example',
      description: 'Complete VibeGrid architecture demonstration with Tasks entity. Shows Domain Store → XState Machine → TanStack Table → React Aria UI integration.',
      path: '/debug/vibegrid-tasks',
      color: 'border-purple-200 hover:border-purple-300 bg-purple-50',
      badge: 'LEGACY ARCHITECTURE'
    },
    {
      title: '🧩 VibeGridFinal Tasks (Modular)',
      description: 'MODULAR: Demonstrates the new modularized VibeGridFinal architecture. Clean separation of concerns with preserved 42.54ms performance and 100% feature parity.',
      path: '/debug/vibegridfinal-tasks',
      color: 'border-indigo-200 hover:border-indigo-300 bg-indigo-50',
      badge: 'MODULAR ARCHITECTURE'
    }
  ]

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Debug Tools</h1>
        <p className="text-muted-foreground">
          Development and testing utilities for debugging the application
        </p>
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-900">🎉 Sync Architecture Refactor Complete!</h3>
          <p className="text-green-800 text-sm mt-1">
            The sync system has been migrated to a new pure services architecture. 
            Check out the <strong>Sync Machine V2</strong> debug panel below for comprehensive testing.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {debugPages.map((page) => (
          <Card key={page.path} className={`transition-colors ${page.color} relative`}>
            {page.badge && (
              <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ${
                page.badge === 'CLEAN BREAK' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : page.badge === 'NEW ARCHITECTURE' 
                  ? 'bg-green-100 text-green-800' 
                  : page.badge === 'FULLY GENERATED'
                  ? 'bg-red-100 text-red-800'
                  : page.badge === 'SCALABLE REGISTRY'
                  ? 'bg-purple-100 text-purple-800'
                  : page.badge === 'LEGACY ARCHITECTURE'
                  ? 'bg-orange-100 text-orange-800'
                  : page.badge === 'MODULAR ARCHITECTURE'
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-gray-100 text-gray-600'
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
                  {page.badge === 'CLEAN BREAK' ? '🔥 Open Native Implementation' 
                   : page.badge === 'NEW ARCHITECTURE' ? '🚀 Open New Debug Panel' 
                   : page.badge === 'FULLY GENERATED' ? '🔥 Open Generated Implementation'
                   : page.badge === 'SCALABLE REGISTRY' ? '🔥 Open Registry Implementation'
                   : page.badge === 'MODULAR ARCHITECTURE' ? '🧩 Open Modular Implementation'
                   : 'Open Tool'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">🧪 Testing the New Architecture</h3>
        <p className="text-blue-800 text-sm mb-3">
          The new Sync Machine V2 provides comprehensive testing capabilities for the refactored sync system:
        </p>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• <strong>Real-time state monitoring</strong> - Watch sync phases, progress, and machine states</li>
          <li>• <strong>Connection testing</strong> - Simulate offline/online scenarios</li>
          <li>• <strong>Service inspection</strong> - Test pure services (WebSocket, IncomingChange, OutgoingChange)</li>
          <li>• <strong>Event flow visualization</strong> - See how callbacks replace the old 88-event system</li>
          <li>• <strong>Phase transition testing</strong> - Test initial, catchup, and live sync phases</li>
        </ul>
      </div>
    </div>
  )
} 