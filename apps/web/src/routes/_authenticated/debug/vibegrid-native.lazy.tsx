import { createLazyFileRoute } from '@tanstack/react-router'
import { VibeGridNativeUsageExample } from '@/components/custom/vibegridnative/examples/VibeGridNativeUsageExample'

export const Route = createLazyFileRoute('/_authenticated/debug/vibegrid-native')({
  component: VibeGridNativeUsageExample,
}) 