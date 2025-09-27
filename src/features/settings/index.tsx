import { Separator } from '@/components/ui/separator'
import { ContentContainer } from '@/components/layout/content-container'
import SidebarNav from './components/sidebar-nav'
import { User, Settings as SettingsIcon, Palette, Bell, Building2, Users, CreditCard } from 'lucide-react'
import { useAuth } from '@/lib/auth-compatibility'
import { Outlet } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrganizationSwitcher } from '@/components/layout/OrganizationSwitcher'

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
  const { user, currentOrganization, effectiveUserRole, userOrganizations } = useAuth();

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
            Manage your account and preferences within your AI Universe.
          </p>
        </div>

        {/* World Context Header - Shows which world is being managed */}
        {isOrgOwnerOrAdmin && currentOrganization && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Managing World: {currentOrganization.name}</CardTitle>
                    <CardDescription>
                      Your role: {effectiveUserRole} • World settings and member management
                    </CardDescription>
                  </div>
                </div>

                {/* World switcher for multi-world users */}
                {userOrganizations && userOrganizations.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Switch world:</span>
                    <div className="w-48">
                      <OrganizationSwitcher />
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        )}

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
