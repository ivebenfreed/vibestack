import { createLazyFileRoute } from '@tanstack/react-router';
import { MultiQueryPerformanceTest } from '../../../features/debug/components/MultiQueryPerformanceTest';

function MultiQueryDebugPage() {
  return (
    <div className="p-6">
      <div className="mb-2 flex items-center justify-between space-y-2">
        <h1 className='text-2xl font-bold tracking-tight'>Multi-Query Performance Test</h1>
      </div>
      <MultiQueryPerformanceTest />
    </div>
  );
}

export const Route = createLazyFileRoute('/_authenticated/debug/multi-query')({
  component: MultiQueryDebugPage,
}); 