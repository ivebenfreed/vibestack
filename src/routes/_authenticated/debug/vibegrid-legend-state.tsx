import { createFileRoute } from '@tanstack/react-router'
import { VibeGridLegendStateExample } from '@/features/debug/components/VibeGridLegendStateExample'

export const Route = createFileRoute('/_authenticated/debug/vibegrid-legend-state')({
  component: VibeGridLegendStateExample,
})