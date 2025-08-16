import { Component } from 'solid-js';
import { AppShell } from '../components/layout/AppShell';

const Organization: Component = () => {
  return (
    <AppShell>
      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Organization</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your organization settings, members, and permissions
          </p>
        </div>

        {/* Organization overview */}
        <div class="card p-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 bg-primary-500 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
              VS
            </div>
            <div>
              <h2 class="text-xl font-semibold">VibeStack Inc.</h2>
              <p class="text-sm text-gray-500">Enterprise Plan • Created Jan 1, 2024</p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="card p-4">
            <p class="text-sm text-gray-500">Members</p>
            <p class="text-2xl font-bold mt-1">12</p>
          </div>
          <div class="card p-4">
            <p class="text-sm text-gray-500">Teams</p>
            <p class="text-2xl font-bold mt-1">4</p>
          </div>
          <div class="card p-4">
            <p class="text-sm text-gray-500">Projects</p>
            <p class="text-2xl font-bold mt-1">24</p>
          </div>
          <div class="card p-4">
            <p class="text-sm text-gray-500">Storage</p>
            <p class="text-2xl font-bold mt-1">2.4 GB</p>
          </div>
        </div>

        {/* Tabs */}
        <div class="card">
          <div class="border-b border-gray-200 dark:border-gray-700">
            <nav class="flex gap-6 px-6">
              {['Members', 'Teams', 'Permissions', 'Billing', 'Settings'].map((tab, index) => (
                <button class={`py-4 border-b-2 font-medium text-sm ${
                  index === 0 
                    ? 'border-primary-500 text-primary-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          {/* Members table */}
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="relative">
                <input
                  type="text"
                  placeholder="Search members..."
                  class="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
                <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button class="button button-primary px-4 py-2">
                <span class="mr-2">👤</span> Invite Member
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th class="pb-3">Member</th>
                    <th class="pb-3">Role</th>
                    <th class="pb-3">Teams</th>
                    <th class="pb-3">Joined</th>
                    <th class="pb-3">Status</th>
                    <th class="pb-3"></th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  {[
                    { name: 'John Doe', email: 'john@vibestack.com', role: 'Admin', teams: 'Engineering, Design', joined: 'Jan 1, 2024', status: 'Active' },
                    { name: 'Jane Smith', email: 'jane@vibestack.com', role: 'Member', teams: 'Marketing', joined: 'Jan 15, 2024', status: 'Active' },
                    { name: 'Bob Johnson', email: 'bob@vibestack.com', role: 'Member', teams: 'Engineering', joined: 'Feb 1, 2024', status: 'Active' },
                    { name: 'Alice Brown', email: 'alice@vibestack.com', role: 'Viewer', teams: 'Sales', joined: 'Feb 10, 2024', status: 'Pending' },
                  ].map(member => (
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                      <td class="py-3">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div class="font-medium">{member.name}</div>
                            <div class="text-xs text-gray-500">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td class="py-3">
                        <span class={`px-2 py-1 text-xs rounded-full ${
                          member.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                          member.role === 'Member' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td class="py-3 text-gray-600">{member.teams}</td>
                      <td class="py-3 text-gray-600">{member.joined}</td>
                      <td class="py-3">
                        <span class={`px-2 py-1 text-xs rounded-full ${
                          member.status === 'Active' ? 'bg-green-100 text-green-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                      <td class="py-3">
                        <button class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Organization;