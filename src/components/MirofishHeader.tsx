import React from 'react';
import { useAxonStore } from '../store/axonStore';
import { RotateCcw, Maximize, ToggleLeft, ToggleRight } from 'lucide-react';

export const MirofishHeader: React.FC = () => {
  const { 
    activeViewTab, 
    setActiveViewTab, 
    showEdgeLabels, 
    setShowEdgeLabels 
  } = useAxonStore();

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-14 bg-[#000000] border-b border-[#1a1a1a] px-6 flex items-center justify-between select-none z-20">
      {/* MiroFish Style Brand Title */}
      <div className="flex items-center space-x-3">
        <h1 className="text-base font-black tracking-widest text-[#f5f5f5] uppercase font-mono">
          AXON
        </h1>
        <span className="text-[10px] font-mono text-[#555555] px-2 py-0.5 border border-[#222222] rounded bg-[#0a0a0a]">
          MiroFish Graph v1.0
        </span>
      </div>

      {/* Segmented View Mode Tabs: [Graph] [Split] [Workbench] */}
      <div className="flex items-center bg-[#0a0a0a] p-1 rounded-md border border-[#222222]">
        <button
          onClick={() => setActiveViewTab('graph')}
          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
            activeViewTab === 'graph'
              ? 'bg-[#1f1f1f] text-[#ffffff] shadow-sm'
              : 'text-[#777777] hover:text-[#cccccc]'
          }`}
        >
          Graph
        </button>
        <button
          onClick={() => setActiveViewTab('split')}
          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
            activeViewTab === 'split'
              ? 'bg-[#1f1f1f] text-[#ffffff] shadow-sm'
              : 'text-[#777777] hover:text-[#cccccc]'
          }`}
        >
          Split
        </button>
        <button
          onClick={() => setActiveViewTab('workbench')}
          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
            activeViewTab === 'workbench'
              ? 'bg-[#1f1f1f] text-[#ffffff] shadow-sm'
              : 'text-[#777777] hover:text-[#cccccc]'
          }`}
        >
          Workbench
        </button>
      </div>

      {/* Controls: Show Edge Labels, Refresh, Fullscreen */}
      <div className="flex items-center space-x-3 text-xs">
        {/* Toggle Switch: Show Edge Labels */}
        <div
          onClick={() => setShowEdgeLabels(!showEdgeLabels)}
          className="flex items-center space-x-2 cursor-pointer bg-[#0a0a0a] border border-[#222222] px-3 py-1.5 rounded-md hover:border-[#333333] transition-colors"
        >
          {showEdgeLabels ? (
            <ToggleRight className="w-4 h-4 text-[#e11d48]" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-[#555555]" />
          )}
          <span className="text-[11px] text-[#aaaaaa]">Show Edge Labels</span>
        </div>

        {/* Refresh Graph */}
        <button
          onClick={() => window.location.reload()}
          className="flex items-center space-x-1.5 bg-[#0a0a0a] border border-[#222222] px-3 py-1.5 rounded-md text-[#aaaaaa] hover:text-[#ffffff] hover:border-[#333333] transition-colors"
          title="Refresh Network Graph"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="text-[11px]">Refresh</span>
        </button>

        {/* Fullscreen */}
        <button
          onClick={handleFullscreen}
          className="bg-[#0a0a0a] border border-[#222222] p-1.5 rounded-md text-[#aaaaaa] hover:text-[#ffffff] hover:border-[#333333] transition-colors"
          title="Toggle Fullscreen"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
