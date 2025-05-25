import { createFileRoute } from '@tanstack/react-router';
import { LiveQueryPerformanceComparison } from '../../../features/debug/components/LiveQueryPerformanceComparison';

export const Route = createFileRoute('/_authenticated/debug/performance')({
  component: LiveQueryPerformanceComparison,
}); 