import { createLazyFileRoute } from '@tanstack/react-router';
import LiveQueryDebugPage from '../../../features/debug/LiveQueryDebugPage';

export const Route = createLazyFileRoute('/_authenticated/debug/live-query')({
  component: LiveQueryDebugPage,
}); 