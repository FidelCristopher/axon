import React, { useState } from 'react';
import { useAxonStore } from '../store/axonStore';
import type { GraphEntity } from '../types/axon';
import { 
  Terminal, 
  Scissors, 
  Plus, 
  Send, 
  GitBranch, 
  Hash, 
  Clock, 
  Layers,
  Sparkles,
  Trash2
} from 'lucide-react';

export const NodeDetailSidebar: React.FC = () => {
  const { 
    entities, 
    selectedEntityId, 
    setIsTerminalModalOpen,
    compactEntityMemory,
    compactAllEntities,
    addEntity,
    removeEntity,
    dispatchTaskToEntity
  } = useAxonStore();

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState<GraphEntity['type']>('dev');
  const [newEntityWorktree, setNewEntityWorktree] = useState('feat/new-task');
  const [taskPrompt, setTaskPrompt] = useState('');

  const entity = entities.find((e) => e.id === selectedEntityId) || entities[0];
  if (!entity) return null;

  const tokenPercent = Math.min(100, Math.round((entity.tokenUsed / entity.tokenMax) * 100));
  const isWorking = entity.status === 'WORKING';
  const isCompacting = entity.status === 'COMPACTING';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityName.trim()) return;
    addEntity(newEntityName, newEntityType, newEntityWorktree);
    setNewEntityName('');
    setIsAddFormOpen(false);
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) return;
    dispatchTaskToEntity(entity.id, taskPrompt.trim());
    setTaskPrompt('');
  };

  return (
    <aside className="w-96 bg-[#0a0a0a] border-l border-[#1a1a1a] flex flex-col h-full select-none text-xs z-10">
      {/* MiroFish Style Right Sidebar Header: Node Details / 노드 상세 */}
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#000000]">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-sm tracking-tight text-[#ffffff]">
            Node Details
          </span>
          <span
            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
              isWorking
                ? 'bg-[#e11d48]/20 text-[#e11d48] border-[#e11d48]/50 animate-pulse font-bold'
                : isCompacting
                ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/50'
                : 'bg-[#141414] text-[#888888] border-[#222222]'
            }`}
          >
            [{entity.status}]
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsAddFormOpen(!isAddFormOpen)}
            className="p-1 rounded hover:bg-[#1a1a1a] text-[#888888] hover:text-[#ffffff] transition-colors"
            title="Add New Entity Node"
          >
            <Plus className="w-4 h-4 text-[#e11d48]" />
          </button>
          {entity.id !== 'hub-main' && (
            <button
              onClick={() => removeEntity(entity.id)}
              className="p-1 rounded hover:bg-[#1a1a1a] text-[#888888] hover:text-[#ef4444] transition-colors"
              title="Delete Entity Node"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Create Form */}
      {isAddFormOpen && (
        <form onSubmit={handleCreate} className="p-3 bg-[#111111] border-b border-[#222222] space-y-2">
          <div className="text-[10px] font-mono font-bold text-[#e11d48] uppercase">
            Create Entity Node
          </div>
          <input
            type="text"
            placeholder="Entity Name (e.g., Dev 3 - Audio)"
            value={newEntityName}
            onChange={(e) => setNewEntityName(e.target.value)}
            className="w-full bg-[#000000] border border-[#222222] rounded px-2.5 py-1 text-xs text-[#ffffff] focus:outline-none focus:border-[#e11d48]"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newEntityType}
              onChange={(e) => setNewEntityType(e.target.value as GraphEntity['type'])}
              className="bg-[#000000] border border-[#222222] rounded px-2 py-1 text-xs text-[#ffffff] focus:outline-none focus:border-[#e11d48]"
            >
              <option value="dev">Type: Developer</option>
              <option value="qa">Type: QA Auditor</option>
              <option value="designer">Type: Designer</option>
              <option value="skill">Type: Skill</option>
            </select>
            <input
              type="text"
              placeholder="Worktree (e.g. feat/audio)"
              value={newEntityWorktree}
              onChange={(e) => setNewEntityWorktree(e.target.value)}
              className="bg-[#000000] border border-[#222222] rounded px-2 py-1 text-xs text-[#ffffff] focus:outline-none focus:border-[#e11d48]"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddFormOpen(false)}
              className="px-2.5 py-1 rounded text-xs text-[#777777] hover:text-[#ffffff]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-[#ffffff]"
            >
              Spawn Node
            </button>
          </div>
        </form>
      )}

      {/* MiroFish Fields Layout */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name / 이름 */}
        <div>
          <div className="text-[10px] font-mono text-[#666666] uppercase mb-1">
            Name (이름)
          </div>
          <div className="text-sm font-bold text-[#ffffff] tracking-tight">
            {entity.name}
          </div>
        </div>

        {/* UUID */}
        <div>
          <div className="text-[10px] font-mono text-[#666666] uppercase mb-1 flex items-center space-x-1">
            <Hash className="w-3 h-3 text-[#555555]" />
            <span>UUID</span>
          </div>
          <div className="font-mono text-[11px] text-[#aaaaaa] bg-[#000000] p-2 rounded border border-[#1f1f1f] break-all select-all">
            {entity.uuid}
          </div>
        </div>

        {/* Worktree / Branch */}
        <div>
          <div className="text-[10px] font-mono text-[#666666] uppercase mb-1 flex items-center space-x-1">
            <GitBranch className="w-3 h-3 text-[#555555]" />
            <span>Worktree Branch</span>
          </div>
          <div className="font-mono text-xs text-[#ffffff] bg-[#000000] px-2.5 py-1.5 rounded border border-[#1f1f1f]">
            {entity.worktree}
          </div>
        </div>

        {/* Created Date / 생성일 */}
        <div>
          <div className="text-[10px] font-mono text-[#666666] uppercase mb-1 flex items-center space-x-1">
            <Clock className="w-3 h-3 text-[#555555]" />
            <span>Created (생성일)</span>
          </div>
          <div className="font-mono text-xs text-[#888888]">
            {entity.createdAt}
          </div>
        </div>

        {/* Token Memory Footprint */}
        <div>
          <div className="text-[10px] font-mono text-[#666666] uppercase mb-1 flex items-center justify-between">
            <span>Memory Capacity ({tokenPercent}%)</span>
            <span className="text-[#888888]">{((entity.tokenUsed) / 1000).toFixed(0)}k / 1.0M</span>
          </div>
          <div className="w-full h-1.5 bg-[#141414] rounded-full overflow-hidden border border-[#222222]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${tokenPercent}%`,
                backgroundColor: tokenPercent >= 80 ? '#ef4444' : tokenPercent >= 50 ? '#f59e0b' : '#10b981',
              }}
            />
          </div>
        </div>

        {/* Properties / Attached Skills (속성) */}
        <div>
          <div className="text-[10px] font-mono text-[#666666] uppercase mb-1.5 flex items-center space-x-1">
            <Layers className="w-3 h-3 text-[#555555]" />
            <span>Properties / Skills (속성)</span>
          </div>
          {entity.skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {entity.skills.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded bg-[#000000] border border-[#262626] text-[10px] font-mono text-[#cccccc]"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-[#555555] italic">No skills attached</span>
          )}
        </div>

        {/* Summary (요약) */}
        <div>
          <div className="text-[10px] font-mono text-[#666666] uppercase mb-1">
            Summary (요약)
          </div>
          <p className="text-xs text-[#aaaaaa] leading-relaxed bg-[#000000] p-3 rounded border border-[#1f1f1f]">
            {entity.summary}
          </p>
        </div>

        {/* Dispatch Task Form (Zero-Idle Trigger) */}
        <form onSubmit={handleDispatch} className="space-y-1.5 pt-1">
          <div className="text-[10px] font-mono text-[#e11d48] uppercase font-bold flex items-center space-x-1">
            <Sparkles className="w-3 h-3" />
            <span>Dispatch Task (Zero-Idle Trigger)</span>
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder={`Send prompt to ${entity.name}...`}
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              className="flex-1 bg-[#000000] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-[#ffffff] focus:outline-none focus:border-[#e11d48]"
            />
            <button
              type="submit"
              disabled={!taskPrompt.trim()}
              className="px-3 py-1.5 rounded bg-[#e11d48] hover:bg-[#be123c] text-[#ffffff] font-medium disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Footer Action Buttons */}
      <div className="p-3 border-t border-[#1a1a1a] bg-[#000000] space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setIsTerminalModalOpen(true)}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded bg-[#111111] hover:bg-[#1a1a1a] border border-[#262626] text-xs font-semibold text-[#ffffff] transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-[#e11d48]" />
            <span>Peek Terminal</span>
          </button>

          <button
            onClick={() => compactEntityMemory(entity.id)}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded bg-[#111111] hover:bg-[#1a1a1a] border border-[#262626] text-xs font-semibold text-[#ffffff] transition-colors"
          >
            <Scissors className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>Compact Node</span>
          </button>
        </div>

        <button
          onClick={compactAllEntities}
          className="w-full py-1.5 px-3 rounded bg-[#0a0a0a] hover:bg-[#141414] border border-[#222222] text-[11px] font-mono text-[#888888] hover:text-[#cccccc] transition-colors"
        >
          [Compact All Network Memory]
        </button>
      </div>
    </aside>
  );
};
