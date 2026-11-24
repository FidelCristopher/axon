import React from 'react';
import { RotateCcw, Maximize } from 'lucide-react';
import { useAxonStore } from '../store/axonStore';

export const EntityGraphHeader: React.FC = () => {
  const { projectName } = useAxonStore();

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-14 bg-[#ffffff] border-b border-[#e2e8f0] px-6 flex items-center justify-between select-none z-20 shadow-xs">
      {/* Brand Title & Active Session Project Identifier */}
      <div className="flex items-center space-x-2.5">
        <h1 className="text-base font-black tracking-widest text-[#0f172a] uppercase font-mono">
          AXON
        </h1>
        <span className="text-[#cbd5e1] font-mono text-xs">/</span>
        <span className="text-xs font-bold text-[#e11d48] font-mono bg-[#e11d48]/10 px-2.5 py-0.5 rounded border border-[#e11d48]/20 truncate max-w-[320px]">
          {projectName}
        </span>
      </div>

      {/* Controls: Refresh & Fullscreen */}
      <div className="flex items-center space-x-2 text-xs">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center space-x-1.5 bg-[#ffffff] border border-[#e2e8f0] px-3 py-1.5 rounded-md text-[#64748b] hover:text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] shadow-xs transition-colors"
          title="Refresh Network Graph"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#64748b]" />
          <span className="text-[11px] font-medium">Refresh</span>
        </button>

        <button
          onClick={handleFullscreen}
          className="bg-[#ffffff] border border-[#e2e8f0] p-1.5 rounded-md text-[#64748b] hover:text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] shadow-xs transition-colors"
          title="Toggle Fullscreen"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
