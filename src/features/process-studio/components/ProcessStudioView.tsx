import React, { useMemo, useCallback } from 'react';
import { useSelector } from '@legendapp/state/react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useProcessData } from '../hooks/useProcessData';
import { useProcessMutations } from '../hooks/useProcessMutations';
import { processStudioUI$ } from '../stores/ui-state';
import { BPMNTaskNode } from './nodes/BPMNTaskNode';
import { BPMNStartEventNode } from './nodes/BPMNStartEventNode';
import { BPMNEndEventNode } from './nodes/BPMNEndEventNode';
import { BPMNGatewayNode } from './nodes/BPMNGatewayNode';

const nodeTypes = {
  task: BPMNTaskNode,
  user_task: BPMNTaskNode,
  service_task: BPMNTaskNode,
  send_task: BPMNTaskNode,
  receive_task: BPMNTaskNode,
  manual_task: BPMNTaskNode,
  script_task: BPMNTaskNode,
  business_rule_task: BPMNTaskNode,
  start_event: BPMNStartEventNode,
  end_event: BPMNEndEventNode,
  exclusive_gateway: BPMNGatewayNode,
  parallel_gateway: BPMNGatewayNode,
  inclusive_gateway: BPMNGatewayNode
};

interface ProcessStudioViewProps {
  orgId: string;
  processId: string;
}

function ProcessStudioViewInner({ orgId, processId }: ProcessStudioViewProps) {
  // Get raw data from Legend State
  const { process, nodes: processNodes, connections: processConnections } = useProcessData(processId);
  const { updateNode } = useProcessMutations(processId, orgId);

  // Get UI state from Legend State (NO React useState!)
  const selectedNodeId = useSelector(() => processStudioUI$.selectedNodeId.get());

  // Transform raw data → ReactFlow format (computed, not state)
  const nodes: Node[] = useMemo(() => {
    return processNodes.map(node => ({
      id: node.id,
      type: node.node_type,
      position: { x: Number(node.position_x), y: Number(node.position_y) },
      data: {
        label: node.label,
        description: node.description,
        linkedEntityType: node.linked_entity_type,
        linkedEntityId: node.linked_entity_id,
        nodeType: node.node_type
      },
      style: typeof node.style === 'string' ? JSON.parse(node.style) : (node.style || undefined),
      selected: node.id === selectedNodeId
    }));
  }, [processNodes, selectedNodeId]);

  const edges: Edge[] = useMemo(() => {
    return processConnections.map(conn => ({
      id: conn.id,
      source: conn.source_node_id,
      target: conn.target_node_id,
      type: 'smoothstep',
      label: conn.label,
      labelStyle: {
        fill: '#1f2937',
        fontWeight: 600,
        fontSize: 12,
        backgroundColor: '#f3f4f6',
        padding: '4px 8px',
        borderRadius: '4px'
      },
      labelBgStyle: { fill: '#f3f4f6', fillOpacity: 0.9 },
      labelBgPadding: [8, 4],
      style: {
        stroke: conn.is_default ? '#9ca3af' : '#3b82f6',
        strokeWidth: conn.is_default ? 2 : 2,
        strokeDasharray: conn.is_default ? '5,5' : 'none'
      },
      markerEnd: {
        type: 'arrowclosed',
        color: conn.is_default ? '#9ca3af' : '#3b82f6'
      },
      data: {
        conditionExpression: conn.condition_expression,
        isDefault: conn.is_default
      },
      animated: false
    }));
  }, [processConnections]);

  // Local state for ReactFlow (not in Legend State because it's transient)
  const [localNodes, setLocalNodes] = React.useState<Node[]>([]);
  const [localEdges, setLocalEdges] = React.useState<Edge[]>([]);

  // Sync Legend State data to local ReactFlow state
  React.useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes]);

  React.useEffect(() => {
    setLocalEdges(edges);
  }, [edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setLocalNodes((nds) => applyNodeChanges(changes, nds));

      // Persist position changes to backend
      for (const change of changes) {
        if (change.type === 'position' && change.position && !('dragging' in change && change.dragging)) {
          updateNode(change.id, {
            position_x: change.position.x,
            position_y: change.position.y
          });
        }
      }
    },
    [updateNode]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setLocalEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Update UI state in Legend State (not React state!)
    processStudioUI$.selectedNodeId.set(node.id);
    processStudioUI$.showPropertiesPanel.set(true);
  }, []);

  const onPaneClick = useCallback(() => {
    processStudioUI$.selectedNodeId.set(null);
    processStudioUI$.showPropertiesPanel.set(false);
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* ReactFlow Canvas - Full Height */}
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

export function ProcessStudioView(props: ProcessStudioViewProps) {
  return (
    <ReactFlowProvider>
      <ProcessStudioViewInner {...props} />
    </ReactFlowProvider>
  );
}
