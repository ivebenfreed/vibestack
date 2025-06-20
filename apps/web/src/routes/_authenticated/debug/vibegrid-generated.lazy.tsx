import { createLazyFileRoute } from '@tanstack/react-router'
import { VibeGridGeneratedExample } from '@/components/custom/vibegrid/examples/VibeGridGeneratedExample'

export const Route = createLazyFileRoute('/_authenticated/debug/vibegrid-generated')({
  component: VibeGridGeneratedExample,
}) 