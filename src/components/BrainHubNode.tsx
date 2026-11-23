import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useAxonStore } from '../store/axonStore';
import { Brain, Radio } from 'lucide-react';

export const BrainHubNode: React.FC = memo(() => {
  const { projectName, sessions, setGlobalDirectiveOpen } = useAxonStore();
  const activeWorkingCount = sessions.filter(s => s.status === 'WORKING').length;

  return (
    <div 
      onClick={() => setGlobalDirectiveOpen(true)}
      className="group relative flex flex-col items-center cursor-pointer select-none"
      title="Click to broadcast Global Directive to all branches"
    >
      {/* Top Directive Badge */}
      <div className="mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50 shadow-sm flex items-center space-x-1.5">
          <Radio className="w-2.5 h-2.5 animate-pulse text-[#3b82f6]" />
          <span>BRAIN HUB</span>
        </span>
      </div>

      {/* Center Brain Core */}
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#090d16] via-[#0f172a] to-[#1e293b] border-2 border-[#3b82f6] shadow-[0_0_24px_rgba(59,130,246,0.35)] flex items-center justify-center group-hover:border-[#06b6d4] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all">
        {/* Animated Synapse Core Glow */}
        <div className="absolute inset-0 rounded-full bg-[#3b82f6]/10 animate-ping opacity-25" />
        <Brain className="w-9 h-9 text-[#60a5fa] group-hover:text-[#06b6d4] transition-colors" />
      </div>

      {/* Hub Metadata */}
      <div className="mt-2 text-center">
        <div className="text-xs font-bold text-[#f8fafc] tracking-wide">
          {projectName}
        </div>
        <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">
          {activeWorkingCount > 0 ? (
            <span className="text-[#06b6d4] font-semibold">{activeWorkingCount} Active Branches</span>
          ) : (
            <span>All Branches Idle</span>
          )}
        </div>
      </div>

      {/* Output Handles branching to peer nodes */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#3b82f6] !border-none"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!w-2.5 !h-2.5 !bg-[#3b82f6] !border-none"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2.5 !h-2.5 !bg-[#3b82f6] !border-none"
      />
    </div>
  );
});
