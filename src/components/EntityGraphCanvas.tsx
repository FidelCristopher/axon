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
    showEdgeLabels 
  } = useAxonStore();

  const { nodes, edges } = useMemo(() => {
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // Dense organic constellation layout
    const total = entities.length;
    const centerX = 520;
    const centerY = 340;

    entities.forEach((entity, index) => {
      let x = centerX;
      let y = centerY;

      if (entity.id === 'hub-main') {
        x = centerX;
        y = centerY;
      } else {
        const angle = ((index - 1) / (total - 1)) * 2 * Math.PI;
        const radius = index % 2 === 0 ? 240 : 340;
        const jitterX = Math.sin(index * 3) * 40;
        const jitterY = Math.cos(index * 2) * 40;
        x = centerX + Math.cos(angle) * radius + jitterX;
        y = centerY + Math.sin(angle) * radius + jitterY;
      }

      generatedNodes.push({
        id: entity.id,
        type: 'entityGraphNode',
        position: { x, y },
        data: {
          entity,
          isSelected: entity.id === selectedEntityId,
        },
        draggable: true,
      });
    });

    // Radiant crimson highlight edges for selected entity
    relationships.forEach((rel) => {
      const isConnectedToSelected =
        rel.source === selectedEntityId || rel.target === selectedEntityId;

      generatedEdges.push({
        id: rel.id,
        source: rel.source,
        target: rel.target,
        animated: isConnectedToSelected,
        label: showEdgeLabels ? rel.label : undefined,
        labelStyle: {
          fill: isConnectedToSelected ? '#ffffff' : '#555555',
          fontSize: 8,
          fontFamily: 'monospace',
          fontWeight: isConnectedToSelected ? 600 : 400,
        },
        labelBgStyle: {
          fill: '#000000',
          fillOpacity: 0.85,
          rx: 2,
        },
        labelBgPadding: [3, 2],
        style: {
          stroke: isConnectedToSelected ? '#e11d48' : '#222222',
          strokeWidth: isConnectedToSelected ? 2.2 : 0.9,
          opacity: isConnectedToSelected ? 1 : 0.45,
          filter: isConnectedToSelected
            ? 'drop-shadow(0 0 5px rgba(225, 29, 72, 0.7))'
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
  }, [entities, relationships, selectedEntityId, showEdgeLabels]);

  return (
    <div className="flex-1 h-full bg-[#000000] relative select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => setSelectedEntityId(node.id)}
        fitView
        minZoom={0.2}
        maxZoom={2.0}
        proOptions={{ hideAttribution: true }}
      >
        {/* Pitch black dot matrix background */}
        <Background color="#161616" gap={20} size={1} />
        <Controls
          position="bottom-right"
          className="!bg-[#0a0a0a] !border-[#222222] !rounded-md !shadow-2xl [&>button]:!bg-[#0a0a0a] [&>button]:!border-[#222222] [&>button]:!text-[#888888] hover:[&>button]:!text-[#ffffff] !mr-4 !mb-4"
        />
      </ReactFlow>

      {/* Top Left Graph Title */}
      <div className="absolute top-5 left-6 pointer-events-none">
        <h2 className="text-sm font-semibold tracking-tight text-[#f5f5f5]">
          Graph Relationship Visualization
        </h2>
        <p className="text-[10px] font-mono text-[#666666] mt-0.5">
          Pure Black Canvas • Zero-Idle Telemetry Bus
        </p>
      </div>
    </div>
  );
};
