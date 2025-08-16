import { Component } from 'solid-js';
import { Title } from "@solidjs/meta";
import { AppShell } from '~/components/layout/AppShell';

const Home: Component = () => {
  return (
    <>
      <Title>Dashboard - VibeStack</Title>
      <AppShell>
        <div class="space-y-6">
          {/* Page header */}
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Welcome back! Here's an overview of your workspace.
            </p>
          </div>

          {/* Stats grid */}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="card p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Projects</p>
                  <p class="text-2xl font-bold mt-1">24</p>
                </div>
                <span class="text-3xl">📊</span>
              </div>
              <div class="mt-4 flex items-center text-sm">
                <span class="text-green-500">↑ 12%</span>
                <span class="text-gray-500 ml-2">from last month</span>
              </div>
            </div>

            <div class="card p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Active Tasks</p>
                  <p class="text-2xl font-bold mt-1">143</p>
                </div>
                <span class="text-3xl">✓</span>
              </div>
              <div class="mt-4 flex items-center text-sm">
                <span class="text-green-500">↑ 8%</span>
                <span class="text-gray-500 ml-2">from last week</span>
              </div>
            </div>

            <div class="card p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Team Members</p>
                  <p class="text-2xl font-bold mt-1">12</p>
                </div>
                <span class="text-3xl">👥</span>
              </div>
              <div class="mt-4 flex items-center text-sm">
                <span class="text-blue-500">→ 0%</span>
                <span class="text-gray-500 ml-2">no change</span>
              </div>
            </div>

            <div class="card p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Storage Used</p>
                  <p class="text-2xl font-bold mt-1">2.4 GB</p>
                </div>
                <span class="text-3xl">💾</span>
              </div>
              <div class="mt-4 flex items-center text-sm">
                <span class="text-yellow-500">↑ 5%</span>
                <span class="text-gray-500 ml-2">of 10 GB limit</span>
              </div>
            </div>
          </div>

          {/* Recent activity and quick actions */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <div class="card">
              <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-lg font-semibold">Recent Activity</h2>
              </div>
              <div class="p-6 space-y-4">
                {[
                  { user: 'John Doe', action: 'created a new project', time: '2 hours ago', icon: '📁' },
                  { user: 'Jane Smith', action: 'completed task #123', time: '4 hours ago', icon: '✅' },
                  { user: 'Bob Johnson', action: 'uploaded 3 files', time: '6 hours ago', icon: '📎' },
                  { user: 'Alice Brown', action: 'commented on Discussion #45', time: '8 hours ago', icon: '💬' },
                ].map(activity => (
                  <div class="flex items-start gap-3">
                    <span class="text-2xl">{activity.icon}</span>
                    <div class="flex-1">
                      <p class="text-sm">
                        <span class="font-medium">{activity.user}</span>
                        <span class="text-gray-600 dark:text-gray-400"> {activity.action}</span>
                      </p>
                      <p class="text-xs text-gray-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div class="card">
              <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-lg font-semibold">Quick Actions</h2>
              </div>
              <div class="p-6 space-y-3">
                <button class="w-full button button-primary px-4 py-2 justify-start">
                  <span class="mr-2">➕</span> Create New Project
                </button>
                <button class="w-full button button-secondary px-4 py-2 justify-start">
                  <span class="mr-2">📝</span> Add Task
                </button>
                <button class="w-full button button-secondary px-4 py-2 justify-start">
                  <span class="mr-2">👤</span> Invite Team Member
                </button>
                <button class="w-full button button-secondary px-4 py-2 justify-start">
                  <span class="mr-2">📊</span> Generate Report
                </button>
              </div>
            </div>
          </div>

          {/* Projects overview */}
          <div class="card">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">Active Projects</h2>
                <a href="/entities" class="text-sm text-primary-600 hover:text-primary-700">View all →</a>
              </div>
            </div>
            <div class="p-6">
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                      <th class="pb-3">Project Name</th>
                      <th class="pb-3">Status</th>
                      <th class="pb-3">Progress</th>
                      <th class="pb-3">Due Date</th>
                    </tr>
                  </thead>
                  <tbody class="text-sm">
                    {[
                      { name: 'Website Redesign', status: 'In Progress', progress: 65, due: '2024-02-15' },
                      { name: 'Mobile App Development', status: 'Planning', progress: 20, due: '2024-03-01' },
                      { name: 'Marketing Campaign', status: 'In Progress', progress: 80, due: '2024-01-31' },
                      { name: 'Data Migration', status: 'Testing', progress: 90, due: '2024-02-10' },
                    ].map(project => (
                      <tr class="border-t border-gray-200 dark:border-gray-700">
                        <td class="py-3 font-medium">{project.name}</td>
                        <td class="py-3">
                          <span class={`px-2 py-1 text-xs rounded-full ${
                            project.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                            project.status === 'Planning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {project.status}
                          </span>
                        </td>
                        <td class="py-3">
                          <div class="flex items-center gap-2">
                            <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                class="bg-primary-500 h-2 rounded-full"
                                style={`width: ${project.progress}%`}
                              />
                            </div>
                            <span class="text-xs text-gray-500">{project.progress}%</span>
                          </div>
                        </td>
                        <td class="py-3 text-gray-600 dark:text-gray-400">{project.due}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </>
  );
};

export default Home;