import React from 'react';
import { SyncDebugInfo } from './components/SyncDebugInfo';
import { Main } from '@/components/layout/main';

export function SyncPage() {
  return (
    <>
      <Main>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className='text-2xl font-bold tracking-tight'>Sync Debug</h1>
        </div>
        <SyncDebugInfo showDetailedStats={true} />
      </Main>
    </>
  );
}

export default SyncPage; 