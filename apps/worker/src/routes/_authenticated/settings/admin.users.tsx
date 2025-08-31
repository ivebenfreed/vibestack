import { createFileRoute } from '@tanstack/react-router'
import AdminUserManagement from '@/features/settings/admin/AdminUserManagement'

export const Route = createFileRoute('/_authenticated/settings/admin/users')({
  component: AdminUserManagement,
  beforeLoad: ({ context }) => {
    // Check if user is admin - this will be handled by the component as well
    // but good to have route-level protection
  },
})