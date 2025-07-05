import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';

export function DebugNavigation() {
  const debugRoutes = [
    { path: '/debug/sync', label: 'Sync' },
    { path: '/debug/sync-test', label: 'Sync Test' },
    { path: '/debug/database', label: 'Database' },
    { path: '/debug/integrity', label: 'Integrity' },
    { path: '/debug/optimistic-test', label: 'Optimistic Updates' },
    { path: '/debug/state-machine-test', label: 'State Machine Test' },
    { path: '/debug/grid-optimus-projects', label: 'VibeGridOptimus Demo' },
    { path: '/debug/reactflow-positioning', label: 'React Flow Positioning' },
  ];
  
  return (
    <Card className="mt-8">
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-2">
          <span className="font-medium mr-2">Debug Pages:</span>
          {debugRoutes.map((route) => (
            <Link
              key={route.path}
              to={route.path}
              className="px-3 py-1 bg-muted rounded-md hover:bg-muted/80 text-sm"
              activeProps={{ className: 'bg-primary text-primary-foreground hover:bg-primary/90' }}
            >
              {route.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 