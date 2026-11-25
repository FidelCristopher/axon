import React, { useState, useEffect } from 'react';
import { useAxonStore } from '../store/axonStore';
import initialPiSessions from '../data/piSessionsData.json';
import { 
  Search, 
  Plus,
  Pin,
  PinOff,
  Edit3,
  Trash2,
  Check,
  X
} from 'lucide-react';

interface PiSessionItem {
  id: string;
  fileName: string;
  name: string;
  category: string;
  cwd?: string;
  skills?: string[] | null;
  role: string;
  tokens: number;
  size: number;
  updatedAt: number;
  isPinned?: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  session: PiSessionItem | null;
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
  const { selectSessionTopology } = useAxonStore();

  const [sessions, setSessions] = useState<PiSessionItem[]>(() => {
    const pinnedRaw = localStorage.getItem('axon_pinned_sessions');
    const pinnedSet = new Set<string>(pinnedRaw ? JSON.parse(pinnedRaw) : []);
    return (initialPiSessions as PiSessionItem[]).map((s) => ({
      ...s,
      isPinned: pinnedSet.has(s.id),
    }));
  });

  // Load real live Pi sessions directly from ~/.pi/agent/sessions/ via Axon Pi Bridge
  useEffect(() => {
    fetch('http://127.0.0.1:1425/api/sessions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.sessions) && data.sessions.length > 0) {
          const pinnedRaw = localStorage.getItem('axon_pinned_sessions');
          const pinnedSet = new Set<string>(pinnedRaw ? JSON.parse(pinnedRaw) : []);
          setSessions(
            data.sessions.map((s: PiSessionItem) => ({
              ...s,
              isPinned: pinnedSet.has(s.id),
            }))
          );
        }
      })
      .catch(() => {
        // Fallback silently to initialPiSessions if bridge is offline
      });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionFile, setSelectedSessionFile] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionCwd, setNewSessionCwd] = useState('C:\\Users\\Pongo');

  // In-line Renaming State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Right-click Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    session: null,
  });

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleClick = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu((prev) => ({ ...prev, visible: false }));
        setIsAddingNew(false);
        setEditingSessionId(null);
      }
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, session: PiSessionItem) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent menu from overflowing window bottom
    const menuHeight = 130;
    const y = e.clientY + menuHeight > window.innerHeight ? e.clientY - menuHeight : e.clientY;

    setContextMenu({
      visible: true,
      x: e.clientX,
      y,
      session,
    });
  };

  const handleCreateNewSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;

    const title = newSessionTitle.trim();
    const cwdInput = newSessionCwd.trim() || 'C:\\Users\\Pongo';
    setNewSessionTitle('');
    setIsAddingNew(false);

    try {
      const res = await fetch('http://127.0.0.1:1425/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title, cwd: cwdInput }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.session) {
        const created: PiSessionItem = { ...data.session, isPinned: false };
        setSessions((prev) => [created, ...prev]);
        setSelectedSessionFile(created.id);
        selectSessionTopology(created);
        return;
      }
    } catch {
      // fallback to local creation if bridge unreachable
    }

    const newId = `session-${Date.now()}`;
    const newSession: PiSessionItem = {
      id: newId,
      fileName: `${newId}.jsonl`,
      name: title,
      category: 'Global / Home',
      role: '',
      tokens: 0,
      size: 1024,
      updatedAt: Date.now(),
      isPinned: false,
    };

    setSessions((prev) => [newSession, ...prev]);
    setSelectedSessionFile(newId);
  };

  const handleTogglePin = (session: PiSessionItem) => {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === session.id ? { ...s, isPinned: !s.isPinned } : s));
      const pinnedIds = next.filter((s) => s.isPinned).map((s) => s.id);
      localStorage.setItem('axon_pinned_sessions', JSON.stringify(pinnedIds));
      return next;
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleStartRename = (session: PiSessionItem) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.name);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleSaveRename = async (sessionId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingSessionId(null);
      return;
    }
    const target = sessions.find((s) => s.id === sessionId);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, name: trimmed } : s))
    );
    setEditingSessionId(null);

    try {
      await fetch('http://127.0.0.1:1425/api/sessions/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          fileName: target?.fileName,
          name: trimmed,
        }),
      });
    } catch {
      // ignore if offline
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setContextMenu((prev) => ({ ...prev, visible: false }));
    if (selectedSessionFile === sessionId) {
      setSelectedSessionFile(null);
    }

    try {
      await fetch('http://127.0.0.1:1425/api/sessions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          fileName: target?.fileName,
        }),
      });
    } catch {
      // ignore if offline
    }
  };

  // Filter and sort (Pinned sessions always appear on top)
  const filteredSessions = sessions
    .filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

  return (
    <aside className="w-72 shrink-0 bg-[#f8fafc] border-r border-[#e2e8f0] flex flex-col h-full select-none z-10 shadow-xs relative">
      {/* 1. Clean Minimal Header */}
      <div className="p-3.5 border-b border-[#e2e8f0] bg-[#ffffff] flex items-center justify-between">
        <span className="text-xs font-bold text-[#0f172a] font-mono">
          Sessions ({filteredSessions.length})
        </span>
        <button
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="p-1 rounded-md bg-[#e11d48]/10 hover:bg-[#e11d48]/20 border border-[#e11d48]/30 text-[#e11d48] transition-colors"
          title="Create New Session"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inline Input to Create New Session (Name + Windows/WSL Folder Path) */}
      {isAddingNew && (
        <form onSubmit={handleCreateNewSession} className="p-2.5 bg-[#ffffff] border-b border-[#e2e8f0] space-y-1.5 shadow-xs">
          <div className="flex items-center space-x-1.5">
            <input
              type="text"
              placeholder="New session name..."
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              className="flex-1 bg-[#f1f5f9] border border-[#cbd5e1] rounded-md text-xs px-2.5 py-1 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48] font-mono"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newSessionTitle.trim()}
              className="p-1 rounded-md bg-[#e11d48] text-white disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="p-1 rounded-md hover:bg-[#f1f5f9] text-[#64748b]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Folder path (e.g. C:\Users\Pongo\my-project)"
            value={newSessionCwd}
            onChange={(e) => setNewSessionCwd(e.target.value)}
            className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-md text-[11px] px-2.5 py-1 text-[#475569] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48] font-mono"
          />
        </form>
      )}

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

      {/* 3. Real 70+ Pi Sessions List with Right Click Support */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredSessions.map((session) => {
          const isSelected = selectedSessionFile === session.id;
          const isEditing = editingSessionId === session.id;
          const timeAgo = formatRelativeTime(session.updatedAt);

          return (
            <div
              key={session.id}
              onClick={() => {
                if (isEditing) return;
                setSelectedSessionFile(session.id);
                selectSessionTopology(session);
              }}
              onContextMenu={(e) => handleContextMenu(e, session)}
              className={`px-3 py-2 rounded-md border cursor-pointer transition-all relative group ${
                isSelected
                  ? 'bg-[#ffffff] border-[#e11d48] shadow-xs'
                  : 'bg-[#ffffff] border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
              } ${session.isPinned ? 'ring-1 ring-[#e11d48]/40' : ''}`}
            >
              {isEditing ? (
                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="flex-1 bg-[#f1f5f9] border border-[#e11d48] rounded px-1.5 py-0.5 text-xs text-[#0f172a] font-mono focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(session.id);
                      if (e.key === 'Escape') setEditingSessionId(null);
                    }}
                  />
                  <button
                    onClick={() => handleSaveRename(session.id)}
                    className="p-1 text-[#e11d48] hover:bg-[#f1f5f9] rounded"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingSessionId(null)}
                    className="p-1 text-[#64748b] hover:bg-[#f1f5f9] rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex items-center space-x-1.5 truncate">
                      {session.isPinned && (
                        <Pin className="w-3 h-3 text-[#e11d48] shrink-0 fill-[#e11d48]" />
                      )}
                      <span
                        className={`text-xs font-semibold leading-tight line-clamp-1 truncate ${
                          isSelected ? 'text-[#e11d48]' : 'text-[#0f172a]'
                        }`}
                        title={session.name}
                      >
                        {session.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#64748b] shrink-0 font-medium">
                      {timeAgo}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#64748b] font-mono">
                    <span className="truncate text-[#475569]">{session.category}</span>
                    <span>{(session.size / 1024).toFixed(0)} KB</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Custom Right-Click Context Menu (Floating) */}
      {contextMenu.visible && contextMenu.session && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-44 bg-[#ffffff] border border-[#e2e8f0] rounded-md shadow-xl p-1 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-mono text-[#94a3b8] uppercase border-b border-[#f1f5f9] truncate mb-0.5">
            {contextMenu.session.name}
          </div>

          {/* Pin / Unpin */}
          <button
            onClick={() => handleTogglePin(contextMenu.session!)}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded hover:bg-[#f1f5f9] text-[#0f172a] transition-colors text-left"
          >
            {contextMenu.session.isPinned ? (
              <>
                <PinOff className="w-3.5 h-3.5 text-[#64748b]" />
                <span>Unpin Session</span>
              </>
            ) : (
              <>
                <Pin className="w-3.5 h-3.5 text-[#e11d48]" />
                <span>Pin to Top</span>
              </>
            )}
          </button>

          {/* Rename */}
          <button
            onClick={() => handleStartRename(contextMenu.session!)}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded hover:bg-[#f1f5f9] text-[#0f172a] transition-colors text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>Rename Session</span>
          </button>

          {/* Delete */}
          <button
            onClick={() => handleDeleteSession(contextMenu.session!.id)}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded hover:bg-[#fee2e2] text-[#ef4444] transition-colors text-left border-t border-[#f1f5f9] mt-0.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
            <span>Delete Session</span>
          </button>
        </div>
      )}
    </aside>
  );
};
