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
  Terminal
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
    compactAllEntities,
    compactSelectedEntities,
    setIsTerminalModalOpen,
  } = useAxonStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchType, setNewBranchType] = useState<GraphEntity['type']>('dev');
  const [newBranchWorktree, setNewBranchWorktree] = useState('feat/new-task');
  const [selectedSkillsToInject, setSelectedSkillsToInject] = useState<string[]>([]);

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    addEntity(newBranchName, newBranchType, newBranchWorktree);
    setNewBranchName('');
    setIsAddOpen(false);
  };

  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillsToInject((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  const handleApplySkills = () => {
    if (selectedSkillsToInject.length === 0 || selectedSessionIds.length === 0) return;
    applySkillsToSelected(selectedSkillsToInject);
    setSelectedSkillsToInject([]);
  };

  const allSelected = entities.length > 0 && selectedSessionIds.length === entities.length;

  return (
    <aside className="w-88 shrink-0 bg-[#080808] border-l border-[#1a1a1a] flex flex-col h-full select-none text-xs z-10">
      {/* 1. Header & Fast Memory Compact Actions */}
      <div className="p-4 border-b border-[#1a1a1a] bg-[#000000]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-[#e11d48]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#ffffff] font-mono">
              Inspector & Actions
            </span>
          </div>
          <button
            onClick={() => setIsAddOpen(!isAddOpen)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#e11d48]/10 hover:bg-[#e11d48]/20 border border-[#e11d48]/50 text-[#e11d48] text-xs font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Branch</span>
          </button>
        </div>

        {/* Compact Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={compactAllEntities}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded bg-[#111111] hover:bg-[#1a1a1a] border border-[#262626] text-xs font-medium text-[#f5f5f5] transition-all"
            title="Compact memory transcripts across all sessions"
          >
            <Scissors className="w-3 h-3 text-[#e11d48]" />
            <span>Compact All</span>
          </button>

          <button
            onClick={compactSelectedEntities}
            disabled={selectedSessionIds.length === 0}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded bg-[#111111] hover:bg-[#1a1a1a] border border-[#262626] text-xs font-medium text-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Compact memory for checked sessions only"
          >
            <Scissors className="w-3 h-3 text-[#f59e0b]" />
            <span>Compact Select</span>
          </button>
        </div>
      </div>

      {/* 2. Inline Form: Add New Branch */}
      {isAddOpen && (
        <form onSubmit={handleCreateBranch} className="p-3 bg-[#111111] border-b border-[#222222] space-y-2">
          <div className="text-[10px] font-mono font-bold text-[#e11d48] uppercase">
            Create Synapse Branch
          </div>
          <input
            type="text"
            placeholder="Branch Name (e.g., Dev 3 - Audio)"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            className="w-full bg-[#000000] border border-[#222222] rounded text-xs px-2.5 py-1 text-[#ffffff] placeholder-[#555555] focus:outline-none focus:border-[#e11d48]"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newBranchType}
              onChange={(e) => setNewBranchType(e.target.value as GraphEntity['type'])}
              className="bg-[#000000] border border-[#222222] rounded text-xs px-2 py-1 text-[#ffffff] focus:outline-none focus:border-[#e11d48]"
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
              className="bg-[#000000] border border-[#222222] rounded text-xs px-2 py-1 text-[#ffffff] placeholder-[#555555] focus:outline-none focus:border-[#e11d48]"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
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

      {/* 3. Pi Sessions List with Multi-Select */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between pb-1 text-xs text-[#888888]">
          <span className="font-semibold text-[11px] uppercase tracking-wider text-[#666666] font-mono">
            Pi Sessions ({selectedSessionIds.length}/{entities.length})
          </span>
          <button
            onClick={() => selectAllSessions(!allSelected)}
            className="text-[11px] text-[#e11d48] hover:underline flex items-center space-x-1"
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

          return (
            <div
              key={session.id}
              className={`p-2.5 rounded border transition-all ${
                isFocusedInGraph
                  ? 'bg-[#121212] border-[#e11d48] shadow-sm'
                  : isSelected
                  ? 'bg-[#0f0f0f] border-[#333333]'
                  : 'bg-[#000000] border-[#1f1f1f] hover:border-[#2b2b2b]'
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
                    <Square className="w-3.5 h-3.5 text-[#444444] shrink-0" />
                  )}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntityId(session.id);
                    }}
                    className={`text-xs font-medium truncate ${
                      isFocusedInGraph ? 'text-[#ffffff] font-bold underline decoration-[#e11d48]' : 'text-[#e5e5e5]'
                    }`}
                  >
                    {session.name}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                      isWorking
                        ? 'bg-[#e11d48]/20 text-[#e11d48] border-[#e11d48]/50 animate-pulse font-bold'
                        : isCompacting
                        ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/50'
                        : 'bg-[#141414] text-[#777777] border-[#222222]'
                    }`}
                  >
                    [{session.status}]
                  </span>

                  <button
                    onClick={() => {
                      setSelectedEntityId(session.id);
                      setIsTerminalModalOpen(true);
                    }}
                    className="p-1 rounded text-[#777777] hover:text-[#e11d48] hover:bg-[#1a1a1a]"
                    title="Inspect Live Terminal"
                  >
                    <Terminal className="w-3 h-3" />
                  </button>

                  {session.id !== 'hub-main' && (
                    <button
                      onClick={() => removeEntity(session.id)}
                      className="p-1 rounded text-[#555555] hover:text-[#ef4444] hover:bg-[#1a1a1a]"
                      title="Remove branch"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] text-[#666666] font-mono">
                <span className="flex items-center space-x-1 truncate">
                  <GitBranch className="w-2.5 h-2.5" />
                  <span className="truncate">{session.worktree}</span>
                </span>
                <span>{((session.tokenUsed / session.tokenMax) * 100).toFixed(0)}% token</span>
              </div>

              {/* Active Skills tags */}
              {session.skills.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {session.skills.map((skillId) => (
                    <span
                      key={skillId}
                      className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#0a0a0a] text-[#888888] border border-[#222222]"
                    >
                      {skillId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Batch Skill Injector */}
      <div className="p-3 border-t border-[#1a1a1a] bg-[#000000]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#ffffff] font-mono">
            <Sparkles className="w-3.5 h-3.5 text-[#e11d48]" />
            <span>Batch Skill Injector</span>
          </div>
          <span className="text-[10px] text-[#666666] font-mono">
            Targets: {selectedSessionIds.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-2.5 max-h-28 overflow-y-auto">
          {AVAILABLE_SKILLS.map((skill) => {
            const isChecked = selectedSkillsToInject.includes(skill.id);
            return (
              <div
                key={skill.id}
                onClick={() => handleToggleSkill(skill.id)}
                className={`px-2 py-1.5 rounded border text-[10px] font-mono cursor-pointer transition-all truncate ${
                  isChecked
                    ? 'bg-[#e11d48]/15 border-[#e11d48] text-[#ffffff] font-semibold'
                    : 'bg-[#0a0a0a] border-[#222222] text-[#888888] hover:border-[#333333]'
                }`}
                title={skill.description}
              >
                {skill.name}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleApplySkills}
          disabled={selectedSkillsToInject.length === 0 || selectedSessionIds.length === 0}
          className="w-full py-2 rounded bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-[#ffffff] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-mono"
        >
          Inject Skills to Selected ({selectedSessionIds.length})
        </button>
      </div>
    </aside>
  );
};
