import { createFileRoute } from '@tanstack/react-router'
import { LegendTableDebug } from '@/features/debug/components/LegendTableDebug'

export const Route = createFileRoute('/_authenticated/debug/legend-table')({
  component: LegendTableDebug,
})