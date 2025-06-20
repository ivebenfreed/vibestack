import { createLazyFileRoute } from '@tanstack/react-router'
import { VibeGridCellRegistryExample } from '@/components/custom/vibegrid/examples/VibeGridCellRegistryExample'

export const Route = createLazyFileRoute('/_authenticated/debug/vibegrid-registry')({
  component: VibeGridCellRegistryExample,
}) 