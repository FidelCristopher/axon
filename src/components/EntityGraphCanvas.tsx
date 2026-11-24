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
import { EntityGraphNode } from './EntityGraphNode';

const nodeTypes: NodeTypes = {
  entityGraphNode: EntityGraphNode,
};

export const EntityGraphCanvas: React.FC = () => {
  const { 
    entities, 
    relationships, 
    selectedEntityId, 
    setSelectedEntityId,
    setIsTerminalModalOpen
  } = useAxonStore();

  const { nodes, edges } = useMemo(() => {
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // Organic, clean constellation positions on pure white canvas
    const positions: Record<string, { x: number; y: number }> = {
      'hub-main': { x: 380, y: 280 },
      'node-dev-1': { x: 680, y: 160 },
      'node-dev-2': { x: 680, y: 400 },
      'node-qa': { x: 380, y: 500 },
      'node-designer': { x: 120, y: 400 },
    };

    entities.forEach((entity, index) => {
      const pos = positions[entity.id] || {
        x: 380 + Math.cos((index * 2 * Math.PI) / Math.max(1, entities.length)) * 260,
        y: 280 + Math.sin((index * 2 * Math.PI) / Math.max(1, entities.length)) * 260,
      };

      generatedNodes.push({
        id: entity.id,
        type: 'entityGraphNode',
        position: pos,
        data: {
          entity,
          isSelected: entity.id === selectedEntityId,
        },
        draggable: true,
      });
    });

    // Pure connection lines without any text labels
    relationships.forEach((rel) => {
      const isConnectedToSelected =
        rel.source === selectedEntityId || rel.target === selectedEntityId;

      generatedEdges.push({
        id: rel.id,
        source: rel.source,
        target: rel.target,
        animated: isConnectedToSelected,
        label: undefined,
        style: {
          stroke: isConnectedToSelected ? '#e11d48' : '#e2e8f0',
          strokeWidth: isConnectedToSelected ? 2.2 : 1.2,
          opacity: isConnectedToSelected ? 1 : 0.7,
          filter: isConnectedToSelected
            ? 'drop-shadow(0 2px 4px rgba(225, 29, 72, 0.35))'
            : 'none',
        },
        markerEnd: isConnectedToSelected
          ? {
              type: MarkerType.ArrowClosed,
              color: '#e11d48',
              width: 10,
              height: 10,
            }
          : undefined,
      });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [entities, relationships, selectedEntityId]);

  return (
    <div className="flex-1 h-full bg-[#ffffff] relative select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          setSelectedEntityId(node.id);
          setIsTerminalModalOpen(true);
        }}
        fitView
        minZoom={0.3}
        maxZoom={2.0}
        proOptions={{ hideAttribution: true }}
      >
        {/* Soft light gray dot matrix grid */}
        <Background color="#e2e8f0" gap={24} size={1.2} />
        <Controls
          position="bottom-right"
          className="!bg-[#ffffff] !border-[#e2e8f0] !rounded-md !shadow-md [&>button]:!bg-[#ffffff] [&>button]:!border-[#e2e8f0] [&>button]:!text-[#64748b] hover:[&>button]:!text-[#0f172a] !mr-4 !mb-4"
        />
      </ReactFlow>
    </div>
  );
};
