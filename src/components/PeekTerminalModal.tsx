import React, { useState, useEffect, useRef } from 'react';
import { useAxonStore } from '../store/axonStore';
import { X, Scissors, Send, GitBranch } from 'lucide-react';

export const PeekTerminalModal: React.FC = () => {
  const { 
    sessions, 
    inspectedSessionId, 
    setInspectedSession, 
    updateSessionStatus 
  } = useAxonStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const session = sessions.find((s) => s.id === inspectedSessionId);

  useEffect(() => {
    if (!session) return;
    // Initial synthetic log stream representing real Pi agent session
    setTerminalLogs([
      `[Pi Session initialized for node: ${session.name}]`,
      `Repository: ChineseLearning | Worktree: ${session.worktree}`,
      `Skills attached: [${session.skills.join(', ')}]`,
      `Status: ${session.status} | Token Usage: ${((session.tokenUsed / session.tokenMax) * 100).toFixed(1)}%`,
      `--- Ready for task execution ---`,
    ]);
  }, [inspectedSessionId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  if (!session) return null;

  const handleSendPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;

    const promptText = inputPrompt.trim();
    setInputPrompt('');

    // Append user turn
    setTerminalLogs((prev) => [
      ...prev,
      `> User [Directive]: ${promptText}`,
      `[agent_start] Dispatching to Pi engine (gemini-3.8-flash)...`,
      `[tool_call] git status & check worktree ${session.worktree}`,
    ]);

    // Switch status to WORKING
    updateSessionStatus(session.id, 'WORKING', `Executing: "${promptText.slice(0, 32)}..."`);

    // Simulate completion after 2.4s
    setTimeout(() => {
      setTerminalLogs((prev) => [
        ...prev,
        `[tool_result] Worktree clean. Task executed without errors.`,
        `[agent_end] Turn complete. State settled to IDLE.`,
        `Token footprint updated (+1,240 tokens).`,
      ]);
      updateSessionStatus(session.id, 'IDLE', 'Task finished cleanly');
    }, 2400);
  };

  const handleManualCompact = () => {
    setTerminalLogs((prev) => [
      ...prev,
      `[manual_action] /compact command dispatched...`,
      `Pruning old conversational turns and redundant base64 cache...`,
    ]);
    updateSessionStatus(session.id, 'COMPACTING', 'Compacting session memory...');

    setTimeout(() => {
      setTerminalLogs((prev) => [
        ...prev,
        `[compaction_complete] Session memory compacted. Token usage reduced by ~75%.`,
      ]);
      updateSessionStatus(session.id, 'IDLE', 'Memory compacted');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="w-[720px] max-w-[92vw] h-[520px] bg-[#0b0f19] border border-[#1e293b] rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Terminal Header */}
        <div className="px-4 py-3 bg-[#090d16] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-3 h-3 rounded-full bg-[#06b6d4]/20 border border-[#06b6d4] flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-[#f8fafc]">{session.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#06b6d4] border border-[#334155]">
                  [{session.status}]
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-[#64748b] font-mono">
                <span className="flex items-center space-x-1">
                  <GitBranch className="w-2.5 h-2.5" />
                  <span>{session.worktree}</span>
                </span>
                <span>•</span>
                <span>{((session.tokenUsed / session.tokenMax) * 100).toFixed(0)}% memory</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleManualCompact}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-xs text-[#94a3b8] hover:text-[#f8fafc] transition-all"
              title="Compact this session transcript"
            >
              <Scissors className="w-3 h-3 text-[#f59e0b]" />
              <span>Compact</span>
            </button>
            <button
              onClick={() => setInspectedSession(null)}
              className="p-1 rounded hover:bg-[#1e293b] text-[#64748b] hover:text-[#f8fafc] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Console Output */}
        <div className="flex-1 bg-[#070a10] p-4 font-mono text-xs overflow-y-auto space-y-1 text-[#e2e8f0]">
          {terminalLogs.map((log, index) => {
            const isUser = log.startsWith('> User');
            const isTool = log.startsWith('[tool');
            const isAgent = log.startsWith('[agent');

            return (
              <div
                key={index}
                className={`leading-relaxed ${
                  isUser
                    ? 'text-[#06b6d4] font-semibold'
                    : isTool
                    ? 'text-[#f59e0b]'
                    : isAgent
                    ? 'text-[#10b981]'
                    : 'text-[#94a3b8]'
                }`}
              >
                {log}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>

        {/* Terminal Interactive Input Bar */}
        <form onSubmit={handleSendPrompt} className="p-3 bg-[#090d16] border-t border-[#1e293b] flex items-center space-x-2">
          <div className="text-[#06b6d4] font-mono text-xs pl-1">&gt;</div>
          <input
            type="text"
            placeholder={`Send prompt to ${session.name}... (Event-driven, Zero-Idle)`}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 bg-[#0f172a] border border-[#1e293b] rounded text-xs px-3 py-1.5 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#06b6d4] font-mono"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim()}
            className="px-3 py-1.5 rounded bg-[#06b6d4] hover:bg-[#0891b2] text-xs font-semibold text-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
          >
            <Send className="w-3 h-3" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
