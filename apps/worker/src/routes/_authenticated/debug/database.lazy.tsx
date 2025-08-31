import { createLazyFileRoute } from '@tanstack/react-router';
import DatabasePage from '@/features/debug/DatabasePage';

export const Route = createLazyFileRoute('/_authenticated/debug/database')({
  component: DatabasePage,
}); 