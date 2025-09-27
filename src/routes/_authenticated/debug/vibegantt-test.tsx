import { createFileRoute } from '@tanstack/react-router';
import { VibeGantt } from '@/components/custom/vibegantt/VibeGantt';

export const Route = createFileRoute('/_authenticated/debug/vibegantt-test')({
  component: VibeGanttTestPage,
});

function VibeGanttTestPage() {
  return (
    <div className="p-6">
      <div className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">VibeGantt Demo</h1>
        <p className="text-muted-foreground mt-1">
          Interactive Gantt chart with Legend State and mock data
        </p>
      </div>

      <VibeGantt
        tableId="demo-gantt"
        height={700}
        enableDragAndDrop={true}
        enableDependencies={true}
        enableZoom={true}
      />
    </div>
  );
}