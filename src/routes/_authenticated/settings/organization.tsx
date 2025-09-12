import { createFileRoute } from '@tanstack/react-router'
import { OrganizationForm } from '@/features/settings/organization'

export const Route = createFileRoute('/_authenticated/settings/organization')({
  component: OrganizationForm,
})