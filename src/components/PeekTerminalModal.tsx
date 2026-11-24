import React, { useState, useEffect, useRef } from 'react';
import { useAxonStore } from '../store/axonStore';
import { X, Scissors, Send, Image as ImageIcon } from 'lucide-react';

export interface AttachedImage {
  id: string;
  name: string;
  size: number;
  previewUrl: string;
  base64?: string;
  file?: File;
}

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'system_notice';
  text?: string;
  attachedImages?: string[];
  tools?: Array<{ type?: string; name?: string; args?: any; output?: string; isError?: boolean }>;
  timestamp?: number;
  model?: string;
}

/**
 * Pixel-Perfect WezTerm / Pi Terminal Syntax Highlighting:
 * - Headers (###): Yellow (#facc15)
 * - Numbered Lists (1., 2.): Magenta (#f43f5e)
 * - Bullets (- , *): Rose (#e11d48)
 * - Inline Code (`code`): Purple / Pink (#e879f9)
 * - Bold (**text**): High-contrast White (#ffffff)
 * - Dividers (---): Subtle terminal horizontal rule (#27272a)
 */
function renderInlineHighlights(str: string) {
  const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <span key={pIdx} className="text-[#e879f9] bg-[#18181b] px-1 py-0.2 rounded font-mono">
          {part.slice(1, -1)}
        </span>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={pIdx} className="text-[#ffffff] font-bold">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={pIdx}>{part}</span>;
  });
}

function formatWezTermText(text: string) {
  if (!text) return null;

  const lines = text.split('\n');

  return lines.map((line, lIdx) => {
    const trimmed = line.trim();

    // Terminal Horizontal Line (--- or ───)
    if (trimmed.startsWith('---') || trimmed.startsWith('───') || trimmed.startsWith('***')) {
      return (
        <div key={lIdx} className="border-t border-[#27272a] my-2 w-full" />
      );
    }

    // Markdown Headers: ### Header -> Yellow (#facc15)
    if (trimmed.startsWith('###')) {
      return (
        <div key={lIdx} className="text-[#facc15] font-bold text-xs mt-3 mb-1 font-mono tracking-tight">
          {line.replace(/^###\s*/, '### ')}
        </div>
      );
    }
    if (trimmed.startsWith('##')) {
      return (
        <div key={lIdx} className="text-[#facc15] font-bold text-xs mt-3 mb-1 font-mono tracking-tight">
          {line.replace(/^##\s*/, '## ')}
        </div>
      );
    }

    // Numbered List: 1. , 2. -> Magenta Number (#f43f5e)
    const numberedMatch = line.match(/^(\s*)(\d+\.)\s*(.*)/);
    if (numberedMatch) {
      const indent = numberedMatch[1];
      const num = numberedMatch[2];
      const rest = numberedMatch[3];
      return (
        <div key={lIdx} className="flex items-start space-x-1.5 leading-relaxed font-mono text-xs text-[#e4e4e7]">
          <span className="text-[#f43f5e] font-bold shrink-0">{indent}{num}</span>
          <span>{renderInlineHighlights(rest)}</span>
        </div>
      );
    }

    // Bullet Points: - or * -> Rose Bullet (#e11d48)
    const bulletMatch = line.match(/^(\s*)([-*])\s*(.*)/);
    if (bulletMatch) {
      const indent = bulletMatch[1];
      const rest = bulletMatch[3];
      return (
        <div key={lIdx} className="flex items-start space-x-1.5 leading-relaxed font-mono text-xs text-[#e4e4e7]">
          <span className="text-[#e11d48] shrink-0 font-bold">{indent}•</span>
          <span>{renderInlineHighlights(rest)}</span>
        </div>
      );
    }

    // Regular terminal lines
    return (
      <div key={lIdx} className="leading-relaxed font-mono text-xs text-[#e4e4e7] whitespace-pre-wrap">
        {renderInlineHighlights(line)}
      </div>
    );
  });
}

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
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Single Unified Chat & Telemetry Stream
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Multimodal Image Attachment States (Drag & Drop, Paste, File Input)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Connect to SSE stream from native Pi Bridge for real-time telemetry streaming
  useEffect(() => {
    const sse = new EventSource('http://localhost:1425/api/stream');

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!data || !data.type) return;

        if (data.type === 'agent_start' && data.nodeId === selectedEntityId) {
          updateEntityStatus(selectedEntityId, 'WORKING', 'Agent executing prompt...');
          setChatMessages((prev) => [
            ...prev,
            {
              id: `live-assistant-${Date.now()}`,
              role: 'assistant',
              text: '',
              tools: [],
              timestamp: Date.now(),
            },
          ]);
        } else if (data.type === 'text_delta' && data.nodeId === selectedEntityId) {
          setChatMessages((prev) => {
            const list = [...prev];
            const last = list[list.length - 1];
            if (last && last.role === 'assistant') {
              list[list.length - 1] = {
                ...last,
                text: (last.text || '') + data.delta,
              };
              return list;
            }
            return [
              ...prev,
              {
                id: `live-${Date.now()}`,
                role: 'assistant',
                text: data.delta,
                timestamp: Date.now(),
              },
            ];
          });
        } else if (data.type === 'tool_start' && data.nodeId === selectedEntityId) {
          setChatMessages((prev) => {
            const list = [...prev];
            const last = list[list.length - 1];
            if (last && last.role === 'assistant') {
              const tools = last.tools ? [...last.tools] : [];
              tools.push({ type: 'call', name: data.tool, args: data.args });
              list[list.length - 1] = { ...last, tools };
              return list;
            }
            return prev;
          });
        } else if (data.type === 'tool_end' && data.nodeId === selectedEntityId) {
          setChatMessages((prev) => {
            const list = [...prev];
            const last = list[list.length - 1];
            if (last && last.role === 'assistant' && last.tools) {
              const tools = [...last.tools];
              const lastTool = tools[tools.length - 1];
              if (lastTool) {
                tools[tools.length - 1] = { ...lastTool, isError: data.isError };
                list[list.length - 1] = { ...last, tools };
              }
              return list;
            }
            return prev;
          });
        } else if (data.type === 'agent_end' && data.nodeId === selectedEntityId) {
          updateEntityStatus(selectedEntityId, 'IDLE', 'Task complete. State settled to IDLE.');
          setIsSending(false);
        }
      } catch {}
    };

    return () => {
      sse.close();
    };
  }, [selectedEntityId, updateEntityStatus]);

  // Auto-scroll to bottom of chat when new messages or turns arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isSending]);

  // Multimodal Image Helper Functions
  const processImageFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // Cap at 10 images to prevent payload explosion
    const remainingSlots = Math.max(0, 10 - attachedImages.length);
    const accepted = imageFiles.slice(0, remainingSlots);

    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setAttachedImages((prev) => [
          ...prev,
          {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name || `Pasted_Image_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`,
            size: file.size,
            previewUrl: result,
            base64: result,
            file,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Clipboard Paste Handler (Ctrl + V from Snipping Tool or Browser)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      processImageFiles(imageFiles);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer?.files) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  if (!isTerminalModalOpen || !entity) return null;

  // Set to true to connect to live Pi bridge, or false for safe UI sandbox development mode
  const IS_LIVE_BRIDGE_ACTIVE = false;

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputPrompt.trim() && attachedImages.length === 0) || isSending) return;

    const promptText = inputPrompt.trim();
    const imagesToAttach = [...attachedImages];

    setInputPrompt('');
    setAttachedImages([]);
    setIsSending(true);

    const targetCwd = resolveCwd(entity);

    // Append user message directly to the unified conversation stream
    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptText,
      attachedImages: imagesToAttach.map((i) => i.previewUrl),
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
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
            images: imagesToAttach.map((i) => i.base64),
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err: any) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'system_notice',
            text: `Failed to connect to native Pi Bridge: ${err.message}`,
            timestamp: Date.now(),
          },
        ]);
        setIsSending(false);
        updateEntityStatus(entity.id, 'IDLE', 'Error executing prompt');
      }
    } else {
      // Safe UI development simulation: zero tokens, instant clean feedback
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            text: `Perintah "${promptText || '(Image)'}" diterima di UI sandbox. Tugas selesai diproses di workspace ${targetCwd}.`,
            tools: [
              { name: 'read', args: { path: `${targetCwd}/src` } },
              { name: 'verify', args: { status: 'passed' } },
            ],
            timestamp: Date.now(),
          },
        ]);
        updateEntityStatus(entity.id, 'IDLE', 'Task finished cleanly (Sandbox)');
        setIsSending(false);
      }, 1200);
    }
  };

  const handleManualCompact = async () => {
    compactEntityMemory(entity.id);

    // Add clean compaction divider in chat history
    setChatMessages((prev) => [
      ...prev,
      {
        id: `compact-${Date.now()}`,
        role: 'system_notice',
        text: 'Session memory compacted cleanly. Old turns pruned to preserve token efficiency.',
        timestamp: Date.now(),
      },
    ]);

    try {
      await fetch('http://localhost:1425/api/compact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: entity.id }),
      });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className="w-[880px] max-w-[95vw] h-[640px] bg-[#000000] border border-[#27272a] rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative text-[#e4e4e7] font-mono"
      >
        {/* Drag and Drop Image Dropzone Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-[#000000]/90 backdrop-blur-xs z-50 flex flex-col items-center justify-center border-2 border-dashed border-[#e11d48] text-white space-y-2 pointer-events-none animate-in fade-in duration-150 font-mono">
            <div className="w-12 h-12 rounded-full bg-[#e11d48]/20 flex items-center justify-center border border-[#e11d48]/50">
              <ImageIcon className="w-6 h-6 text-[#e11d48]" />
            </div>
            <div className="text-xs font-bold text-[#facc15]">Drop Image(s) Here to Attach</div>
            <div className="text-[10px] text-[#a1a1aa]">PNG, JPG, WebP, GIF supported (Auto-staged)</div>
          </div>
        )}

        {/* WezTerm Style Window Header */}
        <div className="px-4 py-2.5 bg-[#09090b] border-b border-[#27272a] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#e11d48] animate-pulse" />
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#ffffff] font-mono">{entity.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#18181b] text-[#f43f5e] border border-[#27272a] font-semibold">
                [{entity.status}]
              </span>
              <span className="text-[10px] text-[#71717a]">
                ~ {resolveCwd(entity)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-[#71717a]">
              {chatMessages.length} turns • {((entity.tokenUsed / entity.tokenMax) * 100).toFixed(0)}% mem
            </span>
            <button
              onClick={handleManualCompact}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#3f3f46] text-xs font-semibold text-[#facc15] transition-all font-mono shadow-xs"
              title="Compact session memory"
            >
              <Scissors className="w-3 h-3 text-[#facc15]" />
              <span>Compact</span>
            </button>
            <button
              onClick={() => setIsTerminalModalOpen(false)}
              className="p-1 rounded hover:bg-[#18181b] text-[#71717a] hover:text-[#ffffff] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Content Body (Authentic WezTerm CLI Canvas) */}
        <div className="flex-1 bg-[#000000] p-4 overflow-y-auto space-y-3 font-mono text-xs">
          {/* Top WezTerm Header Line */}
          <div className="border-b border-[#27272a] pb-2 text-[11px] text-[#71717a] flex items-center justify-between">
            <div>
              <span className="text-[#38bdf8]">~ • {entity.name}</span>
              <span className="text-[#52525b] ml-2 font-mono">({entity.worktree})</span>
            </div>
            <div className="text-[#a1a1aa]">
              (antigravity) gemini-4-neon • zero-idle
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#71717a] font-mono text-xs space-y-2">
              <div className="w-5 h-5 border-2 border-[#e11d48] border-t-transparent rounded-full animate-spin" />
              <span>[reading session logs from ~/.pi/agent/sessions/...]</span>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#71717a] font-mono text-xs space-y-1 text-center">
              <div className="text-sm font-bold text-[#facc15]">&gt; Terminal Session Initialized</div>
              <p className="text-[11px] text-[#71717a]">
                Type a prompt below or paste an image (Ctrl+V) to begin execution.
              </p>
            </div>
          ) : (
            chatMessages.map((msg, index) => {
              if (msg.role === 'system_notice') {
                return (
                  <div key={msg.id || index} className="my-3 py-1 border-y border-[#27272a] text-center">
                    <span className="text-[#e879f9] text-[11px] font-mono font-semibold">
                      [✂️ {msg.text}]
                    </span>
                  </div>
                );
              }

              const isUser = msg.role === 'user';

              return (
                <div key={msg.id || index} className="space-y-1">
                  {/* User Turn Prompt Line */}
                  {isUser ? (
                    <div className="pt-2 border-t border-[#27272a] space-y-1">
                      <div className="flex items-center space-x-2 text-[#38bdf8] font-bold text-xs">
                        <span>&gt; User:</span>
                        {msg.timestamp && (
                          <span className="text-[10px] text-[#52525b] font-normal font-mono">
                            [{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                          </span>
                        )}
                      </div>

                      {/* Attached images if sent by user */}
                      {msg.attachedImages && msg.attachedImages.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 my-1.5">
                          {msg.attachedImages.map((src, imgIdx) => (
                            <div key={imgIdx} className="w-20 h-20 rounded border border-[#27272a] overflow-hidden bg-[#09090b]">
                              <img src={src} alt="Attached" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.text && (
                        <div className="text-[#f4f4f5] font-mono pl-4 leading-relaxed whitespace-pre-wrap select-text">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Assistant Turn (WezTerm High-Contrast Syntax Highlighted) */
                    <div className="space-y-1.5 pl-1">
                      {/* Tool Invocations in WezTerm CLI Style */}
                      {msg.tools && msg.tools.length > 0 && (
                        <div className="my-1.5 space-y-0.5">
                          {msg.tools.map((t: any, tIdx: number) => (
                            <div
                              key={tIdx}
                              className="text-[11px] font-mono text-[#a1a1aa] flex items-center space-x-1.5"
                            >
                              <span className="text-[#ec4899] font-bold">$</span>
                              <span className="text-[#38bdf8] font-semibold">
                                {t.name || 'tool'}
                              </span>
                              <span className="text-[#71717a] truncate max-w-[500px]">
                                {t.args ? JSON.stringify(t.args).slice(0, 90) : t.output ? String(t.output).slice(0, 70) : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Assistant Text Body formatted with WezTerm Colors */}
                      {msg.text && (
                        <div className="space-y-0.5 select-text">
                          {formatWezTermText(msg.text)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Attached Images Preview Strip */}
        {attachedImages.length > 0 && (
          <div className="px-3 py-2 bg-[#09090b] border-t border-[#27272a] flex items-center space-x-2 overflow-x-auto">
            <span className="text-[10px] font-mono text-[#a1a1aa] shrink-0 font-semibold">
              Attached ({attachedImages.length}/10):
            </span>
            <div className="flex items-center space-x-2">
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative group shrink-0 w-11 h-11 rounded border border-[#3f3f46] overflow-hidden bg-[#18181b] shadow-xs"
                >
                  <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAttachedImages((prev) => prev.filter((i) => i.id !== img.id))}
                    className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#000000]/90 hover:bg-[#ef4444] text-white flex items-center justify-center transition-colors shadow-xs"
                    title="Remove image"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hidden File Picker Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) processImageFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {/* WezTerm Style Bottom Telemetry Status Line */}
        <div className="px-3 py-1 bg-[#09090b] border-t border-[#27272a] flex items-center justify-between text-[10px] text-[#71717a] font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-[#38bdf8]">~ • {entity.name}</span>
            <span>|</span>
            <span>↑14M ↓808k</span>
            <span>|</span>
            <span className="text-[#10b981]">mem: {((entity.tokenUsed / entity.tokenMax) * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>(antigravity) gemini-4-neon • medium</span>
          </div>
        </div>

        {/* WezTerm CLI Style Input Bar */}
        <form onSubmit={handleSendPrompt} className="p-2 bg-[#09090b] border-t border-[#27272a] flex items-center space-x-2 font-mono">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded hover:bg-[#18181b] text-[#71717a] hover:text-[#facc15] border border-[#27272a] transition-colors shrink-0"
            title="Insert / Attach Image (or paste with Ctrl+V / drag & drop)"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>

          <div className="text-[#f43f5e] font-mono text-xs font-bold pl-1">&gt;</div>
          <input
            type="text"
            placeholder={
              isSending
                ? `Executing prompt in ${resolveCwd(entity)}...`
                : `Type prompt or paste image (Ctrl+V)...`
            }
            value={inputPrompt}
            disabled={isSending}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 bg-[#000000] border border-[#27272a] rounded text-xs px-3 py-1.5 text-[#f4f4f5] placeholder-[#52525b] focus:outline-none focus:border-[#f43f5e] font-mono disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={(!inputPrompt.trim() && attachedImages.length === 0) || isSending}
            className="px-3.5 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] hover:text-[#ffffff] text-xs font-bold text-[#f43f5e] border border-[#27272a] disabled:opacity-30 shadow-xs flex items-center space-x-1 font-mono shrink-0 transition-colors"
          >
            <Send className="w-3 h-3 text-[#f43f5e]" />
            <span>{isSending ? 'Running...' : 'Send ↵'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
