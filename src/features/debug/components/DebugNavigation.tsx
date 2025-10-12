import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';

export function DebugNavigation() {
  const debugRoutes = [
    { path: '/debug/sync', label: 'Sync' },
    { path: '/debug/integrity', label: 'Integrity' },
    { path: '/debug/query-test', label: 'Query Test' },
    { path: '/debug/vibegantt', label: 'VibeGantt' },
    { path: '/debug/gantt-test-data', label: 'Gantt Test Data' },
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