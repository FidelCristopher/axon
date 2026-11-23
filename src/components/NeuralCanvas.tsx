import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAxonStore } from '../store/axonStore';
import { NeuralNode } from './NeuralNode';
import { BrainHubNode } from './BrainHubNode';

const nodeTypes: NodeTypes = {
  brainHub: BrainHubNode,
  neuralNode: NeuralNode,
};

export const NeuralCanvas: React.FC = () => {
  const { sessions } = useAxonStore();

  // Dynamically generate node graph positions (Radial Synapse Layout)
  const { nodes, edges } = useMemo(() => {
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // Center Brain Hub Node
    generatedNodes.push({
      id: 'brain-hub',
      type: 'brainHub',
      position: { x: 380, y: 260 },
      data: {},
      draggable: true,
    });

    // Branch nodes around the brain hub
    const totalSessions = sessions.length;
    const startX = 680;
    const spacingY = 140;
    const startY = 260 - ((totalSessions - 1) * spacingY) / 2;

    sessions.forEach((session, index) => {
      const isWorking = session.status === 'WORKING';
      const nodeX = startX + (index % 2 === 1 ? 60 : 0);
      const nodeY = startY + index * spacingY;

      generatedNodes.push({
        id: session.id,
        type: 'neuralNode',
        position: { x: nodeX, y: nodeY },
        data: { session },
        draggable: true,
      });

      // Synaptic wire edge connecting Brain Hub to this branch
      generatedEdges.push({
        id: `edge-hub-${session.id}`,
        source: 'brain-hub',
        target: session.id,
        animated: isWorking,
        className: isWorking ? 'synapse-active-wire' : '',
        style: {
          stroke: isWorking ? '#06b6d4' : '#334155',
          strokeWidth: isWorking ? 2.5 : 1.5,
          filter: isWorking ? 'drop-shadow(0 0 6px rgba(6,182,212,0.6))' : 'none',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isWorking ? '#06b6d4' : '#475569',
          width: 14,
          height: 14,
        },
      });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [sessions]);

  return (
    <div className="flex-1 h-full bg-[#090d16] relative select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={24} size={1.2} />
        <Controls 
          className="!bg-[#0f172a] !border-[#1e293b] !rounded !shadow-xl [&>button]:!bg-[#0f172a] [&>button]:!border-[#1e293b] [&>button]:!text-[#94a3b8] hover:[&>button]:!text-[#f8fafc]" 
        />
      </ReactFlow>

      {/* Floating Canvas Top Overlay Indicator */}
      <div className="absolute top-4 left-6 pointer-events-none flex items-center space-x-3">
        <div className="px-3 py-1.5 rounded-full bg-[#0f172a]/90 backdrop-blur border border-[#1e293b] text-xs font-mono text-[#94a3b8] flex items-center space-x-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#06b6d4] animate-pulse" />
          <span>SYNAPTIC TOPOLOGY: RADIAL</span>
        </div>
      </div>
    </div>
  );
};
