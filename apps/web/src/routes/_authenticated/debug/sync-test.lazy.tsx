import { createLazyFileRoute } from '@tanstack/react-router';
import { SyncTestingInterface } from '@/sync/testing/components/SyncTestingInterface';

export const Route = createLazyFileRoute('/_authenticated/debug/sync-test')({
  component: SyncTestingInterface,
});