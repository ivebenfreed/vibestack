import { Separator } from '@/components/ui/separator'
import { ContentContainer } from '@/components/layout/content-container'
import SidebarNav from './components/sidebar-nav'
import { User, Settings as SettingsIcon, Palette, Bell, Building2, Users, CreditCard } from 'lucide-react'
import { useAuth } from '@/lib/auth-compatibility'
import { Outlet } from '@tanstack/react-router'

const sidebarNavItems = [
  {
    title: 'Profile',
    href: '/settings',
    icon: <User className="w-4 h-4" />,
  },
  {
    title: 'Account', 
    href: '/settings/account',
    icon: <SettingsIcon className="w-4 h-4" />,
  },
  {
    title: 'Appearance',
    href: '/settings/appearance',
    icon: <Palette className="w-4 h-4" />,
  },
  {
    title: 'Notifications',
    href: '/settings/notifications',
    icon: <Bell className="w-4 h-4" />,
  },
]

export default function Settings() {
  const { user, currentOrganization, effectiveUserRole } = useAuth();

  // Organization management for owners and admins
  const isOrgOwnerOrAdmin = effectiveUserRole === 'owner' || effectiveUserRole === 'admin';
  
  const worldManagementItems = isOrgOwnerOrAdmin ? [
    {
      title: 'World Settings',
      href: '/settings/organization',
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      title: 'World Members',
      href: '/settings/members', 
      icon: <Users className="w-4 h-4" />,
    },
  ] : [];

  // User-level billing (for world ownership limits)
  const userBillingItems = [
    {
      title: 'Subscription & Billing',
      href: '/settings/billing',
      icon: <CreditCard className="w-4 h-4" />,
    },
  ];

  const allSidebarNavItems = [
    ...sidebarNavItems,
    ...userBillingItems,
    ...worldManagementItems,
  ];

  return (
    <ContentContainer>
      <div className='space-y-6'>
        <div>
          <h3 className='text-lg font-medium'>Settings</h3>
          <p className='text-sm text-muted-foreground'>
            Manage your account, current world, and preferences within your AI Universe.
          </p>
        </div>
        <Separator />
        <div className='grid gap-6 lg:grid-cols-[200px_1fr]'>
          <aside>
            <SidebarNav items={allSidebarNavItems} />
          </aside>
          <div className='min-w-0 max-w-2xl'>
            <Outlet />
          </div>
        </div>
      </div>
    </ContentContainer>
  )
}
