import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { TypeORMTest } from '../../../features/debug/components/typeorm-test';

function TypeORMTestPage() {
  return (
    <>
      <Header fixed />
      <Main>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className='text-2xl font-bold tracking-tight'>TypeORM Test Debug</h1>
        </div>
        <TypeORMTest />
      </Main>
    </>
  );
}

export const Route = createFileRoute('/_authenticated/debug/typeorm-test')({
  component: TypeORMTestPage,
});

export default TypeORMTestPage;