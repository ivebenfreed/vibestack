import { createLazyFileRoute } from '@tanstack/react-router';
import { LiveQueryPerformanceComparison } from '../../../features/debug/components/LiveQueryPerformanceComparison';

export const Route = createLazyFileRoute('/_authenticated/debug/performance')({
  component: LiveQueryPerformanceComparison,
}); 