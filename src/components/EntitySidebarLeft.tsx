import React, { useState } from 'react';
import { useAxonStore } from '../store/axonStore';
import piSessions from '../data/piSessionsData.json';
import { 
  Search, 
  HardDrive,
  RefreshCw,
  Terminal
} from 'lucide-react';

interface PiSessionItem {
  id: string;
  fileName: string;
  name: string;
  category: string;
  role: string;
  tokens: number;
  size: number;
  updatedAt: number;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export const EntitySidebarLeft: React.FC = () => {
  const { 
    setSelectedEntityId 
  } = useAxonStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionFile, setSelectedSessionFile] = useState<string>(piSessions[0]?.id || '');

  const sessionList = (piSessions as PiSessionItem[]).filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-72 shrink-0 bg-[#f8fafc] border-r border-[#e2e8f0] flex flex-col h-full select-none z-10 shadow-xs">
      {/* 1. Header: Pi Workstation Catalog */}
      <div className="p-3.5 border-b border-[#e2e8f0] bg-[#ffffff]">
        <div className="text-[10px] uppercase font-mono font-bold text-[#64748b] tracking-wider mb-1 flex items-center justify-between">
          <span>Pi Session Database</span>
          <Terminal className="w-3.5 h-3.5 text-[#e11d48]" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#0f172a] font-mono">
            {sessionList.length} Sessions Loaded
          </span>
          <span className="text-[10px] font-mono text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded border border-[#e2e8f0]">
            Disk Sync
          </span>
        </div>
      </div>

      {/* 2. Search Box */}
      <div className="p-3 border-b border-[#e2e8f0] bg-[#ffffff]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search 70+ Pi sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f1f5f9] border border-[#e2e8f0] rounded-md text-xs pl-8 pr-3 py-1.5 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48] focus:bg-[#ffffff] font-mono transition-colors"
          />
        </div>
      </div>

      {/* 3. Real 70+ Pi Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessionList.map((session) => {
          const isSelected = selectedSessionFile === session.id;
          const timeAgo = formatRelativeTime(session.updatedAt);

          return (
            <div
              key={session.id}
              onClick={() => {
                setSelectedSessionFile(session.id);
                // Highlight or connect in graph if matched
                if (session.name.toLowerCase().includes('dev 1') || session.name.toLowerCase().includes('part1')) {
                  setSelectedEntityId('node-dev-1');
                } else if (session.name.toLowerCase().includes('dev 2') || session.name.toLowerCase().includes('part2')) {
                  setSelectedEntityId('node-dev-2');
                } else if (session.name.toLowerCase().includes('designer') || session.name.toLowerCase().includes('asset')) {
                  setSelectedEntityId('node-designer');
                } else if (session.name.toLowerCase().includes('qa')) {
                  setSelectedEntityId('node-qa');
                } else {
                  setSelectedEntityId('hub-main');
                }
              }}
              className={`px-3 py-2 rounded-md border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#ffffff] border-[#e11d48] shadow-xs'
                  : 'bg-[#ffffff] border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span
                  className={`text-xs font-semibold leading-tight line-clamp-1 truncate ${
                    isSelected ? 'text-[#e11d48]' : 'text-[#0f172a]'
                  }`}
                  title={session.name}
                >
                  {session.name}
                </span>
                <span className="text-[10px] font-mono text-[#64748b] shrink-0 font-medium">
                  {timeAgo}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#64748b] font-mono">
                <span className="truncate text-[#475569]">{session.category}</span>
                <span>{(session.size / 1024).toFixed(0)} KB</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Footer */}
      <div className="p-3 border-t border-[#e2e8f0] bg-[#ffffff] flex items-center justify-between text-xs text-[#64748b]">
        <div className="flex items-center space-x-2">
          <HardDrive className="w-3.5 h-3.5 text-[#64748b]" />
          <span className="text-[11px] font-mono font-medium">~/.pi/agent/sessions</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          title="Reload Sessions"
          className="p-1 rounded-md hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
