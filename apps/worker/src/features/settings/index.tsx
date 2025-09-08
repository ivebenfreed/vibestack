import { Separator } from '@/components/ui/separator'
import { ContentContainer } from '@/components/layout/content-container'
import SidebarNav from './components/sidebar-nav'
import { User, Settings as SettingsIcon, Palette, Bell, Monitor, Shield, Upload, CreditCard } from 'lucide-react'
import { useAuth } from '@/state-machines'
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
    title: 'Billing',
    href: '/settings/billing',
    icon: <CreditCard className="w-4 h-4" />,
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
  {
    title: 'Display',
    href: '/settings/display',
    icon: <Monitor className="w-4 h-4" />,
  },
  {
    title: 'File Import',
    href: '/settings/import',
    icon: <Upload className="w-4 h-4" />,
  },
]

export default function Settings() {
  const { user, isAdmin } = useAuth();

  // Add admin items if user is admin
  const allSidebarNavItems = [
    ...sidebarNavItems,
    ...(isAdmin ? [{
      title: 'User Management',
      href: '/settings/admin/users',
      icon: <Shield className="w-4 h-4" />,
    }] : [])
  ];

  return (
    <ContentContainer>
      <div className='space-y-6'>
        <div>
          <h3 className='text-lg font-medium'>Settings</h3>
          <p className='text-sm text-muted-foreground'>
            Manage your account settings and set e-mail preferences.
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
