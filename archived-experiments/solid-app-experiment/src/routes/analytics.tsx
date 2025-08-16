import { Component } from 'solid-js';
import { AppShell } from '../components/layout/AppShell';

const Analytics: Component = () => {
  return (
    <AppShell>
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Track performance metrics and generate insights
            </p>
          </div>
          <div class="flex gap-2">
            <select class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>Last 3 months</option>
              <option>Last year</option>
            </select>
            <button class="button button-primary px-4 py-2">
              <span class="mr-2">📊</span> Export Report
            </button>
          </div>
        </div>

        {/* Key metrics */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-medium text-gray-600">Total Revenue</p>
              <span class="text-green-500 text-sm">+23%</span>
            </div>
            <p class="text-3xl font-bold">$48,293</p>
            <div class="mt-4 h-16 bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded"></div>
          </div>

          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-medium text-gray-600">Active Users</p>
              <span class="text-blue-500 text-sm">+12%</span>
            </div>
            <p class="text-3xl font-bold">1,847</p>
            <div class="mt-4 h-16 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded"></div>
          </div>

          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-medium text-gray-600">Completion Rate</p>
              <span class="text-yellow-500 text-sm">-3%</span>
            </div>
            <p class="text-3xl font-bold">87.4%</p>
            <div class="mt-4 h-16 bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900 dark:to-yellow-800 rounded"></div>
          </div>

          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-medium text-gray-600">Avg Response</p>
              <span class="text-purple-500 text-sm">+5%</span>
            </div>
            <p class="text-3xl font-bold">1.2h</p>
            <div class="mt-4 h-16 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded"></div>
          </div>
        </div>

        {/* Charts section */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity chart */}
          <div class="card">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold">Activity Overview</h2>
            </div>
            <div class="p-6">
              <div class="h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg flex items-center justify-center">
                <span class="text-gray-400">Chart placeholder</span>
              </div>
              <div class="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p class="text-gray-500">Projects</p>
                  <p class="font-semibold">24 active</p>
                </div>
                <div>
                  <p class="text-gray-500">Tasks</p>
                  <p class="font-semibold">143 total</p>
                </div>
                <div>
                  <p class="text-gray-500">Completed</p>
                  <p class="font-semibold">89 this month</p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance chart */}
          <div class="card">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold">Team Performance</h2>
            </div>
            <div class="p-6">
              <div class="space-y-4">
                {[
                  { name: 'Engineering', value: 92, color: 'bg-blue-500' },
                  { name: 'Design', value: 87, color: 'bg-purple-500' },
                  { name: 'Marketing', value: 78, color: 'bg-green-500' },
                  { name: 'Sales', value: 95, color: 'bg-yellow-500' },
                  { name: 'Support', value: 83, color: 'bg-red-500' },
                ].map(team => (
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm font-medium">{team.name}</span>
                      <span class="text-sm text-gray-500">{team.value}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div class={`${team.color} h-2 rounded-full`} style={`width: ${team.value}%`}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent reports */}
        <div class="card">
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Recent Reports</h2>
              <a href="#" class="text-sm text-primary-600 hover:text-primary-700">View all →</a>
            </div>
          </div>
          <div class="p-6">
            <div class="space-y-3">
              {[
                { name: 'Q4 2023 Performance Report', date: 'Jan 15, 2024', type: 'Quarterly', size: '2.4 MB' },
                { name: 'December Activity Summary', date: 'Jan 1, 2024', type: 'Monthly', size: '1.2 MB' },
                { name: 'Team Productivity Analysis', date: 'Dec 28, 2023', type: 'Custom', size: '3.1 MB' },
                { name: 'Project Status Report', date: 'Dec 20, 2023', type: 'Weekly', size: '0.8 MB' },
              ].map(report => (
                <div class="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">📄</span>
                    <div>
                      <p class="font-medium">{report.name}</p>
                      <p class="text-xs text-gray-500">{report.date} • {report.type} • {report.size}</p>
                    </div>
                  </div>
                  <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Analytics;