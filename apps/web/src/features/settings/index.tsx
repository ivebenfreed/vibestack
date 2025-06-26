import { Separator } from '@/components/ui/separator'
import { ContentContainer } from '@/components/layout/content-container'
import SidebarNav from './components/sidebar-nav'
import { User, Settings as SettingsIcon, Palette, Bell, Monitor } from 'lucide-react'

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
  {
    title: 'Display',
    href: '/settings/display',
    icon: <Monitor className="w-4 h-4" />,
  },
]

export default function Settings() {
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
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='min-w-0 max-w-2xl'>
            <div className='space-y-6'>
              <div className="text-center py-12">
                <p className="text-muted-foreground">Settings forms coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ContentContainer>
  )
}
