import { createFileRoute } from '@tanstack/react-router'
import DataTableDebugPanel from '@/features/debug/DataTablePage'
import React from 'react'

export const Route = createFileRoute('/_authenticated/debug/data-table')({
  component: DebugDataTableComponent,
})

function DebugDataTableComponent() {
  return <DataTableDebugPanel />
}