import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { User, Settings, FileText, Mail, Inbox, Hand, Code, Table } from 'lucide-react';
import type { BPMNNodeType } from '@/types/process-studio';

interface TaskNodeData {
  label: string;
  description?: string;
  nodeType: BPMNNodeType;
  linkedEntityType?: string;
  linkedEntityId?: string;
}

export function BPMNTaskNode({ data, selected }: NodeProps<TaskNodeData>) {
  const getIcon = () => {
    switch (data.nodeType) {
      case 'user_task':
        return <User className="w-4 h-4" />;
      case 'service_task':
        return <Settings className="w-4 h-4" />;
      case 'send_task':
        return <Mail className="w-4 h-4" />;
      case 'receive_task':
        return <Inbox className="w-4 h-4" />;
      case 'manual_task':
        return <Hand className="w-4 h-4" />;
      case 'script_task':
        return <Code className="w-4 h-4" />;
      case 'business_rule_task':
        return <Table className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const hasEntityLink = !!data.linkedEntityId;

  return (
    <div
      className={`
        px-3 py-2.5 rounded-lg border-2 bg-white
        ${selected ? 'border-blue-500 shadow-lg' : 'border-blue-300'}
        ${hasEntityLink ? 'border-purple-400' : ''}
      `}
      style={{ minWidth: 160, maxWidth: 220 }}
    >
      <Handle type="target" position={Position.Top} />

      <div className="flex items-start gap-2">
        <div className="text-blue-600 mt-0.5 shrink-0">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium break-words leading-tight">{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground break-words leading-tight mt-1">
              {data.description}
            </div>
          )}
          {hasEntityLink && (
            <div className="text-xs text-purple-600 mt-1.5 truncate font-medium">
              🔗 {data.linkedEntityType}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
