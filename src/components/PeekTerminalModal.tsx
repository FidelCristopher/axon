import React, { useState, useEffect, useRef } from 'react';
import { useAxonStore } from '../store/axonStore';
import { X, Scissors, Send, GitBranch, MessageSquare, Terminal, Wrench } from 'lucide-react';

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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Tab View State: 'chat' for parsed historical chat turns, 'console' for live terminal/telemetry
  const [modalView, setModalView] = useState<'chat' | 'console'>('chat');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

  // Fetch real session history (.jsonl) whenever modal opens or active entity changes
  useEffect(() => {
    if (!isTerminalModalOpen || !entity) return;

    setIsLoadingHistory(true);
    const targetLookup = entity.uuid || entity.id;

    fetch(`/api/session-history?id=${encodeURIComponent(targetLookup)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Session history not found');
        return res.json();
      })
      .then((data) => {
        if (data && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
        } else {
          setChatMessages([]);
        }
      })
      .catch(() => {
        setChatMessages([]);
      })
      .finally(() => {
        setIsLoadingHistory(false);
      });
  }, [entity?.id, entity?.uuid, isTerminalModalOpen]);

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

  // Set to true to connect to live Pi bridge, or false for safe UI sandbox development mode
  const IS_LIVE_BRIDGE_ACTIVE = false;

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
      `[sandbox mode active: 0 tokens consumed] Workspace: ${targetCwd}`,
    ]);

    updateEntityStatus(entity.id, 'WORKING', `Executing: "${promptText.slice(0, 32)}..."`);

    if (IS_LIVE_BRIDGE_ACTIVE) {
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
    } else {
      // Safe UI development simulation: zero tokens, instant UI feedback
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          `[tool_call]: read (${targetCwd}/build.gradle.kts)`,
          `[tool_result]: Workspace verified cleanly.`,
          `[assistant]: Perintah "${promptText}" diterima di UI sandbox. Menunggu pembukaan kunci integrasi.`,
          `[agent_end]: Turn selesai. Status kembali ke IDLE.`,
        ]);
        updateEntityStatus(entity.id, 'IDLE', 'Task finished cleanly (Sandbox)');
        setIsSending(false);
      }, 1500);
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

        {/* View Tabs Switcher: Real Chat History vs Live Console */}
        <div className="px-4 py-2 bg-[#ffffff] border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setModalView('chat')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold font-mono transition-all ${
                modalView === 'chat'
                  ? 'bg-[#e11d48] text-white shadow-xs'
                  : 'bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat History {chatMessages.length > 0 && `(${chatMessages.length})`}</span>
            </button>

            <button
              onClick={() => setModalView('console')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold font-mono transition-all ${
                modalView === 'console'
                  ? 'bg-[#e11d48] text-white shadow-xs'
                  : 'bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Console & Telemetry</span>
            </button>
          </div>

          <span className="text-[10px] font-mono text-[#94a3b8]">
            {modalView === 'chat' ? (isLoadingHistory ? 'Loading .jsonl...' : `${chatMessages.length} turns loaded`) : 'Zero-Idle PTY'}
          </span>
        </div>

        {/* Content Body: Chat History OR Console Logs */}
        {modalView === 'chat' ? (
          <div className="flex-1 bg-[#f8fafc] p-4 overflow-y-auto space-y-3 font-sans">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center h-full text-[#64748b] font-mono text-xs space-y-2">
                <div className="w-5 h-5 border-2 border-[#e11d48] border-t-transparent rounded-full animate-spin" />
                <span>Reading session history (.jsonl)...</span>
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#94a3b8] font-mono text-xs space-y-1 text-center p-6">
                <div className="text-sm font-bold text-[#64748b]">No Historical Chat Turns Found</div>
                <p className="text-[11px] text-[#94a3b8]">
                  This session does not have logged user/assistant messages yet, or switch to Live Console to send a command.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, index) => {
                const isUser = msg.role === 'user';

                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 px-1 text-[10px] text-[#64748b] font-mono">
                      <span className="font-bold text-[#0f172a]">{isUser ? 'User Prompt' : 'Pi Assistant'}</span>
                      {msg.timestamp && (
                        <span>• {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>

                    <div
                      className={`max-w-[88%] rounded-lg p-3 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-[#0f172a] text-[#f8fafc] font-mono rounded-tr-none'
                          : 'bg-[#ffffff] text-[#0f172a] border border-[#e2e8f0] rounded-tl-none font-sans'
                      }`}
                    >
                      {msg.text && (
                        <div className="whitespace-pre-wrap select-text">{msg.text}</div>
                      )}

                      {/* Tool Calls Breakdown */}
                      {msg.tools && msg.tools.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#e2e8f0]/80 space-y-1.5">
                          <div className="text-[9px] font-mono font-bold text-[#64748b] uppercase tracking-wider flex items-center space-x-1">
                            <Wrench className="w-2.5 h-2.5 text-[#e11d48]" />
                            <span>Tool Invocations ({msg.tools.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                            {msg.tools.map((t: any, tIdx: number) => (
                              <span
                                key={tIdx}
                                className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0] max-w-full truncate"
                                title={t.name ? `${t.name}: ${JSON.stringify(t.args || {})}` : t.output}
                              >
                                {t.name ? `[${t.name}]` : `[result: ${String(t.output || '').slice(0, 35)}...]`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
        ) : (
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
        )}

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
