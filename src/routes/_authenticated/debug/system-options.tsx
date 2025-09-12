import { createFileRoute } from '@tanstack/react-router'
import { SystemOptionsTest } from '@/components/debug/SystemOptionsTest'

export const Route = createFileRoute('/_authenticated/debug/system-options')({
  component: SystemOptionsTest,
})