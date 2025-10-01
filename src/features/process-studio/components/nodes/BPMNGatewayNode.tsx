import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { X, Plus, Circle } from 'lucide-react';
import type { BPMNNodeType } from '@/types/process-studio';

interface GatewayNodeData {
  label: string;
  nodeType: BPMNNodeType;
}

export function BPMNGatewayNode({ data, selected }: NodeProps<GatewayNodeData>) {
  const getIcon = () => {
    switch (data.nodeType) {
      case 'exclusive_gateway':
        return <X className="w-6 h-6" />;
      case 'parallel_gateway':
        return <Plus className="w-6 h-6" />;
      case 'inclusive_gateway':
        return <Circle className="w-6 h-6" />;
      default:
        return <X className="w-6 h-6" />;
    }
  };

  const getBorderColor = () => {
    switch (data.nodeType) {
      case 'exclusive_gateway':
        return selected ? 'border-orange-600' : 'border-orange-500';
      case 'parallel_gateway':
        return selected ? 'border-green-600' : 'border-green-500';
      case 'inclusive_gateway':
        return selected ? 'border-blue-600' : 'border-blue-500';
      default:
        return selected ? 'border-orange-600' : 'border-orange-500';
    }
  };

  return (
    <div className="relative">
      <div
        className={`
          w-12 h-12 rotate-45 border-2 bg-yellow-50 flex items-center justify-center
          ${getBorderColor()}
          ${selected ? 'shadow-lg' : ''}
        `}
      >
        <div className="-rotate-45 text-yellow-700">
          {getIcon()}
        </div>
      </div>
      <div className="absolute top-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium">
        {data.label}
      </div>

      <Handle type="target" position={Position.Top} style={{ left: '50%', top: '-8px' }} />
      <Handle type="source" position={Position.Bottom} style={{ left: '50%', bottom: '-8px' }} />
      <Handle type="source" position={Position.Left} style={{ left: '-8px', top: '50%' }} />
      <Handle type="source" position={Position.Right} style={{ right: '-8px', top: '50%' }} />
    </div>
  );
}
