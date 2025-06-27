import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authenticated/debug/')({
  component: DebugIndexPage,
})

function DebugIndexPage() {
  const debugPages = [
    {
      title: '🚀 Sync System & Testing',
      description: 'Complete sync debug panel with testing capabilities. Debug sync-machine-v2, test WebSocket connections, and validate sync functionality with real-time monitoring.',
      path: '/debug/sync',
      color: 'border-green-200 hover:border-green-300 bg-green-50',
      badge: 'SYNC & TEST'
    },
    {
      title: 'Database Tests',
      description: 'Database connection and operation testing',
      path: '/debug/database',
      color: 'border-blue-200 hover:border-blue-300'
    },
    {
      title: 'Integrity Management',
      description: 'Test integrity validation, resets, and sync recovery',
      path: '/debug/integrity',
      color: 'border-red-200 hover:border-red-300'
    },
    {
      title: '🧩 VibeGridFinal Tasks',
      description: 'Production VibeGridFinal implementation with DirectUsagePattern architecture. High-performance 45ms cell rendering with XState integration.',
      path: '/debug/vibegridfinal-tasks',
      color: 'border-indigo-200 hover:border-indigo-300 bg-indigo-50',
      badge: 'TABLE SYSTEM'
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
          <h3 className="font-semibold text-green-900">🧹 Debug Environment Cleaned!</h3>
          <p className="text-green-800 text-sm mt-1">
            Essential debug tools only. All legacy patterns removed, focusing on current architecture: 
            <strong>XState Atoms + VibeGridFinal + 3-Layer Architecture</strong>.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {debugPages.map((page) => (
          <Card key={page.path} className={`transition-colors ${page.color} relative`}>
            {page.badge && (
              <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ${
                page.badge === 'SYNC & TEST' 
                  ? 'bg-green-100 text-green-800' 
                  : page.badge === 'TABLE SYSTEM'
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
                  {page.badge === 'SYNC & TEST' ? '🚀 Open Sync Panel' 
                   : page.badge === 'TABLE SYSTEM' ? '🧩 Open Table Demo'
                   : 'Open Tool'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">🧪 Current Architecture Testing</h3>
        <p className="text-blue-800 text-sm mb-3">
          Essential debug tools for the production architecture:
        </p>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• <strong>Sync System</strong> - WebSocket sync, state transitions, and service testing</li>
          <li>• <strong>Database Operations</strong> - Connection testing and query performance</li>
          <li>• <strong>Data Integrity</strong> - Validation, recovery, and consistency checks</li>
          <li>• <strong>VibeGridFinal</strong> - Table performance and DirectUsagePattern validation</li>
        </ul>
      </div>
    </div>
  )
} 