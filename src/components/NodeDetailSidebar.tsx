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

/**
 * Parses raw text or URLs to detect if it's a GitHub repository or skill path.
 * Supports:
 * - https://github.com/owner/repo
 * - github.com/owner/repo
 * - https://github.com/owner/repo/tree/main/skills/sub-skill
 */
export const parseGitHubSkillUrl = (input: string) => {
  const trimmed = input.trim();
  const ghRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s#?]+)(?:\/(?:tree|blob)\/[^\/]+\/(.+))?/;
  const match = trimmed.match(ghRegex);

  if (!match) return null;

  const owner = match[1];
  let repo = match[2].replace(/\.git$/, '');
  const subPath = match[3];

  let skillName = repo;
  if (subPath) {
    const parts = subPath.split('/');
    skillName = parts[parts.length - 1].replace(/\.md$/, '') || repo;
  }

  const cleanRepoPath = `${owner}/${repo}${subPath ? `/${subPath}` : ''}`;

  return {
    rawUrl: trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    owner,
    repo,
    skillName,
    tag: `github:${cleanRepoPath}`,
    displayLabel: `${owner}/${repo}`,
  };
};

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
  const [worktreeStatus, setWorktreeStatus] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [isWorktreeBusy, setIsWorktreeBusy] = useState(false);

  const resolveActiveRepoPath = () => {
    const combined = entities.map((e) => `${e.name} ${e.worktree}`).join(' ').toLowerCase();
    if (combined.includes('matcha')) return '/mnt/c/Users/Pongo/matcha-showcase';
    if (combined.includes('axon')) return '/mnt/c/Users/Pongo/axon';
    return '/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning';
  };

  // Flexible Skill Injection States
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [activeSkillsQueue, setActiveSkillsQueue] = useState<string[]>(['antislop-ui']);
  const [injectionSuccessMsg, setInjectionSuccessMsg] = useState<string | null>(null);

  // Per-session inline skill input state
  const [addingSkillToSessionId, setAddingSkillToSessionId] = useState<string | null>(null);
  const [inlineSkillText, setInlineSkillText] = useState('');

  // Live detection of GitHub link in the input
  const detectedGitHub = parseGitHubSkillUrl(customSkillInput);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || isWorktreeBusy) return;

    const repoPath = resolveActiveRepoPath();
    const branchName = newBranchWorktree.trim() || `feat/${newBranchName.trim().toLowerCase().replace(/\s+/g, '-')}`;
    setIsWorktreeBusy(true);
    setWorktreeStatus({ type: 'info', text: `Creating Git worktree "${branchName}"...` });

    try {
      const res = await fetch('http://127.0.0.1:1425/api/worktree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath, branchName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      addEntity(newBranchName, newBranchType, data.branchName || branchName, data.worktreeDir);
      setWorktreeStatus({
        type: 'success',
        text: `Worktree created: ${data.branchName} (${data.worktreeDir})`,
      });
      setNewBranchName('');
      setIsAddOpen(false);
    } catch (err: any) {
      setWorktreeStatus({
        type: 'error',
        text: `Git worktree error: ${err.message}`,
      });
    } finally {
      setIsWorktreeBusy(false);
      setTimeout(() => setWorktreeStatus(null), 5000);
    }
  };

  const handleDeleteBranch = async (session: GraphEntity) => {
    if (isWorktreeBusy) return;
    const repoPath = resolveActiveRepoPath();
    const branchName = session.worktree;

    // Protected main branch: only remove node from UI if somehow triggered, never delete main repo
    if (!branchName || ['main', 'master'].includes(branchName.toLowerCase())) {
      removeEntity(session.id);
      return;
    }

    setIsWorktreeBusy(true);
    setWorktreeStatus({ type: 'info', text: `Removing worktree & branch "${branchName}"...` });

    try {
      const res = await fetch('http://127.0.0.1:1425/api/worktree/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath,
          branchName,
          worktreeDir: session.worktreePath,
        }),
      });
      const data = await res.json();
      removeEntity(session.id);
      if (!res.ok || !data.success) {
        setWorktreeStatus({
          type: 'error',
          text: `Node removed, Git cleanup note: ${data.error || 'branch not on disk'}`,
        });
      } else {
        setWorktreeStatus({
          type: 'success',
          text: `Removed worktree & branch "${branchName}"`,
        });
      }
    } catch (err: any) {
      removeEntity(session.id);
      setWorktreeStatus({
        type: 'error',
        text: `Node removed (bridge error: ${err.message})`,
      });
    } finally {
      setIsWorktreeBusy(false);
      setTimeout(() => setWorktreeStatus(null), 5000);
    }
  };

  const handleAddCustomSkillToQueue = (e: React.FormEvent) => {
    e.preventDefault();
    const gh = parseGitHubSkillUrl(customSkillInput);
    let skillTag = '';
    if (gh) {
      skillTag = gh.tag;
    } else {
      skillTag = customSkillInput.trim().toLowerCase();
    }
    if (!skillTag) return;
    if (!activeSkillsQueue.includes(skillTag)) {
      setActiveSkillsQueue((prev) => [...prev, skillTag]);
    }
    setCustomSkillInput('');
  };

  const handleRemoveSkillFromQueue = (skillName: string) => {
    setActiveSkillsQueue((prev) => prev.filter((s) => s !== skillName));
  };

  const handleApplySkillsToSelected = () => {
    if (activeSkillsQueue.length === 0 || selectedSessionIds.length === 0) return;
    applySkillsToSelected(activeSkillsQueue);

    const hasGitHubSkill = activeSkillsQueue.some((s) => s.startsWith('github:'));
    const message = hasGitHubSkill
      ? `Installed & Injected ${activeSkillsQueue.length} skill(s) (including GitHub repositories) to ${selectedSessionIds.length} target session(s)!`
      : `Successfully injected ${activeSkillsQueue.length} skill(s) to ${selectedSessionIds.length} target session(s)!`;

    setInjectionSuccessMsg(message);
    setTimeout(() => {
      setInjectionSuccessMsg(null);
    }, 4000);
  };

  const handleAddInlineSkill = (sessionId: string) => {
    const gh = parseGitHubSkillUrl(inlineSkillText);
    const skillTag = gh ? gh.tag : inlineSkillText.trim().toLowerCase();
    if (skillTag) {
      addSkillToEntity(sessionId, skillTag);
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
        {/* Real Git Worktree Status Feedback */}
        {worktreeStatus && (
          <div
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono border break-all ${
              worktreeStatus.type === 'success'
                ? 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]'
                : worktreeStatus.type === 'error'
                ? 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
                : 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1]'
            }`}
          >
            {worktreeStatus.text}
          </div>
        )}
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

        {entities.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-lg border border-dashed border-[#cbd5e1] bg-[#ffffff] space-y-1.5 my-2">
            <div className="text-xs font-bold text-[#0f172a] font-mono">No Active Session</div>
            <p className="text-[11px] font-mono text-[#64748b] leading-relaxed">
              Select any session from the left sidebar to inspect its branch panels and inject skills.
            </p>
          </div>
        ) : (
          entities.map((session) => {
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
                      onClick={() => handleDeleteBranch(session)}
                      disabled={isWorktreeBusy}
                      className="p-1 rounded hover:bg-[#f1f5f9] text-[#94a3b8] hover:text-[#ef4444] transition-colors disabled:opacity-40"
                      title={`Delete branch & Git worktree (${session.worktree})`}
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

              {/* Flexible Skills Tags with GitHub Repo Recognition & Remove/Add Button */}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {session.skills.map((skillName) => {
                  const isGitHub = skillName.startsWith('github:');
                  const repoLabel = isGitHub ? skillName.replace('github:', '') : skillName;

                  return (
                    <span
                      key={skillName}
                      className={`text-[9px] font-mono pl-1.5 pr-1 py-0.5 rounded flex items-center space-x-1 group/skill transition-all ${
                        isGitHub
                          ? 'bg-[#0f172a] text-[#38bdf8] border border-[#38bdf8]/40 shadow-xs'
                          : 'bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0] hover:border-[#cbd5e1]'
                      }`}
                      title={isGitHub ? `GitHub Repo Skill: https://github.com/${repoLabel}` : `Skill: ${skillName}`}
                    >
                      {isGitHub && <GitBranch className="w-2.5 h-2.5 text-[#38bdf8] shrink-0" />}
                      <span className="truncate max-w-[130px] font-medium">{repoLabel}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSkillFromEntity(session.id, skillName);
                        }}
                        className={`rounded p-0.2 transition-colors ${
                          isGitHub ? 'text-[#94a3b8] hover:text-[#ef4444]' : 'text-[#94a3b8] hover:text-[#ef4444]'
                        }`}
                        title="Remove skill"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}

                {isAddingInlineSkill ? (
                  <div className="flex items-center space-x-1 bg-[#ffffff] border border-[#e11d48] rounded px-1.5 py-0.5 shadow-xs">
                    <input
                      type="text"
                      placeholder="Skill or github.com/..."
                      value={inlineSkillText}
                      onChange={(e) => setInlineSkillText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddInlineSkill(session.id);
                        if (e.key === 'Escape') setAddingSkillToSessionId(null);
                      }}
                      className="w-32 text-[9px] font-mono focus:outline-none text-[#0f172a]"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAddInlineSkill(session.id)}
                      className="text-[#e11d48] hover:text-[#be123c]"
                      title="Confirm Add"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => setAddingSkillToSessionId(null)}
                      className="text-[#94a3b8] hover:text-[#0f172a]"
                      title="Cancel"
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
                    title="Add skill or paste GitHub URL to this session"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Skill / Git</span>
                  </button>
                )}
              </div>
            </div>
          );
        }))}
      </div>

      {/* 4. Truly Flexible Dynamic Skill & GitHub Repo Injector */}
      <div className="p-3.5 border-t border-[#e2e8f0] bg-[#ffffff] shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#0f172a] font-mono">
            <Sparkles className="w-3.5 h-3.5 text-[#e11d48]" />
            <span>Flexible Skill & GitHub Injector</span>
          </div>
          <span className="text-[10px] text-[#64748b] font-mono font-medium">
            Targets: {selectedSessionIds.length}
          </span>
        </div>

        {/* Freeform Tag / GitHub Link Input */}
        <form onSubmit={handleAddCustomSkillToQueue} className="flex items-center space-x-1.5">
          <input
            type="text"
            placeholder="Type skill name or paste GitHub URL..."
            value={customSkillInput}
            onChange={(e) => setCustomSkillInput(e.target.value)}
            className="flex-1 bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs px-2.5 py-1.5 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48] focus:bg-[#ffffff] font-mono"
          />
          <button
            type="submit"
            disabled={!customSkillInput.trim()}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1 transition-all disabled:opacity-40 ${
              detectedGitHub
                ? 'bg-[#0f172a] hover:bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/40 shadow-xs'
                : 'bg-[#f1f5f9] hover:bg-[#e2e8f0] border border-[#cbd5e1] text-[#0f172a]'
            }`}
          >
            {detectedGitHub ? (
              <>
                <GitBranch className="w-3 h-3 text-[#38bdf8]" />
                <span>Add Git</span>
              </>
            ) : (
              <span>Add</span>
            )}
          </button>
        </form>

        {/* Real-time GitHub Link Detection Preview Banner */}
        {detectedGitHub && (
          <div className="flex items-center justify-between p-2 rounded-md bg-[#0f172a] text-[#f8fafc] text-[11px] font-mono border border-[#38bdf8]/40 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center space-x-1.5 truncate">
              <GitBranch className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
              <span className="text-[#94a3b8]">GitHub Repo:</span>
              <span className="font-bold text-[#38bdf8] truncate">{detectedGitHub.owner}/{detectedGitHub.repo}</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#38bdf8]/20 text-[#38bdf8] font-bold shrink-0">
              Ready to Inject
            </span>
          </div>
        )}

        {/* Injection Success Banner */}
        {injectionSuccessMsg && (
          <div className="p-2 rounded-md bg-[#10b981]/10 border border-[#10b981]/30 text-[#047857] text-[11px] font-mono font-semibold animate-in fade-in duration-200">
            ✓ {injectionSuccessMsg}
          </div>
        )}

        {/* Queue of Skills to be Injected */}
        {activeSkillsQueue.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-[#64748b]">Selected to Inject:</div>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {activeSkillsQueue.map((s) => {
                const isGitHub = s.startsWith('github:');
                const label = isGitHub ? s.replace('github:', '') : s;

                return (
                  <span
                    key={s}
                    className={`text-[10px] font-mono pl-2 pr-1.5 py-0.5 rounded-md flex items-center space-x-1 font-semibold transition-all ${
                      isGitHub
                        ? 'bg-[#0f172a] text-[#38bdf8] border border-[#38bdf8]/40 shadow-xs'
                        : 'bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/30'
                    }`}
                  >
                    {isGitHub && <GitBranch className="w-2.5 h-2.5 text-[#38bdf8] shrink-0" />}
                    <span className="truncate max-w-[140px]">{label}</span>
                    <button
                      onClick={() => handleRemoveSkillFromQueue(s)}
                      className={`hover:opacity-75 ${isGitHub ? 'text-[#94a3b8] hover:text-[#ef4444]' : 'hover:text-[#be123c]'}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips from Installed Local Skills */}
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-[#94a3b8]">Quick Suggest (Local Skills & Top Repos):</div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
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
            
            {/* Quick GitHub Repos Suggestions */}
            <button
              onClick={() => {
                const tag = 'github:PatrickJS/awesome-cursorrules';
                if (activeSkillsQueue.includes(tag)) {
                  handleRemoveSkillFromQueue(tag);
                } else {
                  setActiveSkillsQueue((prev) => [...prev, tag]);
                }
              }}
              className={`text-[9px] font-mono px-2 py-0.5 rounded border flex items-center space-x-1 transition-all ${
                activeSkillsQueue.includes('github:PatrickJS/awesome-cursorrules')
                  ? 'bg-[#0f172a] text-[#38bdf8] border-[#38bdf8] font-bold'
                  : 'bg-[#0f172a]/5 text-[#0f172a] border-[#cbd5e1] hover:border-[#38bdf8] hover:text-[#0284c7]'
              }`}
            >
              <GitBranch className="w-2.5 h-2.5 text-[#0284c7]" />
              <span>+ awesome-cursorrules</span>
            </button>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleApplySkillsToSelected}
          disabled={activeSkillsQueue.length === 0 || selectedSessionIds.length === 0}
          className="w-full py-2 rounded-md bg-[#e11d48] hover:bg-[#be123c] text-xs font-bold text-[#ffffff] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-mono shadow-xs flex items-center justify-center space-x-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Inject {activeSkillsQueue.length} Skill(s) to Selected ({selectedSessionIds.length})</span>
        </button>
      </div>
    </aside>
  );
};
