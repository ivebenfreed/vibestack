import { createFileRoute } from '@tanstack/react-router'
import { LegendStateIntegrationDemo } from '@/features/debug/components/LegendStateIntegrationDemo'

export const Route = createFileRoute('/_authenticated/debug/vibegrid-legend-state')({
  component: LegendStateIntegrationDemo,
})