import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { GraphEntity } from '../types/axon';
import { ENTITY_TYPE_CONFIGS, useAxonStore } from '../store/axonStore';

interface EntityGraphNodeProps {
  data: {
    entity: GraphEntity;
    isSelected: boolean;
  };
}

export const EntityGraphNode: React.FC<EntityGraphNodeProps> = memo(({ data }) => {
  const { entity, isSelected } = data;
  const { setSelectedEntityId, setIsTerminalModalOpen } = useAxonStore();
  const config = ENTITY_TYPE_CONFIGS.find((c) => c.type === entity.type);
  const isHub = entity.type === 'hub';
  const nodeColor = isHub ? '#e11d48' : (config ? config.color : '#ea580c');
  const isWorking = !isHub && entity.status === 'WORKING';
  const isCompacting = !isHub && entity.status === 'COMPACTING';

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        setSelectedEntityId(entity.id);
        if (!isHub) {
          setIsTerminalModalOpen(true);
        }
      }}
      className="relative flex items-center group cursor-pointer select-none"
    >
      {!isHub && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-1.5 !h-1.5 !bg-transparent !border-none"
        />
      )}

      {/* Solid Circular Dot Node */}
      <div className="relative flex items-center justify-center">
        {(isSelected || isHub) && (
          <div 
            className={`absolute -inset-1.5 rounded-full ${isHub ? 'opacity-25' : 'opacity-40 animate-ping'}`}
            style={{ backgroundColor: '#e11d48' }}
          />
        )}
        {isWorking && (
          <div 
            className="absolute -inset-2 rounded-full opacity-35 animate-pulse"
            style={{ backgroundColor: nodeColor }}
          />
        )}

        {/* Circular Solid Color Dot */}
        <div
          className={`rounded-full transition-transform duration-200 ${
            isHub
              ? 'w-6 h-6 ring-2 ring-[#e11d48]/40 shadow-[0_2px_10px_rgba(225,29,72,0.45)]'
              : isSelected
              ? 'w-5 h-5 ring-2 ring-[#e11d48] shadow-[0_2px_8px_rgba(225,29,72,0.4)] scale-110'
              : 'w-4 h-4 hover:scale-125 shadow-sm'
          }`}
          style={{
            backgroundColor: isHub || isSelected ? '#e11d48' : nodeColor,
            border: isHub || isSelected ? '2px solid #ffffff' : '1.5px solid #ffffff',
          }}
        />
      </div>

      {/* Node Label beside dot */}
      <div className="ml-2.5 flex flex-col">
        <span
          className={`leading-tight tracking-tight transition-colors whitespace-nowrap ${
            isHub
              ? 'text-[13px] font-bold text-[#0f172a]'
              : isSelected
              ? 'text-[12px] text-[#0f172a] font-bold underline decoration-[#e11d48] underline-offset-4'
              : 'text-[12px] font-medium text-[#334155] group-hover:text-[#0f172a]'
          }`}
        >
          {entity.name}
        </span>
        {isHub && (
          <span className="text-[9.5px] font-mono uppercase tracking-wider text-[#94a3b8]">
            Session Hub
          </span>
        )}
        {entity.status !== 'IDLE' && (
          <span
            className={`text-[9px] font-mono mt-0.5 tracking-wider font-semibold ${
              isWorking ? 'text-[#e11d48] animate-pulse' : isCompacting ? 'text-[#f59e0b]' : 'text-[#64748b]'
            }`}
          >
            [{entity.status}]
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-1.5 !h-1.5 !bg-transparent !border-none"
      />
    </div>
  );
});
