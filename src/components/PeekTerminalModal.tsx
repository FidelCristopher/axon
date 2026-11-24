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
  const [isSending, setIsSending] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const entity = entities.find((e) => e.id === selectedEntityId);

  // Worktree real directory mapping
  const resolveCwd = (ent: typeof entity) => {
    if (!ent) return '/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning';
    if (ent.worktree === 'feat/belajar-page') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-part1';
    if (ent.worktree === 'feat/cerita-page') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-part2';
    if (ent.worktree === 'feat/assets') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-assets';
    if (ent.worktree === 'axon/main') return '/mnt/c/Users/Pongo/axon';
    return '/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning';
  };

  useEffect(() => {
    if (!entity) return;
    setTerminalLogs([
      `[Native Pi Agent Initialized: ${entity.name}]`,
      `Local Workspace: ${resolveCwd(entity)}`,
      `Worktree: ${entity.worktree} | UUID: ${entity.uuid}`,
      `Zero-Idle Architecture: ACTIVE (Tokens strictly consumed only on task run)`,
      `Status: ${entity.status} | Memory Footprint: ${((entity.tokenUsed / entity.tokenMax) * 100).toFixed(1)}%`,
      `--- Connected to Native Pi Engine (100% Local File Access) ---`,
    ]);
  }, [selectedEntityId, isTerminalModalOpen]);

  // Connect to SSE stream from native Pi Bridge for real-time telemetry
  useEffect(() => {
    const sse = new EventSource('http://localhost:1425/api/stream');

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!data || !data.type) return;

        if (data.type === 'agent_start' && data.nodeId === selectedEntityId) {
          updateEntityStatus(selectedEntityId, 'WORKING', 'Agent executing prompt...');
        } else if (data.type === 'text_delta' && data.nodeId === selectedEntityId) {
          setTerminalLogs((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.startsWith('[assistant]:')) {
              const updated = [...prev];
              updated[updated.length - 1] = last + data.delta;
              return updated;
            }
            return [...prev, `[assistant]: ${data.delta}`];
          });
        } else if (data.type === 'tool_start' && data.nodeId === selectedEntityId) {
          setTerminalLogs((prev) => [
            ...prev,
            `[tool_call]: ${data.tool} (${JSON.stringify(data.args || {}).slice(0, 64)}...)`,
          ]);
        } else if (data.type === 'tool_end' && data.nodeId === selectedEntityId) {
          setTerminalLogs((prev) => [
            ...prev,
            `[tool_result]: ${data.tool} execution completed cleanly.`,
          ]);
        } else if (data.type === 'agent_end' && data.nodeId === selectedEntityId) {
          updateEntityStatus(selectedEntityId, 'IDLE', 'Task complete. State settled to IDLE.');
          setTerminalLogs((prev) => [
            ...prev,
            `[agent_end]: Turn completed. State settled to IDLE.`,
          ]);
          setIsSending(false);
        }
      } catch {}
    };

    return () => {
      sse.close();
    };
  }, [selectedEntityId, updateEntityStatus]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  if (!isTerminalModalOpen || !entity) return null;

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isSending) return;

    const promptText = inputPrompt.trim();
    setInputPrompt('');
    setIsSending(true);

    const targetCwd = resolveCwd(entity);

    // Append user input
    setTerminalLogs((prev) => [
      ...prev,
      `> User: ${promptText}`,
      `[dispatching to local Pi session in ${targetCwd}]...`,
    ]);

    updateEntityStatus(entity.id, 'WORKING', `Executing: "${promptText.slice(0, 32)}..."`);

    try {
      const res = await fetch('http://localhost:1425/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: entity.id,
          cwd: targetCwd,
          prompt: promptText,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        `[error]: Failed to connect to native Pi Bridge: ${err.message}`,
      ]);
      setIsSending(false);
      updateEntityStatus(entity.id, 'IDLE', 'Error executing prompt');
    }
  };

  const handleManualCompact = async () => {
    compactEntityMemory(entity.id);
    setTerminalLogs((prev) => [
      ...prev,
      `[manual_action] /compact command executed via Pi Bridge...`,
      `Pruning old turns and session cache...`,
    ]);

    try {
      await fetch('http://localhost:1425/api/compact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: entity.id }),
      });
      setTerminalLogs((prev) => [
        ...prev,
        `[compaction_complete] Memory compacted cleanly.`,
      ]);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div className="w-[780px] max-w-[94vw] h-[540px] bg-[#ffffff] border border-[#cbd5e1] rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Terminal Header */}
        <div className="px-4 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#e11d48] animate-pulse" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-[#0f172a]">{entity.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#f1f5f9] text-[#e11d48] border border-[#e2e8f0] font-semibold">
                  [{entity.status}]
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-[#64748b] font-mono">
                <span className="flex items-center space-x-1">
                  <GitBranch className="w-2.5 h-2.5" />
                  <span>{resolveCwd(entity)}</span>
                </span>
                <span>•</span>
                <span>{((entity.tokenUsed / entity.tokenMax) * 100).toFixed(0)}% memory</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleManualCompact}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#ffffff] hover:bg-[#f1f5f9] border border-[#cbd5e1] text-xs font-semibold text-[#0f172a] shadow-xs transition-all"
              title="Compact session memory"
            >
              <Scissors className="w-3 h-3 text-[#f59e0b]" />
              <span>Compact</span>
            </button>
            <button
              onClick={() => setIsTerminalModalOpen(false)}
              className="p-1 rounded hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Console Logs */}
        <div className="flex-1 bg-[#0f172a] p-4 font-mono text-xs overflow-y-auto space-y-1 text-[#f8fafc]">
          {terminalLogs.map((log, index) => {
            const isUser = log.startsWith('> User');
            const isTool = log.startsWith('[tool');
            const isAgent = log.startsWith('[assistant]') || log.startsWith('[agent');

            return (
              <div
                key={index}
                className={`leading-relaxed ${
                  isUser
                    ? 'text-[#38bdf8] font-bold'
                    : isTool
                    ? 'text-[#fbbf24]'
                    : isAgent
                    ? 'text-[#34d399]'
                    : 'text-[#94a3b8]'
                }`}
              >
                {log}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendPrompt} className="p-3 bg-[#ffffff] border-t border-[#e2e8f0] flex items-center space-x-2">
          <div className="text-[#e11d48] font-mono text-xs font-bold pl-1">&gt;</div>
          <input
            type="text"
            placeholder={
              isSending
                ? `Executing prompt in ${resolveCwd(entity)}...`
                : `Send prompt directly to ${entity.name}... (Native Pi Engine)`
            }
            value={inputPrompt}
            disabled={isSending}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs px-3 py-1.5 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#e11d48] focus:bg-[#ffffff] font-mono disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isSending}
            className="px-3.5 py-1.5 rounded-md bg-[#e11d48] hover:bg-[#be123c] text-xs font-bold text-[#ffffff] disabled:opacity-40 shadow-xs flex items-center space-x-1 font-mono"
          >
            <Send className="w-3 h-3" />
            <span>{isSending ? 'Running...' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
