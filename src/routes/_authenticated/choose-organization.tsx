import { createFileRoute } from '@tanstack/react-router'
import { OrganizationSelectionScreen } from '@/components/organization-selection-screen'

export const Route = createFileRoute('/_authenticated/choose-organization')({
  component: OrganizationSelectionScreen,
})