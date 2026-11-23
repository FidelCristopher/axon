import React, { useState } from 'react';
import { useAxonStore, AVAILABLE_SKILLS } from '../store/axonStore';
import type { AgentRole } from '../types/axon';
import { 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Scissors, 
  GitBranch, 
  SlidersHorizontal 
} from 'lucide-react';

export const SidebarRight: React.FC = () => {
  const {
    sessions,
    selectedSessionIds,
    toggleSessionSelect,
    selectAllSessions,
    removeSession,
    addSession,
    applySkillsToSelected,
    compactAllSessions,
    compactSelectedSessions,
  } = useAxonStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchRole, setNewBranchRole] = useState<AgentRole>('dev');
  const [newBranchWorktree, setNewBranchWorktree] = useState('feat/new-module');
  const [selectedSkillsToInject, setSelectedSkillsToInject] = useState<string[]>([]);

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    addSession(newBranchName, newBranchRole, newBranchWorktree);
    setNewBranchName('');
    setIsAddOpen(false);
  };

  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillsToInject(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const handleApplySkills = () => {
    if (selectedSkillsToInject.length === 0 || selectedSessionIds.length === 0) return;
    applySkillsToSelected(selectedSkillsToInject);
    setSelectedSkillsToInject([]);
  };

  const allSelected = sessions.length > 0 && selectedSessionIds.length === sessions.length;

  return (
    <aside className="w-80 bg-[#0b0f19] border-l border-[#1e293b] flex flex-col h-full select-none">
      {/* Top Header & Fast Memory Compact Actions */}
      <div className="p-4 border-b border-[#1e293b] bg-[#090d16]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-[#06b6d4]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#f8fafc]">
              Inspector & Actions
            </span>
          </div>
          <button
            onClick={() => setIsAddOpen(!isAddOpen)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#06b6d4]/10 hover:bg-[#06b6d4]/20 border border-[#06b6d4]/40 text-[#06b6d4] text-xs font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Branch</span>
          </button>
        </div>

        {/* Compact Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={compactAllSessions}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-xs font-medium text-[#f8fafc] transition-all"
            title="Compact memory transcripts across all network nodes"
          >
            <Scissors className="w-3 h-3 text-[#06b6d4]" />
            <span>Compact All</span>
          </button>

          <button
            onClick={compactSelectedSessions}
            disabled={selectedSessionIds.length === 0}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-xs font-medium text-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Compact memory transcripts for checked nodes only"
          >
            <Scissors className="w-3 h-3 text-[#f59e0b]" />
            <span>Compact Select</span>
          </button>
        </div>
      </div>

      {/* Inline Form: Add New Branch */}
      {isAddOpen && (
        <form onSubmit={handleCreateBranch} className="p-3 bg-[#0f172a] border-b border-[#1e293b] space-y-2">
          <div className="text-[11px] font-semibold text-[#f8fafc]">Create Synapse Branch</div>
          <input
            type="text"
            placeholder="Branch Name (e.g., Dev 3 - Audio)"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded text-xs px-2.5 py-1 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#06b6d4]"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newBranchRole}
              onChange={(e) => setNewBranchRole(e.target.value as AgentRole)}
              className="bg-[#090d16] border border-[#1e293b] rounded text-xs px-2 py-1 text-[#f8fafc] focus:outline-none focus:border-[#06b6d4]"
            >
              <option value="dev">Role: Dev</option>
              <option value="qa">Role: QA</option>
              <option value="designer">Role: Designer</option>
              <option value="architect">Role: Architect</option>
            </select>
            <input
              type="text"
              placeholder="Git Worktree"
              value={newBranchWorktree}
              onChange={(e) => setNewBranchWorktree(e.target.value)}
              className="bg-[#090d16] border border-[#1e293b] rounded text-xs px-2 py-1 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#06b6d4]"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-2.5 py-1 rounded text-xs text-[#94a3b8] hover:text-[#f8fafc]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded bg-[#06b6d4] hover:bg-[#0891b2] text-xs font-semibold text-black"
            >
              Spawn Node
            </button>
          </div>
        </form>
      )}

      {/* Multi-Select Session List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between pb-1 text-xs text-[#94a3b8]">
          <span className="font-semibold text-[11px] uppercase tracking-wider text-[#64748b]">
            Target Nodes ({selectedSessionIds.length}/{sessions.length})
          </span>
          <button
            onClick={() => selectAllSessions(!allSelected)}
            className="text-[11px] text-[#06b6d4] hover:underline flex items-center space-x-1"
          >
            {allSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
          </button>
        </div>

        {sessions.map((session) => {
          const isSelected = selectedSessionIds.includes(session.id);
          const isWorking = session.status === 'WORKING';

          return (
            <div
              key={session.id}
              className={`p-2.5 rounded border transition-all ${
                isSelected
                  ? 'bg-[#0f172a] border-[#06b6d4]/50'
                  : 'bg-[#090d16] border-[#1e293b] hover:border-[#334155]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  onClick={() => toggleSessionSelect(session.id)}
                  className="flex items-center space-x-2 cursor-pointer flex-1 truncate"
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#06b6d4] shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-[#475569] shrink-0" />
                  )}
                  <span className="text-xs font-medium text-[#f8fafc] truncate">
                    {session.name}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                      isWorking
                        ? 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]/40 animate-pulse'
                        : 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
                    }`}
                  >
                    [{session.status}]
                  </span>
                  <button
                    onClick={() => removeSession(session.id)}
                    className="p-1 rounded text-[#64748b] hover:text-[#ef4444]"
                    title="Remove branch"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] text-[#64748b] font-mono">
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
                      className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#94a3b8] border border-[#334155]"
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

      {/* Batch Skill Injector */}
      <div className="p-3 border-t border-[#1e293b] bg-[#090d16]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#f8fafc]">
            <Sparkles className="w-3.5 h-3.5 text-[#06b6d4]" />
            <span>Batch Skill Injector</span>
          </div>
          <span className="text-[10px] text-[#64748b]">
            Targets: {selectedSessionIds.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-2.5 max-h-32 overflow-y-auto">
          {AVAILABLE_SKILLS.map((skill) => {
            const isChecked = selectedSkillsToInject.includes(skill.id);
            return (
              <div
                key={skill.id}
                onClick={() => handleToggleSkill(skill.id)}
                className={`px-2 py-1.5 rounded border text-[10px] font-mono cursor-pointer transition-all truncate ${
                  isChecked
                    ? 'bg-[#06b6d4]/10 border-[#06b6d4] text-[#06b6d4]'
                    : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:border-[#334155]'
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
          className="w-full py-1.5 rounded bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] hover:from-[#0891b2] hover:to-[#2563eb] text-xs font-semibold text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Inject Skills to Selected ({selectedSessionIds.length})
        </button>
      </div>
    </aside>
  );
};
