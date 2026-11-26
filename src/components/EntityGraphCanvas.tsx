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
import { Layers } from 'lucide-react';

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

    const hubEntity = entities.find((e) => e.type === 'hub');
    const branchEntities = entities.filter((e) => e.type !== 'hub');

    if (hubEntity) {
      generatedNodes.push({
        id: hubEntity.id,
        type: 'entityGraphNode',
        position: { x: 180, y: 260 },
        data: {
          entity: hubEntity,
          isSelected: hubEntity.id === selectedEntityId,
        },
        draggable: true,
      });
    }

    // Fan branches cleanly to the right of the central Brain Hub (matching the Axon neuron logo)
    const spacingY = 120;
    const totalHeight = Math.max(0, (branchEntities.length - 1) * spacingY);
    const startY = 260 - totalHeight / 2;

    branchEntities.forEach((entity, index) => {
      generatedNodes.push({
        id: entity.id,
        type: 'entityGraphNode',
        position: {
          x: hubEntity ? 540 : 340,
          y: startY + index * spacingY,
        },
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
      {/* Clean Standby State when No Session is Selected on Initial Load / Refresh */}
      {entities.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
          <div className="flex flex-col items-center space-y-2.5 text-center p-6 rounded-xl border border-dashed border-[#cbd5e1] bg-[#ffffff]/90 backdrop-blur-xs max-w-sm shadow-xs animate-in fade-in duration-200">
            <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center border border-[#e2e8f0]">
              <Layers className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <div className="text-xs font-bold text-[#0f172a] font-mono">No Session Active</div>
            <p className="text-[11px] text-[#64748b] font-mono leading-relaxed">
              Select any session from the left sidebar to render its real topology, or click <span className="font-bold text-[#e11d48]">+</span> to create a new session.
            </p>
          </div>
        </div>
      )}

      <ReactFlow
        style={{ backgroundColor: '#ffffff' }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          setSelectedEntityId(node.id);
          const clickedEntity = (node.data as any)?.entity;
          // Center Brain Hub is visual-only; only branch nodes open a Pi terminal
          if (clickedEntity && clickedEntity.type !== 'hub') {
            setIsTerminalModalOpen(true);
          }
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
