import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { AgentSession } from '../types/axon';
import { useAxonStore } from '../store/axonStore';
import { Terminal, Cpu, GitBranch } from 'lucide-react';

interface NeuralNodeProps {
  data: {
    session: AgentSession;
  };
}

export const NeuralNode: React.FC<NeuralNodeProps> = memo(({ data }) => {
  const { session } = data;
  const { setInspectedSession } = useAxonStore();

  const isWorking = session.status === 'WORKING';
  const isCompacting = session.status === 'COMPACTING';
  const tokenPercent = Math.min(100, Math.round((session.tokenUsed / session.tokenMax) * 100));

  // Gauge Ring Calculation
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (tokenPercent / 100) * circumference;

  let gaugeColor = '#10b981'; // Green
  if (tokenPercent >= 80) gaugeColor = '#ef4444'; // Red
  else if (tokenPercent >= 50) gaugeColor = '#f59e0b'; // Amber

  return (
    <div 
      onClick={() => setInspectedSession(session.id)}
      className="group relative flex flex-col items-center cursor-pointer select-none"
    >
      {/* Target Handle from Brain Hub */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-[#06b6d4] !border-none"
      />

      {/* Top Status Indicator Badge */}
      <div className="mb-2">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm transition-all ${
            isWorking
              ? 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4] shadow-[#06b6d4]/30 animate-pulse font-bold'
              : isCompacting
              ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b] animate-bounce'
              : 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
          }`}
        >
          [{session.status}]
        </span>
      </div>

      {/* Main Node Body with Circular Token Gauge */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* SVG Circular Progress Ring */}
        <svg className="absolute w-16 h-16 -rotate-90 transform" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="stroke-[#1e293b]"
            strokeWidth="3.5"
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={gaugeColor}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Node Core */}
        <div 
          className={`w-11 h-11 rounded-full bg-[#0f172a] border flex items-center justify-center transition-all ${
            isWorking
              ? 'border-[#06b6d4] shadow-[0_0_18px_rgba(6,182,212,0.45)]'
              : 'border-[#334155] group-hover:border-[#06b6d4]/60'
          }`}
        >
          <Cpu className={`w-5 h-5 ${isWorking ? 'text-[#06b6d4] animate-pulse' : 'text-[#94a3b8]'}`} />
        </div>
      </div>

      {/* Node Metadata Card */}
      <div className="mt-2 text-center max-w-[130px]">
        <div className="text-xs font-semibold text-[#f8fafc] group-hover:text-[#06b6d4] transition-colors truncate">
          {session.name}
        </div>
        <div className="flex items-center justify-center space-x-1 text-[10px] text-[#64748b] font-mono mt-0.5">
          <GitBranch className="w-2.5 h-2.5" />
          <span className="truncate">{session.worktree}</span>
        </div>
        <div className="text-[9px] text-[#06b6d4] font-mono mt-0.5">
          {tokenPercent}% mem ({((session.tokenUsed) / 1000).toFixed(0)}k)
        </div>
      </div>

      {/* Quick Terminal Peek Icon on Hover */}
      <div className="absolute -right-2 top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1e293b] p-1 rounded-full border border-[#334155] text-[#06b6d4] shadow-md">
        <Terminal className="w-3 h-3" />
      </div>

      {/* Source Handle to Peer Nodes */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-[#06b6d4] !border-none"
      />
    </div>
  );
});
