import React, { useState, useEffect, useRef } from 'react';
import { useAxonStore } from '../store/axonStore';
import { X, Scissors, Send, GitBranch } from 'lucide-react';

export const PeekTerminalModal: React.FC = () => {
  const { 
    entities, 
    selectedEntityId, 
    isTerminalModalOpen, 
    setIsTerminalModalOpen, 
    updateEntityStatus,
    compactEntityMemory 
  } = useAxonStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const entity = entities.find((e) => e.id === selectedEntityId);

  useEffect(() => {
    if (!entity) return;
    setTerminalLogs([
      `[Pi Terminal Session Initialized: ${entity.name}]`,
      `Repository: ChineseLearning | Worktree: ${entity.worktree}`,
      `UUID: ${entity.uuid}`,
      `Skills Mounted: [${entity.skills.join(', ') || 'default'}]`,
      `Zero-Idle Bus: ACTIVE | Token: ${((entity.tokenUsed / entity.tokenMax) * 100).toFixed(1)}%`,
      `--- Standby for Task Input ---`,
    ]);
  }, [selectedEntityId, isTerminalModalOpen]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  if (!isTerminalModalOpen || !entity) return null;

  const handleSendPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;

    const promptText = inputPrompt.trim();
    setInputPrompt('');

    setTerminalLogs((prev) => [
      ...prev,
      `> User [Directive]: ${promptText}`,
      `[agent_start] Dispatching to Pi engine (gemini-3.8-flash)...`,
      `[tool_call] git status & inspect worktree: ${entity.worktree}`,
    ]);

    updateEntityStatus(entity.id, 'WORKING', `Executing: "${promptText.slice(0, 32)}..."`);

    setTimeout(() => {
      setTerminalLogs((prev) => [
        ...prev,
        `[tool_result] Worktree clean. Task executed without errors.`,
        `[agent_end] Turn completed cleanly. State settled to IDLE.`,
        `Memory footprint updated (+1,240 tokens).`,
      ]);
      updateEntityStatus(entity.id, 'IDLE', 'Task finished cleanly');
    }, 2400);
  };

  const handleManualCompact = () => {
    compactEntityMemory(entity.id);
    setTerminalLogs((prev) => [
      ...prev,
      `[manual_action] /compact command executed...`,
      `Pruning old conversational turns and redundant base64 cache...`,
      `[compaction_complete] Memory compacted by ~75%.`,
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs select-none">
      <div className="w-[740px] max-w-[92vw] h-[520px] bg-[#000000] border border-[#222222] rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Terminal Header */}
        <div className="px-4 py-3 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#e11d48] animate-pulse" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-[#ffffff]">{entity.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#141414] text-[#e11d48] border border-[#262626]">
                  [{entity.status}]
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-[#777777] font-mono">
                <span className="flex items-center space-x-1">
                  <GitBranch className="w-2.5 h-2.5" />
                  <span>{entity.worktree}</span>
                </span>
                <span>•</span>
                <span>{((entity.tokenUsed / entity.tokenMax) * 100).toFixed(0)}% memory</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleManualCompact}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#111111] hover:bg-[#1a1a1a] border border-[#222222] text-xs text-[#aaaaaa] hover:text-[#ffffff] transition-all"
              title="Compact session memory"
            >
              <Scissors className="w-3 h-3 text-[#f59e0b]" />
              <span>Compact</span>
            </button>
            <button
              onClick={() => setIsTerminalModalOpen(false)}
              className="p-1 rounded hover:bg-[#1a1a1a] text-[#777777] hover:text-[#ffffff] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Console Logs */}
        <div className="flex-1 bg-[#000000] p-4 font-mono text-xs overflow-y-auto space-y-1 text-[#e5e5e5]">
          {terminalLogs.map((log, index) => {
            const isUser = log.startsWith('> User');
            const isTool = log.startsWith('[tool');
            const isAgent = log.startsWith('[agent');

            return (
              <div
                key={index}
                className={`leading-relaxed ${
                  isUser
                    ? 'text-[#e11d48] font-semibold'
                    : isTool
                    ? 'text-[#f59e0b]'
                    : isAgent
                    ? 'text-[#10b981]'
                    : 'text-[#888888]'
                }`}
              >
                {log}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendPrompt} className="p-3 bg-[#0a0a0a] border-t border-[#1f1f1f] flex items-center space-x-2">
          <div className="text-[#e11d48] font-mono text-xs pl-1">&gt;</div>
          <input
            type="text"
            placeholder={`Execute directive on ${entity.name}... (Zero-Idle Trigger)`}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 bg-[#000000] border border-[#222222] rounded text-xs px-3 py-1.5 text-[#ffffff] placeholder-[#555555] focus:outline-none focus:border-[#e11d48] font-mono"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim()}
            className="px-3.5 py-1.5 rounded bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-[#ffffff] disabled:opacity-40 flex items-center space-x-1"
          >
            <Send className="w-3 h-3" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
