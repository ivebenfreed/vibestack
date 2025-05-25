import React from 'react';
import { DbDebugPanel } from './components/DbDebugPanel';
import { Main } from '@/components/layout/main';

export function DbDebugPage() {
  return (
    <>
      <Main>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className='text-2xl font-bold tracking-tight'>Database Debug</h1>
        </div>
        <DbDebugPanel />
      </Main>
    </>
  );
}

export default DbDebugPage; 