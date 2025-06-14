import { createLazyFileRoute } from '@tanstack/react-router'
import IntegrityDebugPage from '@/features/debug/integrity-debug'

export const Route = createLazyFileRoute('/_authenticated/debug/integrity')({
  component: IntegrityDebugPage,
}) 