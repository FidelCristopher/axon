import React, { useState } from 'react';
import { useAxonStore, PROJECT_WORKSPACES } from '../store/axonStore';
import { 
  FolderGit2, 
  Search, 
  Layers, 
  HardDrive,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

export const EntitySidebarLeft: React.FC = () => {
  const { 
    activeProjectId,
    switchProject,
    entities, 
    selectedEntityId, 
    setSelectedEntityId 
  } = useAxonStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  const activeProject = PROJECT_WORKSPACES.find((p) => p.id === activeProjectId) || PROJECT_WORKSPACES[0];

  const filteredEntities = entities.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.worktree.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-64 shrink-0 bg-[#f8fafc] border-r border-[#e2e8f0] flex flex-col h-full select-none z-10 shadow-xs">
      {/* 1. Project Switcher (Isolated Repositories) */}
      <div className="p-3.5 border-b border-[#e2e8f0] bg-[#ffffff] relative">
        <div className="text-[10px] uppercase font-mono font-bold text-[#64748b] tracking-wider mb-1.5 flex items-center justify-between">
          <span>Active Project Workspace</span>
          <FolderGit2 className="w-3.5 h-3.5 text-[#64748b]" />
        </div>

        <button
          onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#f1f5f9] border border-[#e2e8f0] hover:border-[#cbd5e1] text-xs text-[#0f172a] font-medium transition-colors"
        >
          <div className="flex items-center space-x-2 truncate">
            <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
            <span className="font-mono font-semibold truncate">{activeProject.name}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748b] shrink-0" />
        </button>

        {/* Dropdown Menu to Switch Projects */}
        {isProjectDropdownOpen && (
          <div className="absolute top-[68px] left-3 right-3 bg-[#ffffff] border border-[#e2e8f0] rounded-md shadow-xl z-30 p-1 space-y-0.5">
            {PROJECT_WORKSPACES.map((proj) => (
              <div
                key={proj.id}
                onClick={() => {
                  switchProject(proj.id);
                  setIsProjectDropdownOpen(false);
                }}
                className={`px-2.5 py-1.5 rounded text-xs cursor-pointer flex items-center justify-between ${
                  proj.id === activeProjectId
                    ? 'bg-[#e11d48]/10 text-[#e11d48] font-bold'
                    : 'text-[#334155] hover:bg-[#f1f5f9]'
                }`}
              >
                <span className="truncate">{proj.name}</span>
                <span className="text-[10px] font-mono text-[#64748b]">{proj.entities.length} nodes</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Search Input */}
      <div className="p-3 border-b border-[#e2e8f0] bg-[#ffffff]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search nodes or worktrees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f1f5f9] border border-[#e2e8f0] rounded-md text-xs pl-8 pr-3 py-1.5 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48] focus:bg-[#ffffff] font-mono transition-colors"
          />
        </div>
      </div>

      {/* 3. Entity Nodes Catalog List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1.5 text-[10px] uppercase font-mono font-bold text-[#64748b] tracking-wider flex items-center justify-between">
          <span>Workspace Nodes ({filteredEntities.length})</span>
          <Layers className="w-3.5 h-3.5 text-[#64748b]" />
        </div>

        {filteredEntities.map((entity) => {
          const isSelected = entity.id === selectedEntityId;
          const isWorking = entity.status === 'WORKING';
          const isCompacting = entity.status === 'COMPACTING';

          return (
            <div
              key={entity.id}
              onClick={() => setSelectedEntityId(entity.id)}
              className={`px-2.5 py-2 rounded-md border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#ffffff] border-[#e11d48] shadow-xs'
                  : 'bg-[#ffffff] border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold truncate ${
                    isSelected ? 'text-[#e11d48]' : 'text-[#1e293b]'
                  }`}
                >
                  {entity.name}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                    isWorking
                      ? 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/40 animate-pulse font-bold'
                      : isCompacting
                      ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/40'
                      : 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]'
                  }`}
                >
                  [{entity.status}]
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#64748b] font-mono">
                <span className="truncate">{entity.worktree}</span>
                <span>{((entity.tokenUsed / entity.tokenMax) * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Footer Info */}
      <div className="p-3 border-t border-[#e2e8f0] bg-[#ffffff] flex items-center justify-between text-xs text-[#64748b]">
        <div className="flex items-center space-x-2">
          <HardDrive className="w-3.5 h-3.5 text-[#64748b]" />
          <span className="text-[11px] font-mono font-medium">Zero-Idle Protocol</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          title="Reload View"
          className="p-1 rounded-md hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
