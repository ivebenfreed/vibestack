import { createLazyFileRoute } from '@tanstack/react-router';
import { TypeORMTest } from '../../../features/debug/components/typeorm-test';

function TypeORMTestPage() {
  return (
    <div className="p-6">
      <div className="mb-2 flex items-center justify-between space-y-2">
        <h1 className='text-2xl font-bold tracking-tight'>TypeORM Test Debug</h1>
      </div>
      <TypeORMTest />
    </div>
  );
}

export const Route = createLazyFileRoute('/_authenticated/debug/typeorm-test')({
  component: TypeORMTestPage,
}); 