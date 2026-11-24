import React from 'react';
import { useAxonStore } from '../store/axonStore';
import { RotateCcw, Maximize } from 'lucide-react';

export const EntityGraphHeader: React.FC = () => {
  const { 
    activeViewTab, 
    setActiveViewTab 
  } = useAxonStore();

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-14 bg-[#ffffff] border-b border-[#e2e8f0] px-6 flex items-center justify-between select-none z-20 shadow-xs">
      {/* Brand Title */}
      <div className="flex items-center space-x-3">
        <h1 className="text-base font-black tracking-widest text-[#0f172a] uppercase font-mono">
          AXON
        </h1>
      </div>

      {/* Segmented View Mode Tabs: [Graph] [Split] [Workbench] */}
      <div className="flex items-center bg-[#f1f5f9] p-1 rounded-md border border-[#e2e8f0]">
        <button
          onClick={() => setActiveViewTab('graph')}
          className={`px-3.5 py-1 rounded text-xs font-semibold transition-all ${
            activeViewTab === 'graph'
              ? 'bg-[#ffffff] text-[#0f172a] shadow-xs'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          Graph
        </button>
        <button
          onClick={() => setActiveViewTab('split')}
          className={`px-3.5 py-1 rounded text-xs font-semibold transition-all ${
            activeViewTab === 'split'
              ? 'bg-[#ffffff] text-[#0f172a] shadow-xs'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          Split
        </button>
        <button
          onClick={() => setActiveViewTab('workbench')}
          className={`px-3.5 py-1 rounded text-xs font-semibold transition-all ${
            activeViewTab === 'workbench'
              ? 'bg-[#ffffff] text-[#0f172a] shadow-xs'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          Workbench
        </button>
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
