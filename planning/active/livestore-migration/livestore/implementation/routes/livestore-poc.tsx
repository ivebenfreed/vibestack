import { createFileRoute } from '@tanstack/react-router';
import { LiveStorePOC } from '@/components/debug/LiveStorePOC';

export const Route = createFileRoute('/_authenticated/debug/livestore-poc')({
  component: LiveStorePOCPage,
});

function LiveStorePOCPage() {
  return <LiveStorePOC />;
}