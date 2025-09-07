import { createFileRoute } from '@tanstack/react-router'
import FileImportSettings from '@/features/settings/import'

export const Route = createFileRoute('/_authenticated/settings/import')({
  component: FileImportSettings,
})