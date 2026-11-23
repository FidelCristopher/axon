import React from 'react';
import { ENTITY_TYPE_CONFIGS } from '../store/axonStore';

export const EntityLegend: React.FC = () => {
  return (
    <div className="absolute bottom-6 left-6 z-10 bg-[#0a0a0a]/90 backdrop-blur-md border border-[#1f1f1f] rounded-lg p-3.5 shadow-2xl select-none min-w-[200px]">
      <div className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#e11d48] mb-2.5">
        ENTITY TYPES
      </div>
      <div className="space-y-1.5">
        {ENTITY_TYPE_CONFIGS.map((config) => (
          <div key={config.type} className="flex items-center space-x-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-[#cccccc] text-[11px] font-mono tracking-tight">
              {config.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
