import { createFileRoute } from '@tanstack/react-router';
import { TanStackDBTestHarness } from '@/experiments/tanstack-db-poc/TestHarness';
import { TanStackDBTestHarnessSimple } from '@/experiments/tanstack-db-poc/TestHarnessSimple';
import { SimpleTest } from '@/experiments/tanstack-db-poc/SimpleTest';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/debug/tanstack-db-poc')({
  component: TanStackDBPOC,
});

function TanStackDBPOC() {
  const [view, setView] = useState<'simple' | 'full' | 'live'>('simple');

  return (
    <div className="container mx-auto py-8 space-y-4">
      <div className="flex gap-2">
        <Button 
          variant={view === 'simple' ? 'default' : 'outline'}
          onClick={() => setView('simple')}
        >
          Simple Test
        </Button>
        <Button 
          variant={view === 'full' ? 'default' : 'outline'}
          onClick={() => setView('full')}
        >
          Full Test (No Live Query)
        </Button>
        <Button 
          variant={view === 'live' ? 'default' : 'outline'}
          onClick={() => setView('live')}
        >
          Live Query Test
        </Button>
      </div>
      
      {view === 'simple' && <SimpleTest />}
      {view === 'full' && <TanStackDBTestHarnessSimple />}
      {view === 'live' && <TanStackDBTestHarness />}
    </div>
  );
}