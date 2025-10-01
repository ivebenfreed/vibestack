import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CheckCircle } from 'lucide-react';

interface EventNodeData {
  label: string;
}

export function BPMNEndEventNode({ data, selected }: NodeProps<EventNodeData>) {
  return (
    <div className="relative">
      <div
        className={`
          w-10 h-10 rounded-full border-4 bg-red-50 flex items-center justify-center
          ${selected ? 'border-red-600 shadow-lg' : 'border-red-500'}
        `}
      >
        <CheckCircle className="w-5 h-5 text-red-600" />
      </div>
      <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium">
        {data.label}
      </div>
      <Handle type="target" position={Position.Top} />
    </div>
  );
}
