import { createLazyFileRoute } from '@tanstack/react-router';
import SyncPage from '@/features/debug/SyncPage';

export const Route = createLazyFileRoute('/_authenticated/debug/sync')({
  component: SyncPage,
}); 