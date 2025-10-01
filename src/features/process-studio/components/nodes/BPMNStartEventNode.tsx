import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Play } from 'lucide-react';

interface EventNodeData {
  label: string;
}

export function BPMNStartEventNode({ data, selected }: NodeProps<EventNodeData>) {
  return (
    <div className="relative">
      <div
        className={`
          w-10 h-10 rounded-full border-2 bg-green-50 flex items-center justify-center
          ${selected ? 'border-green-600 shadow-lg' : 'border-green-500'}
        `}
      >
        <Play className="w-5 h-5 text-green-600" />
      </div>
      <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium">
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
