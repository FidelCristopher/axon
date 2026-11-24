import React, { useState } from 'react';
import { useAxonStore, AVAILABLE_SKILLS } from '../store/axonStore';
import type { GraphEntity } from '../types/axon';
import { 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Scissors, 
  GitBranch, 
  SlidersHorizontal,
  Terminal,
  X,
  Check
} from 'lucide-react';

export const NodeDetailSidebar: React.FC = () => {
  const {
    entities,
    selectedEntityId,
    setSelectedEntityId,
    selectedSessionIds,
    toggleSessionSelect,
    selectAllSessions,
    removeEntity,
    addEntity,
    applySkillsToSelected,
    addSkillToEntity,
    removeSkillFromEntity,
    compactAllEntities,
    compactSelectedEntities,
    setIsTerminalModalOpen,
  } = useAxonStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchType, setNewBranchType] = useState<GraphEntity['type']>('dev');
  const [newBranchWorktree, setNewBranchWorktree] = useState('feat/new-task');

  // Flexible Skill Injection States
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [activeSkillsQueue, setActiveSkillsQueue] = useState<string[]>(['antislop-ui']);

  // Per-session inline skill input state
  const [addingSkillToSessionId, setAddingSkillToSessionId] = useState<string | null>(null);
  const [inlineSkillText, setInlineSkillText] = useState('');

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    addEntity(newBranchName, newBranchType, newBranchWorktree);
    setNewBranchName('');
    setIsAddOpen(false);
  };

  const handleAddCustomSkillToQueue = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customSkillInput.trim().toLowerCase();
    if (!clean) return;
    if (!activeSkillsQueue.includes(clean)) {
      setActiveSkillsQueue((prev) => [...prev, clean]);
    }
    setCustomSkillInput('');
  };

  const handleRemoveSkillFromQueue = (skillName: string) => {
    setActiveSkillsQueue((prev) => prev.filter((s) => s !== skillName));
  };

  const handleApplySkillsToSelected = () => {
    if (activeSkillsQueue.length === 0 || selectedSessionIds.length === 0) return;
    applySkillsToSelected(activeSkillsQueue);
  };

  const handleAddInlineSkill = (sessionId: string) => {
    const clean = inlineSkillText.trim().toLowerCase();
    if (clean) {
      addSkillToEntity(sessionId, clean);
    }
    setInlineSkillText('');
    setAddingSkillToSessionId(null);
  };

  const allSelected = entities.length > 0 && selectedSessionIds.length === entities.length;

  return (
    <aside className="w-88 shrink-0 bg-[#f8fafc] border-l border-[#e2e8f0] flex flex-col h-full select-none text-xs z-10 shadow-xs">
      {/* 1. Header & Fast Memory Compact Actions */}
      <div className="p-4 border-b border-[#e2e8f0] bg-[#ffffff]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-[#e11d48]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#0f172a] font-mono">
              Inspector & Actions
            </span>
          </div>
          <button
            onClick={() => setIsAddOpen(!isAddOpen)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-[#e11d48]/10 hover:bg-[#e11d48]/20 border border-[#e11d48]/30 text-[#e11d48] text-xs font-semibold transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Branch</span>
          </button>
        </div>

        {/* Compact Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={compactAllEntities}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#ffffff] hover:bg-[#f1f5f9] border border-[#cbd5e1] text-xs font-semibold text-[#0f172a] shadow-xs transition-all"
            title="Compact memory transcripts across all sessions"
          >
            <Scissors className="w-3.5 h-3.5 text-[#e11d48]" />
            <span>Compact All</span>
          </button>

          <button
            onClick={compactSelectedEntities}
            disabled={selectedSessionIds.length === 0}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#ffffff] hover:bg-[#f1f5f9] border border-[#cbd5e1] text-xs font-semibold text-[#0f172a] disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all"
            title="Compact memory for checked sessions only"
          >
            <Scissors className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>Compact Select</span>
          </button>
        </div>
      </div>

      {/* 2. Inline Form: Add New Branch */}
      {isAddOpen && (
        <form onSubmit={handleCreateBranch} className="p-3 bg-[#ffffff] border-b border-[#e2e8f0] space-y-2 shadow-inner">
          <div className="text-[10px] font-mono font-bold text-[#e11d48] uppercase">
            Create Synapse Branch
          </div>
          <input
            type="text"
            placeholder="Branch Name (e.g., Dev 3 - Audio)"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs px-2.5 py-1 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48]"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newBranchType}
              onChange={(e) => setNewBranchType(e.target.value as GraphEntity['type'])}
              className="bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs px-2 py-1 text-[#0f172a] focus:outline-none focus:border-[#e11d48]"
            >
              <option value="dev">Role: Dev</option>
              <option value="qa">Role: QA</option>
              <option value="designer">Role: Designer</option>
              <option value="system">Role: System</option>
            </select>
            <input
              type="text"
              placeholder="Git Worktree"
              value={newBranchWorktree}
              onChange={(e) => setNewBranchWorktree(e.target.value)}
              className="bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs px-2 py-1 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48]"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-2.5 py-1 rounded text-xs text-[#64748b] hover:text-[#0f172a]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded-md bg-[#e11d48] hover:bg-[#be123c] text-xs font-bold text-[#ffffff] shadow-xs"
            >
              Spawn Node
            </button>
          </div>
        </form>
      )}

      {/* 3. Pi Sessions List with Individual Skill Tags & Remove Capability */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between pb-1 text-xs text-[#64748b]">
          <span className="font-bold text-[11px] uppercase tracking-wider text-[#64748b] font-mono">
            Active Panels ({selectedSessionIds.length}/{entities.length})
          </span>
          <button
            onClick={() => selectAllSessions(!allSelected)}
            className="text-[11px] font-semibold text-[#e11d48] hover:underline flex items-center space-x-1"
          >
            {allSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
          </button>
        </div>

        {entities.map((session) => {
          const isSelected = selectedSessionIds.includes(session.id);
          const isFocusedInGraph = selectedEntityId === session.id;
          const isWorking = session.status === 'WORKING';
          const isCompacting = session.status === 'COMPACTING';
          const isAddingInlineSkill = addingSkillToSessionId === session.id;

          return (
            <div
              key={session.id}
              className={`p-2.5 rounded-md border transition-all shadow-xs ${
                isFocusedInGraph
                  ? 'bg-[#ffffff] border-[#e11d48] ring-1 ring-[#e11d48]'
                  : isSelected
                  ? 'bg-[#ffffff] border-[#cbd5e1]'
                  : 'bg-[#ffffff] border-[#e2e8f0] hover:border-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  onClick={() => toggleSessionSelect(session.id)}
                  className="flex items-center space-x-2 cursor-pointer flex-1 truncate"
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#e11d48] shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" />
                  )}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntityId(session.id);
                    }}
                    className={`text-xs font-semibold truncate ${
                      isFocusedInGraph ? 'text-[#e11d48] underline' : 'text-[#0f172a]'
                    }`}
                  >
                    {session.name}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                      isWorking
                        ? 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/40 animate-pulse'
                        : isCompacting
                        ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/40'
                        : 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]'
                    }`}
                  >
                    [{session.status}]
                  </span>

                  <button
                    onClick={() => {
                      setSelectedEntityId(session.id);
                      setIsTerminalModalOpen(true);
                    }}
                    className="p-1 rounded hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#e11d48] transition-colors"
                    title="Inspect Live Terminal"
                  >
                    <Terminal className="w-3 h-3" />
                  </button>

                  {session.id !== 'hub-main' && (
                    <button
                      onClick={() => removeEntity(session.id)}
                      className="p-1 rounded hover:bg-[#f1f5f9] text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                      title="Remove branch"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] text-[#64748b] font-mono">
                <span className="flex items-center space-x-1 truncate">
                  <GitBranch className="w-2.5 h-2.5" />
                  <span className="truncate">{session.worktree}</span>
                </span>
                <span>{((session.tokenUsed / session.tokenMax) * 100).toFixed(0)}% token</span>
              </div>

              {/* Flexible Skills Tags with Remove (x) and Add (+) Button */}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {session.skills.map((skillName) => (
                  <span
                    key={skillName}
                    className="text-[9px] font-mono pl-1.5 pr-1 py-0.5 rounded bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0] flex items-center space-x-1 group/skill hover:border-[#cbd5e1]"
                  >
                    <span>{skillName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSkillFromEntity(session.id, skillName);
                      }}
                      className="text-[#94a3b8] hover:text-[#ef4444] rounded p-0.2"
                      title="Remove skill"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}

                {isAddingInlineSkill ? (
                  <div className="flex items-center space-x-1 bg-[#ffffff] border border-[#e11d48] rounded px-1 py-0.5">
                    <input
                      type="text"
                      placeholder="Skill name..."
                      value={inlineSkillText}
                      onChange={(e) => setInlineSkillText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddInlineSkill(session.id);
                        if (e.key === 'Escape') setAddingSkillToSessionId(null);
                      }}
                      className="w-24 text-[9px] font-mono focus:outline-none text-[#0f172a]"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAddInlineSkill(session.id)}
                      className="text-[#e11d48] hover:text-[#be123c]"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => setAddingSkillToSessionId(null)}
                      className="text-[#94a3b8] hover:text-[#0f172a]"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAddingSkillToSessionId(session.id);
                      setInlineSkillText('');
                    }}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-dashed border-[#cbd5e1] hover:border-[#e11d48] hover:text-[#e11d48] text-[#64748b] flex items-center space-x-0.5 transition-colors"
                    title="Add skill to this session"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Skill</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Truly Flexible Dynamic Skill Injector */}
      <div className="p-3.5 border-t border-[#e2e8f0] bg-[#ffffff] shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#0f172a] font-mono">
            <Sparkles className="w-3.5 h-3.5 text-[#e11d48]" />
            <span>Flexible Skill Injector</span>
          </div>
          <span className="text-[10px] text-[#64748b] font-mono font-medium">
            Targets: {selectedSessionIds.length}
          </span>
        </div>

        {/* Freeform Tag / Custom Skill Input */}
        <form onSubmit={handleAddCustomSkillToQueue} className="flex items-center space-x-1.5">
          <input
            type="text"
            placeholder="Type any skill name & press Enter..."
            value={customSkillInput}
            onChange={(e) => setCustomSkillInput(e.target.value)}
            className="flex-1 bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs px-2.5 py-1.5 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48] focus:bg-[#ffffff] font-mono"
          />
          <button
            type="submit"
            disabled={!customSkillInput.trim()}
            className="px-2.5 py-1.5 rounded-md bg-[#f1f5f9] hover:bg-[#e2e8f0] border border-[#cbd5e1] text-xs font-semibold text-[#0f172a] disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </form>

        {/* Queue of Skills to be Injected */}
        {activeSkillsQueue.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-[#64748b]">Selected to Inject:</div>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {activeSkillsQueue.map((s) => (
                <span
                  key={s}
                  className="text-[10px] font-mono pl-2 pr-1.5 py-0.5 rounded-md bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/30 flex items-center space-x-1 font-semibold"
                >
                  <span>{s}</span>
                  <button
                    onClick={() => handleRemoveSkillFromQueue(s)}
                    className="hover:text-[#be123c]"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips from Installed Local Skills */}
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-[#94a3b8]">Quick Suggest (Local Skills):</div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {AVAILABLE_SKILLS.map((skill) => {
              const isQueued = activeSkillsQueue.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  onClick={() => {
                    if (isQueued) {
                      handleRemoveSkillFromQueue(skill.id);
                    } else {
                      setActiveSkillsQueue((prev) => [...prev, skill.id]);
                    }
                  }}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all ${
                    isQueued
                      ? 'bg-[#e11d48] text-white border-[#e11d48] font-bold'
                      : 'bg-[#ffffff] text-[#475569] border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
                  }`}
                  title={skill.description}
                >
                  {isQueued ? `✓ ${skill.name}` : `+ ${skill.name}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleApplySkillsToSelected}
          disabled={activeSkillsQueue.length === 0 || selectedSessionIds.length === 0}
          className="w-full py-2 rounded-md bg-[#e11d48] hover:bg-[#be123c] text-xs font-bold text-[#ffffff] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-mono shadow-xs"
        >
          Inject {activeSkillsQueue.length} Skill(s) to Selected ({selectedSessionIds.length})
        </button>
      </div>
    </aside>
  );
};
