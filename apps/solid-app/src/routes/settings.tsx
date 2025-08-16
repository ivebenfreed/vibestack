import { Component, createSignal } from 'solid-js';
import { AppShell } from '../components/layout/AppShell';

const Settings: Component = () => {
  const [activeTab, setActiveTab] = createSignal('general');

  return (
    <AppShell>
      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your application preferences and configuration
          </p>
        </div>

        <div class="flex gap-8">
          {/* Settings sidebar */}
          <nav class="w-64 space-y-1">
            {[
              { id: 'general', label: 'General', icon: '⚙️' },
              { id: 'profile', label: 'Profile', icon: '👤' },
              { id: 'notifications', label: 'Notifications', icon: '🔔' },
              { id: 'security', label: 'Security', icon: '🔒' },
              { id: 'integrations', label: 'Integrations', icon: '🔗' },
              { id: 'billing', label: 'Billing', icon: '💳' },
              { id: 'api', label: 'API Keys', icon: '🔑' },
              { id: 'advanced', label: 'Advanced', icon: '🛠️' },
            ].map(item => (
              <button
                onClick={() => setActiveTab(item.id)}
                class={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab() === item.id
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span class="text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Settings content */}
          <div class="flex-1">
            {activeTab() === 'general' && (
              <div class="card p-6 space-y-6">
                <div>
                  <h2 class="text-lg font-semibold mb-4">General Settings</h2>
                  
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium mb-2">Application Name</label>
                      <input type="text" value="VibeStack" class="input w-full max-w-md" />
                    </div>

                    <div>
                      <label class="block text-sm font-medium mb-2">Default Language</label>
                      <select class="input w-full max-w-md">
                        <option>English</option>
                        <option>Spanish</option>
                        <option>French</option>
                        <option>German</option>
                      </select>
                    </div>

                    <div>
                      <label class="block text-sm font-medium mb-2">Timezone</label>
                      <select class="input w-full max-w-md">
                        <option>UTC</option>
                        <option>America/New_York</option>
                        <option>America/Los_Angeles</option>
                        <option>Europe/London</option>
                      </select>
                    </div>

                    <div>
                      <label class="block text-sm font-medium mb-2">Date Format</label>
                      <select class="input w-full max-w-md">
                        <option>MM/DD/YYYY</option>
                        <option>DD/MM/YYYY</option>
                        <option>YYYY-MM-DD</option>
                      </select>
                    </div>

                    <div class="flex items-center gap-3">
                      <input type="checkbox" id="darkMode" class="w-4 h-4" />
                      <label for="darkMode" class="text-sm">Enable dark mode</label>
                    </div>

                    <div class="flex items-center gap-3">
                      <input type="checkbox" id="animations" class="w-4 h-4" checked />
                      <label for="animations" class="text-sm">Enable animations</label>
                    </div>
                  </div>
                </div>

                <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button class="button button-primary px-4 py-2">Save Changes</button>
                </div>
              </div>
            )}

            {activeTab() === 'profile' && (
              <div class="card p-6 space-y-6">
                <div>
                  <h2 class="text-lg font-semibold mb-4">Profile Settings</h2>
                  
                  <div class="space-y-4">
                    <div class="flex items-center gap-4">
                      <div class="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        JD
                      </div>
                      <div>
                        <button class="button button-secondary px-3 py-1 text-sm">Change Photo</button>
                        <p class="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max 2MB.</p>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 max-w-2xl">
                      <div>
                        <label class="block text-sm font-medium mb-2">First Name</label>
                        <input type="text" value="John" class="input w-full" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium mb-2">Last Name</label>
                        <input type="text" value="Doe" class="input w-full" />
                      </div>
                    </div>

                    <div>
                      <label class="block text-sm font-medium mb-2">Email</label>
                      <input type="email" value="john@vibestack.com" class="input w-full max-w-md" />
                    </div>

                    <div>
                      <label class="block text-sm font-medium mb-2">Bio</label>
                      <textarea class="input w-full max-w-2xl" rows="4" placeholder="Tell us about yourself..."></textarea>
                    </div>

                    <div>
                      <label class="block text-sm font-medium mb-2">Location</label>
                      <input type="text" placeholder="City, Country" class="input w-full max-w-md" />
                    </div>
                  </div>
                </div>

                <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button class="button button-primary px-4 py-2">Update Profile</button>
                </div>
              </div>
            )}

            {activeTab() === 'notifications' && (
              <div class="card p-6 space-y-6">
                <div>
                  <h2 class="text-lg font-semibold mb-4">Notification Preferences</h2>
                  
                  <div class="space-y-6">
                    <div>
                      <h3 class="font-medium mb-3">Email Notifications</h3>
                      <div class="space-y-3">
                        {[
                          { label: 'Project updates', checked: true },
                          { label: 'Task assignments', checked: true },
                          { label: 'Comments and mentions', checked: true },
                          { label: 'Weekly digest', checked: false },
                          { label: 'Marketing emails', checked: false },
                        ].map(item => (
                          <div class="flex items-center gap-3">
                            <input type="checkbox" class="w-4 h-4" checked={item.checked} />
                            <label class="text-sm">{item.label}</label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 class="font-medium mb-3">Push Notifications</h3>
                      <div class="space-y-3">
                        {[
                          { label: 'Desktop notifications', checked: true },
                          { label: 'Mobile notifications', checked: true },
                          { label: 'Sound alerts', checked: false },
                        ].map(item => (
                          <div class="flex items-center gap-3">
                            <input type="checkbox" class="w-4 h-4" checked={item.checked} />
                            <label class="text-sm">{item.label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button class="button button-primary px-4 py-2">Save Preferences</button>
                </div>
              </div>
            )}

            {activeTab() === 'security' && (
              <div class="card p-6 space-y-6">
                <div>
                  <h2 class="text-lg font-semibold mb-4">Security Settings</h2>
                  
                  <div class="space-y-6">
                    <div>
                      <h3 class="font-medium mb-3">Change Password</h3>
                      <div class="space-y-3 max-w-md">
                        <input type="password" placeholder="Current password" class="input w-full" />
                        <input type="password" placeholder="New password" class="input w-full" />
                        <input type="password" placeholder="Confirm new password" class="input w-full" />
                        <button class="button button-secondary px-4 py-2">Update Password</button>
                      </div>
                    </div>

                    <div>
                      <h3 class="font-medium mb-3">Two-Factor Authentication</h3>
                      <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Add an extra layer of security to your account
                      </p>
                      <button class="button button-secondary px-4 py-2">Enable 2FA</button>
                    </div>

                    <div>
                      <h3 class="font-medium mb-3">Active Sessions</h3>
                      <div class="space-y-3">
                        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div>
                            <p class="font-medium text-sm">Chrome on MacOS</p>
                            <p class="text-xs text-gray-500">San Francisco, CA • Current session</p>
                          </div>
                          <span class="text-xs text-green-600">Active</span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div>
                            <p class="font-medium text-sm">Mobile App on iOS</p>
                            <p class="text-xs text-gray-500">San Francisco, CA • 2 hours ago</p>
                          </div>
                          <button class="text-xs text-red-600 hover:underline">Revoke</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Settings;