import { createLazyFileRoute } from '@tanstack/react-router';
import { SyncChangesPage } from '@/features/debug/SyncChangesPage';

export const Route = createLazyFileRoute('/_authenticated/debug/sync-changes')({
  component: SyncChangesPage,
}); 