import { createFileRoute } from '@tanstack/react-router';
import { VibeGantt } from '@/components/custom/vibegantt/VibeGantt';

export const Route = createFileRoute('/_authenticated/debug/vibegantt')({
  component: DebugVibeGanttPage,
});

function DebugVibeGanttPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">VibeGantt Debug</h1>
        <p className="text-gray-600 mt-2">
          Full-featured Gantt chart with Legend State observables and mock data
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900">📊 Data Management</h3>
          <ul className="text-sm text-blue-700 mt-2 space-y-1">
            <li>• Mock data with 9 realistic tasks</li>
            <li>• Task dependencies (9 connections)</li>
            <li>• Reactive Legend State observables</li>
            <li>• CRUD operations</li>
          </ul>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-900">🎛️ Interactive Features</h3>
          <ul className="text-sm text-green-700 mt-2 space-y-1">
            <li>• Drag & drop task scheduling</li>
            <li>• Multi-scale zoom (day/week/month)</li>
            <li>• Task selection & editing</li>
            <li>• Dependency visualization</li>
          </ul>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h3 className="font-semibold text-purple-900">⚡ Performance</h3>
          <ul className="text-sm text-purple-700 mt-2 space-y-1">
            <li>• Computed positioning calculations</li>
            <li>• Efficient SVG dependency rendering</li>
            <li>• Smooth zoom transitions</li>
            <li>• Responsive timeline scaling</li>
          </ul>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <h3 className="font-semibold text-gray-900 mb-2">🚀 Try These Features:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <strong>Basic Interactions:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Click tasks to select them</li>
              <li>• Use zoom controls (+/-/Fit)</li>
              <li>• Change time scale (Day/Week/Month)</li>
              <li>• Scroll timeline horizontally/vertically</li>
            </ul>
          </div>
          <div>
            <strong>Advanced Features:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Drag tasks to reschedule</li>
              <li>• Add new tasks with + Task button</li>
              <li>• Delete selected tasks/dependencies</li>
              <li>• Reset data or clear all</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main VibeGantt Component */}
      <div className="bg-white rounded-lg shadow-sm border">
        <VibeGantt
          tableId="debug-gantt-full"
          height={600}
          className="border-0"
          enableDragAndDrop={true}
          enableDependencies={true}
          enableZoom={true}
          onTaskUpdate={(taskId, updates) => {
            console.log('Task updated:', taskId, updates);
          }}
          onTaskCreate={(task) => {
            console.log('Task created:', task);
          }}
          onTaskDelete={(taskId) => {
            console.log('Task deleted:', taskId);
          }}
          onDependencyCreate={(dependency) => {
            console.log('Dependency created:', dependency);
          }}
          onDependencyDelete={(dependencyId) => {
            console.log('Dependency deleted:', dependencyId);
          }}
        />
      </div>

      {/* Technical Details */}
      <div className="border-t pt-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Technical Implementation</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Architecture</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• <strong>State:</strong> Legend State observables</li>
              <li>• <strong>Rendering:</strong> React + CSS positioning</li>
              <li>• <strong>Dependencies:</strong> SVG path rendering</li>
              <li>• <strong>Calculations:</strong> Pure functions</li>
              <li>• <strong>Events:</strong> Native DOM + React handlers</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Key Features</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• <strong>Mock Data:</strong> Realistic project timeline</li>
              <li>• <strong>Reactive State:</strong> Auto-updating positions</li>
              <li>• <strong>Time Scales:</strong> Hour/Day/Week/Month</li>
              <li>• <strong>Zoom:</strong> 0.1x to 5x scaling</li>
              <li>• <strong>Drag & Drop:</strong> Date-snapped scheduling</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-900">📝 Next Steps for DataForge Integration</h4>
          <p className="text-yellow-800 text-sm mt-1">
            This implementation uses mock data and is ready for DataForge integration.
            Simply replace the mock data store with real entity loading and the UI will work seamlessly.
          </p>
        </div>
      </div>
    </div>
  );
}