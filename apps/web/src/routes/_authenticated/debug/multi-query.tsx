import { createFileRoute } from '@tanstack/react-router';
import { MultiQueryPerformanceTest } from '../../../features/debug/components/MultiQueryPerformanceTest';
import { Main } from '../../../components/layout/main';

function MultiQueryDebugPage() {
  return (
    <Main>
      <MultiQueryPerformanceTest />
    </Main>
  );
}

export const Route = createFileRoute('/_authenticated/debug/multi-query')({
  component: MultiQueryDebugPage,
}); 