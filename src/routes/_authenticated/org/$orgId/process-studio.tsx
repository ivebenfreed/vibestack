import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import React from 'react';

// Lazy load Process Studio
const ProcessStudio = React.lazy(() => import('@/features/process-studio'));

const processStudioRouteSchema = z.object({
  orgId: z.string()
});

export const Route = createFileRoute('/_authenticated/org/$orgId/process-studio')({
  params: {
    parse: (params) => processStudioRouteSchema.parse(params),
    stringify: ({ orgId }) => ({ orgId })
  },
  component: ProcessStudioPage,
});

function ProcessStudioPage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Process Studio...</p>
        </div>
      </div>
    }>
      <ProcessStudio />
    </React.Suspense>
  );
}
