import React, { useState } from 'react';
import { useAxonStore } from '../store/axonStore';
import { 
  FolderGit2, 
  Search, 
  Layers, 
  HardDrive,
  RefreshCw
} from 'lucide-react';

export const EntitySidebarLeft: React.FC = () => {
  const { 
    projectName, 
    entities, 
    selectedEntityId, 
    setSelectedEntityId 
  } = useAxonStore();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntities = entities.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.worktree.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-64 shrink-0 bg-[#080808] border-r border-[#1a1a1a] flex flex-col h-full select-none z-10">
      {/* Active Repository Card */}
      <div className="p-3.5 border-b border-[#1a1a1a] bg-[#000000]">
        <div className="text-[10px] uppercase font-mono font-semibold text-[#666666] tracking-wider mb-1.5 flex items-center justify-between">
          <span>Active Repository</span>
          <FolderGit2 className="w-3 h-3 text-[#666666]" />
        </div>
        <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded bg-[#0a0a0a] border border-[#1f1f1f] text-xs text-[#f5f5f5]">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span className="font-mono truncate">{projectName}</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-[#1a1a1a] bg-[#000000]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#555555] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search entities or worktrees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded text-xs pl-8 pr-3 py-1.5 text-[#f5f5f5] placeholder-[#555555] focus:outline-none focus:border-[#e11d48] font-mono"
          />
        </div>
      </div>

      {/* Entity Nodes Catalog List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1.5 text-[10px] uppercase font-mono font-semibold text-[#666666] tracking-wider flex items-center justify-between">
          <span>Network Nodes ({filteredEntities.length})</span>
          <Layers className="w-3 h-3 text-[#666666]" />
        </div>

        {filteredEntities.map((entity) => {
          const isSelected = entity.id === selectedEntityId;
          const isWorking = entity.status === 'WORKING';
          const isCompacting = entity.status === 'COMPACTING';

          return (
            <div
              key={entity.id}
              onClick={() => setSelectedEntityId(entity.id)}
              className={`px-2.5 py-2 rounded border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#141414] border-[#e11d48] shadow-sm'
                  : 'bg-[#000000] border-transparent hover:border-[#1f1f1f] hover:bg-[#0c0c0c]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium truncate ${
                    isSelected ? 'text-[#ffffff] font-semibold' : 'text-[#d5d5d5]'
                  }`}
                >
                  {entity.name}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                    isWorking
                      ? 'bg-[#e11d48]/20 text-[#e11d48] border-[#e11d48]/50 animate-pulse font-bold'
                      : isCompacting
                      ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/50'
                      : 'bg-[#141414] text-[#777777] border-[#222222]'
                  }`}
                >
                  [{entity.status}]
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#666666] font-mono">
                <span className="truncate">{entity.worktree}</span>
                <span>{((entity.tokenUsed / entity.tokenMax) * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#1a1a1a] bg-[#000000] flex items-center justify-between text-xs text-[#666666]">
        <div className="flex items-center space-x-2">
          <HardDrive className="w-3.5 h-3.5 text-[#555555]" />
          <span className="text-[11px] font-mono">Zero-Idle Active</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          title="Reload View"
          className="p-1 rounded hover:bg-[#141414] text-[#777777] hover:text-[#ffffff] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
