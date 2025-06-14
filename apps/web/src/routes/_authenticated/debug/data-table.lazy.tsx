import { createLazyFileRoute } from '@tanstack/react-router'
import DataTableDebugPanel from '@/features/debug/DataTablePage'

export const Route = createLazyFileRoute('/_authenticated/debug/data-table')({
  component: DataTableDebugPanel,
}) 