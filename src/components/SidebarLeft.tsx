import React, { useState } from 'react';
import { useAxonStore } from '../store/axonStore';
import { 
  FolderGit2, 
  Search, 
  Layers, 
  HardDrive,
  RefreshCw
} from 'lucide-react';

export const SidebarLeft: React.FC = () => {
  const { projectName, sessions, setInspectedSession } = useAxonStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.worktree.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-64 bg-[#0b0f19] border-r border-[#1e293b] flex flex-col h-full select-none">
      {/* Brand & Project Header */}
      <div className="p-4 border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded bg-gradient-to-tr from-[#06b6d4] to-[#3b82f6] flex items-center justify-center font-bold text-xs tracking-wider text-black">
            AX
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-[#f8fafc]">AXON</h1>
            <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Neural Studio</p>
          </div>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e293b] text-[#06b6d4] font-mono border border-[#334155]">
          v1.0
        </span>
      </div>

      {/* Active Project Selector */}
      <div className="p-3 border-b border-[#1e293b] bg-[#090d16]">
        <div className="text-[10px] uppercase font-medium text-[#64748b] tracking-wider mb-1.5 flex items-center justify-between">
          <span>Active Repository</span>
          <FolderGit2 className="w-3 h-3 text-[#64748b]" />
        </div>
        <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded bg-[#0f172a] border border-[#1e293b] text-xs text-[#e2e8f0]">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span className="font-mono truncate">{projectName}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-[#1e293b]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search sessions or worktrees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f172a] border border-[#1e293b] rounded text-xs pl-8 pr-3 py-1.5 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#06b6d4]"
          />
        </div>
      </div>

      {/* Sessions Catalog */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 text-[10px] uppercase font-semibold text-[#64748b] tracking-wider flex items-center justify-between">
          <span>Network Nodes ({filteredSessions.length})</span>
          <Layers className="w-3 h-3 text-[#64748b]" />
        </div>

        {filteredSessions.map((session) => {
          const isWorking = session.status === 'WORKING';
          const isCompacting = session.status === 'COMPACTING';

          return (
            <div
              key={session.id}
              onClick={() => setInspectedSession(session.id)}
              className="group px-2.5 py-2 rounded border border-transparent hover:border-[#1e293b] hover:bg-[#0f172a] cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[#f8fafc] group-hover:text-[#06b6d4] truncate">
                  {session.name}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    isWorking
                      ? 'bg-[#06b6d4]/10 text-[#06b6d4] border-[#06b6d4]/30 animate-pulse'
                      : isCompacting
                      ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
                      : 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
                  }`}
                >
                  [{session.status}]
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#64748b] font-mono">
                <span className="truncate">{session.worktree}</span>
                <span>{((session.tokenUsed / session.tokenMax) * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#1e293b] bg-[#090d16] flex items-center justify-between text-xs text-[#64748b]">
        <div className="flex items-center space-x-2">
          <HardDrive className="w-3.5 h-3.5" />
          <span className="text-[11px]">Zero-Idle Active</span>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          title="Reload Visual Interface"
          className="p-1 rounded hover:bg-[#1e293b] text-[#94a3b8] hover:text-[#f8fafc]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
