import { createLazyFileRoute } from '@tanstack/react-router';
import { SyncTestPage } from '@/features/debug/SyncTestPage';

export const Route = createLazyFileRoute('/_authenticated/debug/sync-test')({
  component: SyncTestPage,
}); 