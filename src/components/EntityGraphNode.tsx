import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { GraphEntity } from '../types/axon';
import { ENTITY_TYPE_CONFIGS } from '../store/axonStore';

interface EntityGraphNodeProps {
  data: {
    entity: GraphEntity;
    isSelected: boolean;
  };
}

export const EntityGraphNode: React.FC<EntityGraphNodeProps> = memo(({ data }) => {
  const { entity, isSelected } = data;
  const config = ENTITY_TYPE_CONFIGS.find((c) => c.type === entity.type);
  const nodeColor = config ? config.color : '#ea580c';
  const isWorking = entity.status === 'WORKING';
  const isCompacting = entity.status === 'COMPACTING';

  return (
    <div className="relative flex items-center group cursor-pointer select-none">
      {/* Target Connection Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-1.5 !h-1.5 !bg-transparent !border-none"
      />

      {/* Solid Dot Node */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing ring if WORKING or SELECTED */}
        {isSelected && (
          <div 
            className="absolute -inset-1.5 rounded-full opacity-60 animate-ping"
            style={{ backgroundColor: '#e11d48' }}
          />
        )}
        {isWorking && (
          <div 
            className="absolute -inset-2 rounded-full opacity-40 animate-pulse"
            style={{ backgroundColor: nodeColor }}
          />
        )}

        {/* Circular Solid Color Dot */}
        <div
          className={`rounded-full transition-transform duration-200 ${
            isSelected
              ? 'w-5 h-5 ring-2 ring-white shadow-[0_0_12px_rgba(225,29,72,0.8)] scale-110'
              : 'w-4 h-4 hover:scale-125'
          }`}
          style={{
            backgroundColor: isSelected ? '#e11d48' : nodeColor,
            border: isSelected ? '2px solid #ffffff' : '1.5px solid rgba(255,255,255,0.25)',
          }}
        />
      </div>

      {/* Node Label beside dot */}
      <div className="ml-2 flex flex-col">
        <span
          className={`text-[11px] font-medium leading-none tracking-tight transition-colors whitespace-nowrap ${
            isSelected
              ? 'text-[#ffffff] font-semibold underline decoration-[#e11d48] underline-offset-4'
              : 'text-[#e5e5e5] group-hover:text-[#ffffff]'
          }`}
        >
          {entity.name}
        </span>
        {entity.status !== 'IDLE' && (
          <span
            className={`text-[8px] font-mono mt-0.5 tracking-wider ${
              isWorking ? 'text-[#e11d48] animate-pulse font-bold' : isCompacting ? 'text-[#f59e0b]' : 'text-[#888888]'
            }`}
          >
            [{entity.status}]
          </span>
        )}
      </div>

      {/* Source Connection Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-1.5 !h-1.5 !bg-transparent !border-none"
      />
    </div>
  );
});
