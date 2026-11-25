import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAxonStore, AVAILABLE_SKILLS } from '../store/axonStore';
import { X, Scissors, Send, Image as ImageIcon, Square } from 'lucide-react';

interface SlashCommandItem {
  command: string;
  description: string;
  kind: 'command' | 'skill' | 'active-skill';
}

const PI_BUILTIN_COMMANDS: SlashCommandItem[] = [
  { command: '/compact', description: 'Compact session memory and prune old turns', kind: 'command' },
  { command: '/thinking', description: 'Cycle reasoning effort (off / low / medium / high)', kind: 'command' },
  { command: '/model', description: 'Switch active model (gemini-4-neon, 3.8-flash, carbon, hydrogen)', kind: 'command' },
  { command: '/role', description: 'Inspect or switch active agent role and linked skills', kind: 'command' },
  { command: '/clear', description: 'Clear terminal display buffer', kind: 'command' },
  { command: '/new', description: 'Start a fresh session in this workspace', kind: 'command' },
  { command: '/resume', description: 'Resume another saved Pi session', kind: 'command' },
  { command: '/tree', description: 'Inspect conversation branch tree', kind: 'command' },
  { command: '/export', description: 'Export session transcript', kind: 'command' },
  { command: '/reload', description: 'Reload extensions, skills, and prompt templates', kind: 'command' },
  { command: '/settings', description: 'Show Pi runtime settings', kind: 'command' },
  { command: '/help', description: 'List available slash commands and shortcuts', kind: 'command' },
];

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
 * 100% Authentic WezTerm / Pi CLI Syntax Highlighting:
 * - Font: JetBrains Mono / Cascadia Code
 * - Headings (###): Bright Yellow (#ffff00)
 * - Lists (1., 2.): Bright Magenta (#ff00ff)
 * - Bullets (-): Magenta / Off-White
 * - Inline Code (`code`) & URLs: Bright Magenta (#ff79c6 / #ff00ff)
 * - Bold (**text**): Pure White (#ffffff)
 * - Body Text: ANSI Light Gray (#d4d4d4)
 * - Dividers (---): Dark Gray (#262626)
 */
function renderInlineHighlights(str: string) {
  // Regex to split by `code`, **bold**, and URLs
  const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g);

  return parts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <span key={pIdx} className="text-[#ff79c6] font-mono">
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
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <span key={pIdx} className="text-[#ff00ff] underline font-mono hover:text-[#ff79c6]">
          {part}
        </span>
      );
    }
    return <span key={pIdx} className="text-[#d4d4d4]">{part}</span>;
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
        <div key={lIdx} className="border-t border-[#262626] my-2 w-full" />
      );
    }

    // Markdown Headers: ### Header -> Bright Yellow (#ffff00)
    if (trimmed.startsWith('###')) {
      return (
        <div key={lIdx} className="text-[#ffff00] font-bold text-[14px] mt-3.5 mb-1 tracking-normal">
          {line.replace(/^###\s*/, '### ')}
        </div>
      );
    }
    if (trimmed.startsWith('##')) {
      return (
        <div key={lIdx} className="text-[#ffff00] font-bold text-[14px] mt-3.5 mb-1 tracking-normal">
          {line.replace(/^##\s*/, '## ')}
        </div>
      );
    }

    // Numbered List: 1. , 2. -> Bright Magenta (#ff00ff)
    const numberedMatch = line.match(/^(\s*)(\d+\.)\s*(.*)/);
    if (numberedMatch) {
      const indent = numberedMatch[1];
      const num = numberedMatch[2];
      const rest = numberedMatch[3];
      return (
        <div key={lIdx} className="flex items-start space-x-1.5 leading-[1.55] text-[14px] text-[#d4d4d4]">
          <span className="text-[#ff00ff] font-bold shrink-0">{indent}{num}</span>
          <span>{renderInlineHighlights(rest)}</span>
        </div>
      );
    }

    // Bullet Points: - or *
    const bulletMatch = line.match(/^(\s*)([-*])\s*(.*)/);
    if (bulletMatch) {
      const indent = bulletMatch[1];
      const rest = bulletMatch[3];
      return (
        <div key={lIdx} className="flex items-start space-x-1.5 leading-[1.55] text-[14px] text-[#d4d4d4]">
          <span className="text-[#ff00ff] shrink-0 font-bold">{indent}-</span>
          <span>{renderInlineHighlights(rest)}</span>
        </div>
      );
    }

    // Compaction notice line
    if (trimmed.startsWith('[COMPACT]') || trimmed.includes('compacted cleanly')) {
      return (
        <div key={lIdx} className="my-2 py-0.5 text-[#ff79c6] text-[13px] font-semibold">
          {renderInlineHighlights(line)}
        </div>
      );
    }

    // Regular terminal lines
    return (
      <div key={lIdx} className="leading-[1.55] text-[14px] text-[#d4d4d4] whitespace-pre-wrap">
        {renderInlineHighlights(line)}
      </div>
    );
  });
}

const ChatMessageRow = React.memo(({ msg }: { msg: ChatMessageItem }) => {
  if (msg.role === 'system_notice') {
    return (
      <div className="my-2.5 py-1 border-y border-[#262626] text-center select-none">
        <span className="text-[#ff79c6] text-[12px] font-semibold">
          [COMPACT] {msg.text}
        </span>
      </div>
    );
  }

  const isUser = msg.role === 'user';

  return (
    <div className="space-y-1">
      {isUser ? (
        <div className="pt-2.5 border-t border-[#262626] space-y-1">
          <div className="flex items-center space-x-2 text-[#00ffff] font-bold text-[13px]">
            <span>&gt; User:</span>
            {msg.timestamp && (
              <span className="text-[11px] text-[#737373] font-normal">
                [{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
              </span>
            )}
          </div>

          {msg.attachedImages && msg.attachedImages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 my-1.5">
              {msg.attachedImages.map((src, imgIdx) => (
                <div key={imgIdx} className="w-24 h-24 rounded border border-[#262626] overflow-hidden bg-[#0a0a0a]">
                  <img src={src} alt="Attached" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {msg.text && (
            <div className="text-[#ffffff] pl-3 text-[14px] leading-[1.55] whitespace-pre-wrap select-text">
              {msg.text}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1 pl-1">
          {msg.tools && msg.tools.length > 0 && (
            <div className="my-1.5 space-y-0.5">
              {msg.tools.map((t: any, tIdx: number) => (
                <div
                  key={tIdx}
                  className="text-[12.5px] text-[#a3a3a3] flex items-center space-x-1.5"
                >
                  <span className="text-[#ff00ff] font-bold">$</span>
                  <span className="text-[#00ffff] font-semibold">
                    {t.name || 'tool'}
                  </span>
                  <span className="text-[#737373] truncate max-w-[550px]">
                    {t.args ? JSON.stringify(t.args).slice(0, 95) : t.output ? String(t.output).slice(0, 75) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {msg.text && (
            <div className="space-y-0.5 select-text">
              {formatWezTermText(msg.text)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const ChatMessageList = React.memo(
  ({
    messages,
    visibleCount,
    onLoadEarlier,
  }: {
    messages: ChatMessageItem[];
    visibleCount: number;
    onLoadEarlier: () => void;
  }) => {
    const visibleMessages = useMemo(
      () => (messages.length > visibleCount ? messages.slice(-visibleCount) : messages),
      [messages, visibleCount]
    );
    const hiddenCount = Math.max(0, messages.length - visibleMessages.length);

    return (
      <>
        {hiddenCount > 0 && (
          <div className="flex justify-center py-2 select-none">
            <button
              type="button"
              onClick={onLoadEarlier}
              className="px-3 py-1 rounded bg-[#18181b] hover:bg-[#262626] border border-[#262626] text-[12px] text-[#00ffff] transition-colors"
            >
              [Load earlier turns (+100) • {hiddenCount} hidden]
            </button>
          </div>
        )}
        {visibleMessages.map((msg, index) => (
          <ChatMessageRow key={msg.id || index} msg={msg} />
        ))}
      </>
    );
  }
);

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
  const [agentPhase, setAgentPhase] = useState<'idle' | 'working' | 'thinking' | 'tool' | 'streaming'>('idle');
  const [activeToolName, setActiveToolName] = useState<string>('');
  const [activeToolDetail, setActiveToolDetail] = useState<string>('');
  const [thinkingPreview, setThinkingPreview] = useState<string>('');
  const [activeModel, setActiveModel] = useState('gemini-3.8-flash');
  const [thinkingLevel, setThinkingLevel] = useState<'off' | 'low' | 'medium' | 'high'>('medium');
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Single Unified Chat & Telemetry Stream
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(80);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleLoadEarlier = useCallback(() => {
    setVisibleCount((prev) => prev + 100);
  }, []);

  // Multimodal Image Attachment States (Drag & Drop, Paste, File Input)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entity = entities.find((e) => e.id === selectedEntityId);

  // Build combined Pi Slash Commands + Active Session Skills + Local Installed Skills
  const allSlashItems = useMemo<SlashCommandItem[]>(() => {
    const activeSkills = entity?.skills || [];
    const seen = new Set<string>();
    const skillItems: SlashCommandItem[] = [];

    activeSkills.forEach((s) => {
      const clean = s.startsWith('github:') ? s.replace('github:', '') : s;
      const cmd = `/skill:${clean}`;
      if (!seen.has(cmd)) {
        seen.add(cmd);
        skillItems.push({
          command: cmd,
          description: s.startsWith('github:')
            ? `Active GitHub skill (${s})`
            : 'Active skill attached to this session',
          kind: 'active-skill',
        });
      }
    });

    AVAILABLE_SKILLS.forEach((sk) => {
      const cmd = `/skill:${sk.id}`;
      if (!seen.has(cmd)) {
        seen.add(cmd);
        skillItems.push({
          command: cmd,
          description: sk.description,
          kind: 'skill',
        });
      }
    });

    return [...PI_BUILTIN_COMMANDS, ...skillItems];
  }, [entity?.skills]);

  const showSlashMenu =
    !slashDismissed && inputPrompt.startsWith('/') && !inputPrompt.includes(' ');

  const filteredSlashItems = useMemo(() => {
    if (!showSlashMenu) return [];
    const query = inputPrompt.toLowerCase();
    return allSlashItems.filter(
      (item) =>
        item.command.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query.slice(1))
    );
  }, [showSlashMenu, inputPrompt, allSlashItems]);

  useEffect(() => {
    setSlashSelectedIdx(0);
  }, [inputPrompt]);

  // Worktree real directory mapping
  const resolveCwd = (ent: typeof entity) => {
    if (!ent) return '/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning';
    if (ent.worktreePath) return ent.worktreePath;
    const label = `${ent.name || ''} ${ent.worktree || ''}`.toLowerCase();
    if (ent.worktree === 'feat/belajar-page') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-part1';
    if (ent.worktree === 'feat/cerita-page') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-part2';
    if (ent.worktree === 'feat/assets') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-assets';
    if (ent.worktree === 'axon/main' || label.includes('axon')) return '/mnt/c/Users/Pongo/axon';
    if (label.includes('matcha')) return '/mnt/c/Users/Pongo/matcha-showcase';
    return '/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning';
  };

  // Force abort running Pi execution (Esc shortcut or Stop button)
  const handleAbortExecution = useCallback(async () => {
    if (!entity || !isSending) return;
    try {
      await fetch('http://127.0.0.1:1425/api/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: entity.id }),
      });
    } catch {
      // still unlock local UI immediately
    }
    setIsSending(false);
    setAgentPhase('idle');
    setActiveToolName('');
    setActiveToolDetail('');
    setThinkingPreview('');
    updateEntityStatus(entity.id, 'IDLE', 'Aborted by user (Esc)');
    setChatMessages((prev) => [
      ...prev,
      {
        id: `abort-${Date.now()}`,
        role: 'system_notice',
        text: 'Execution aborted by user (Esc)',
        timestamp: Date.now(),
      },
    ]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [entity, isSending, updateEntityStatus]);

  // Global Esc keyboard shortcut to force stop running execution
  useEffect(() => {
    if (!isTerminalModalOpen || !isSending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleAbortExecution();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTerminalModalOpen, isSending, handleAbortExecution]);

  // Fetch real session history (.jsonl) whenever modal opens or active entity changes
  useEffect(() => {
    if (!isTerminalModalOpen || !entity) return;

    // Reset per-node transient streaming UI state so one session never bleeds into another
    setIsSending(false);
    setAgentPhase('idle');
    setActiveToolName('');
    setActiveToolDetail('');
    setThinkingPreview('');
    setIsLoadingHistory(true);
    setVisibleCount(80);
    const targetLookup = entity.uuid || entity.id;

    const loadHistory = async () => {
      try {
        let res = await fetch(`http://127.0.0.1:1425/api/session-history?id=${encodeURIComponent(targetLookup)}`).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch(`/api/session-history?id=${encodeURIComponent(targetLookup)}`);
        }
        if (!res.ok) throw new Error('Session history not found');
        const data = await res.json();
        if (data && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
        } else {
          setChatMessages([]);
        }
      } catch {
        setChatMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [entity?.id, entity?.uuid, isTerminalModalOpen]);

  // Connect to SSE stream from native Pi Bridge for real-time telemetry streaming (Axon UI + Telegram Jarvis 2-Way Sync)
  useEffect(() => {
    const sse = new EventSource('http://127.0.0.1:1425/api/stream');
    const currentCwd = entity ? resolveCwd(entity) : '';
    const currentUuid = entity?.uuid || '';

    const isTargetMatch = (data: any) => {
      if (!selectedEntityId) return false;
      if (data.nodeId && data.nodeId === selectedEntityId) return true;
      if (
        data.sessionFile &&
        currentUuid &&
        (data.sessionFile === currentUuid ||
          data.sessionFile.includes(currentUuid) ||
          currentUuid.includes(data.sessionFile))
      ) {
        return true;
      }
      if (data.cwd && currentCwd && data.cwd === currentCwd) return true;
      return false;
    };

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!data || !data.type) return;
        if (!isTargetMatch(data)) return;

        if (data.type === 'user_message') {
          setIsSending(true);
          setAgentPhase('working');
          setChatMessages((prev) => [
            ...prev,
            {
              id: `tg-user-${data.timestamp || Date.now()}`,
              role: 'user',
              text: data.text || '',
              timestamp: data.timestamp || Date.now(),
            },
          ]);
        } else if (data.type === 'agent_start') {
          setIsSending(true);
          setAgentPhase('working');
          setThinkingPreview('');
          setActiveToolName('');
          if (data.model) {
            const parts = String(data.model).split('/');
            if (parts[1]) setActiveModel(parts[1]);
          }
          updateEntityStatus(selectedEntityId!, 'WORKING', 'Agent executing prompt...');
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
        } else if (data.type === 'thinking_delta') {
          setAgentPhase('thinking');
          setThinkingPreview((prev) => (prev + (data.delta || '')).slice(-140));
        } else if (data.type === 'text_delta') {
          setAgentPhase('streaming');
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
        } else if (data.type === 'tool_start') {
          setAgentPhase('tool');
          setActiveToolName(data.tool || 'tool');
          const detail =
            data.args?.command ||
            data.args?.path ||
            data.args?.query ||
            (data.args ? JSON.stringify(data.args).slice(0, 90) : '');
          setActiveToolDetail(String(detail).slice(0, 110));
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
        } else if (data.type === 'tool_end') {
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
        } else if (data.type === 'agent_end') {
          updateEntityStatus(selectedEntityId!, 'IDLE', 'Task complete. State settled to IDLE.');
          setAgentPhase('idle');
          setActiveToolName('');
          setActiveToolDetail('');
          setThinkingPreview('');
          setIsSending(false);
        } else if (data.type === 'agent_aborted') {
          updateEntityStatus(selectedEntityId!, 'IDLE', 'Aborted by user (Esc)');
          setAgentPhase('idle');
          setActiveToolName('');
          setActiveToolDetail('');
          setThinkingPreview('');
          setIsSending(false);
        } else if (data.type === 'agent_error') {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: 'system_notice',
              text: `Pi Agent Error: ${data.error || 'Unknown error'}`,
              timestamp: Date.now(),
            },
          ]);
          updateEntityStatus(selectedEntityId!, 'IDLE', 'Error executing prompt');
          setAgentPhase('idle');
          setActiveToolName('');
          setActiveToolDetail('');
          setThinkingPreview('');
          setIsSending(false);
        }
      } catch {}
    };

    return () => {
      sse.close();
    };
  }, [selectedEntityId, entity?.uuid, entity?.name, entity?.worktree, updateEntityStatus]);

  // Auto-scroll to bottom of chat when new messages or turns arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [chatMessages.length, isSending]);

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

  // Live Pi Native Bridge enabled (connects to http://127.0.0.1:1425)
  const IS_LIVE_BRIDGE_ACTIVE = true;

  const handleSelectSlashItem = (item: SlashCommandItem) => {
    const needsArg =
      item.command === '/model' ||
      item.command === '/role' ||
      item.command.startsWith('/skill:');
    setInputPrompt(needsArg ? `${item.command} ` : item.command);
    setSlashDismissed(true);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSlashMenu || filteredSlashItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSlashSelectedIdx((prev) => (prev + 1) % filteredSlashItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSlashSelectedIdx(
        (prev) => (prev - 1 + filteredSlashItems.length) % filteredSlashItems.length
      );
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const chosen = filteredSlashItems[slashSelectedIdx];
      if (chosen) handleSelectSlashItem(chosen);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSlashDismissed(true);
    } else if (e.key === 'Enter') {
      const chosen = filteredSlashItems[slashSelectedIdx];
      if (chosen && chosen.command !== inputPrompt.trim()) {
        e.preventDefault();
        handleSelectSlashItem(chosen);
      }
    }
  };

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputPrompt.trim() && attachedImages.length === 0) || isSending) return;

    const promptText = inputPrompt.trim();
    const imagesToAttach = [...attachedImages];

    // Handle local Pi slash commands instantaneously (0 tokens)
    if (promptText === '/compact') {
      setInputPrompt('');
      setSlashDismissed(false);
      await handleManualCompact();
      return;
    }

    if (promptText === '/clear') {
      setInputPrompt('');
      setSlashDismissed(false);
      setChatMessages([]);
      return;
    }

    if (promptText.startsWith('/thinking')) {
      setInputPrompt('');
      setSlashDismissed(false);
      const arg = promptText.split(/\s+/)[1]?.toLowerCase();
      const levels: Array<'off' | 'low' | 'medium' | 'high'> = ['off', 'low', 'medium', 'high'];
      const nextLevel =
        arg && levels.includes(arg as any)
          ? (arg as 'off' | 'low' | 'medium' | 'high')
          : levels[(levels.indexOf(thinkingLevel) + 1) % levels.length];
      setThinkingLevel(nextLevel);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'system_notice',
          text: `Thinking level set to: ${nextLevel}`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    if (promptText.startsWith('/model')) {
      setInputPrompt('');
      setSlashDismissed(false);
      const arg = promptText.split(/\s+/)[1];
      const models = ['gemini-4-neon', 'gemini-3.8-flash', 'gemini-4-hydrogen', 'gemini-4-carbon'];
      const nextModel = arg || models[(models.indexOf(activeModel) + 1) % models.length];
      setActiveModel(nextModel);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'system_notice',
          text: `Active model switched to: (antigravity) ${nextModel}`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    if (promptText === '/help') {
      setInputPrompt('');
      setSlashDismissed(false);
      const summary = PI_BUILTIN_COMMANDS.map((c) => `- \`${c.command}\` — ${c.description}`).join('\n');
      setChatMessages((prev) => [
        ...prev,
        {
          id: `help-${Date.now()}`,
          role: 'assistant',
          text: `### Pi Slash Commands & Skills\n${summary}\n\nTip: Ketik \`/\` di awal prompt untuk membuka daftar command & \`/skill:<nama>\` secara otomatis.`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    setInputPrompt('');
    setSlashDismissed(false);
    setAttachedImages([]);
    setIsSending(true);
    setAgentPhase('working');
    setThinkingPreview('');
    setActiveToolName('');

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
        const res = await fetch('http://127.0.0.1:1425/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: entity.id,
            sessionId: entity.uuid || entity.id,
            cwd: targetCwd,
            prompt: promptText,
            thinkingLevel,
            images: imagesToAttach.map((i) => i.base64).filter(Boolean),
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
        text: 'Session memory compacted cleanly • Token footprint refreshed',
        timestamp: Date.now(),
      },
    ]);

    try {
      await fetch('http://127.0.0.1:1425/api/compact', {
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
        className="w-[900px] max-w-[96vw] h-[650px] bg-[#000000] border border-[#262626] rounded-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative text-[#d4d4d4] wezterm-terminal"
      >
        {/* Drag and Drop Image Dropzone Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-[#000000]/95 backdrop-blur-xs z-50 flex flex-col items-center justify-center border-2 border-dashed border-[#ff00ff] text-white space-y-2 pointer-events-none animate-in fade-in duration-150 font-mono">
            <div className="w-12 h-12 rounded-full bg-[#ff00ff]/20 flex items-center justify-center border border-[#ff00ff]/50">
              <ImageIcon className="w-6 h-6 text-[#ff00ff]" />
            </div>
            <div className="text-xs font-bold text-[#ffff00]">Drop Image(s) Here to Attach</div>
            <div className="text-[10px] text-[#737373]">PNG, JPG, WebP, GIF supported (Auto-staged)</div>
          </div>
        )}

        {/* WezTerm Style Window Header Bar */}
        <div className="px-4 py-2 bg-[#000000] border-b border-[#262626] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#e11d48] animate-pulse" />
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#ffffff]">{entity.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#18181b] text-[#ff00ff] border border-[#262626] font-semibold">
                [{entity.status}]
              </span>
              <span className="text-[10px] text-[#737373]">
                ~ {resolveCwd(entity)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-[#737373]">
              {chatMessages.length} turns • {((entity.tokenUsed / entity.tokenMax) * 100).toFixed(0)}% mem
            </span>
            <button
              onClick={handleManualCompact}
              className="flex items-center space-x-1 px-2.5 py-0.5 rounded bg-[#18181b] hover:bg-[#262626] border border-[#262626] text-xs font-semibold text-[#ffff00] transition-all font-mono"
              title="Compact session memory"
            >
              <Scissors className="w-3 h-3 text-[#ffff00]" />
              <span>Compact</span>
            </button>
            <button
              onClick={() => setIsTerminalModalOpen(false)}
              className="p-1 rounded hover:bg-[#18181b] text-[#737373] hover:text-[#ffffff] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Content Body (Authentic WezTerm CLI Monospace Canvas) */}
        <div className="flex-1 bg-[#000000] p-5 overflow-y-auto space-y-3.5 text-[14px] leading-[1.55] select-text">
          {/* Top Divider */}
          <div className="border-b border-[#262626] pb-2 text-[12px] text-[#737373] flex items-center justify-between select-none">
            <div>
              <span className="text-[#00ffff]">~ • {entity.name}</span>
              <span className="text-[#525252] ml-2">({entity.worktree})</span>
            </div>
            <div className="text-[#737373]">
              (antigravity) gemini-4-neon • zero-idle
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#737373] text-[13px] space-y-2 select-none">
              <div className="w-5 h-5 border-2 border-[#ff00ff] border-t-transparent rounded-full animate-spin" />
              <span>[reading session logs from ~/.pi/agent/sessions/...]</span>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#737373] text-[13px] space-y-1 text-center select-none">
              <div className="text-[14px] font-bold text-[#ffff00]">&gt; Terminal Session Initialized</div>
              <p className="text-[12px] text-[#737373]">
                Type prompt or paste screenshot (Ctrl+V) to begin execution.
              </p>
            </div>
          ) : (
            <ChatMessageList
              messages={chatMessages}
              visibleCount={visibleCount}
              onLoadEarlier={handleLoadEarlier}
            />
          )}

          {/* Live Thinking / Working Status Indicator */}
          {isSending && (
            <div className="pt-2 flex items-start space-x-2.5 text-[13px] select-none">
              <div className="w-3.5 h-3.5 mt-0.5 border-2 border-[#ff00ff] border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-[#ffff00] whitespace-nowrap shrink-0">
                    {agentPhase === 'thinking'
                      ? '[THINKING]'
                      : agentPhase === 'tool'
                      ? `[WORKING • $ ${activeToolName}]`
                      : agentPhase === 'streaming'
                      ? '[STREAMING]'
                      : '[WORKING]'}
                  </span>
                  <span className="text-[#a3a3a3] truncate max-w-[600px]">
                    {agentPhase === 'thinking'
                      ? 'Model sedang berpikir...'
                      : agentPhase === 'tool'
                      ? activeToolDetail || `Menjalankan tool ${activeToolName}...`
                      : agentPhase === 'streaming'
                      ? 'Menulis respons...'
                      : 'Menghubungi Pi engine (antigravity)...'}
                  </span>
                  <span className="text-[11px] text-[#737373] border border-[#262626] rounded px-1.5 py-0.2 shrink-0">
                    Esc to stop
                  </span>
                </div>
                {agentPhase === 'thinking' && thinkingPreview && (
                  <div className="text-[12px] text-[#737373] italic truncate max-w-[780px]">
                    {thinkingPreview.replace(/\s+/g, ' ').trim()}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Attached Images Preview Strip */}
        {attachedImages.length > 0 && (
          <div className="px-3 py-2 bg-[#0a0a0a] border-t border-[#262626] flex items-center space-x-2 overflow-x-auto">
            <span className="text-[10px] font-mono text-[#737373] shrink-0 font-semibold">
              Attached ({attachedImages.length}/10):
            </span>
            <div className="flex items-center space-x-2">
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative group shrink-0 w-11 h-11 rounded border border-[#262626] overflow-hidden bg-[#000000] shadow-xs"
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

        {/* Pi Slash Command & Skill Autocomplete Palette */}
        {showSlashMenu && filteredSlashItems.length > 0 && (
          <div className="mx-2.5 mb-1.5 bg-[#09090b] border border-[#262626] rounded shadow-2xl overflow-hidden select-none">
            <div className="px-3 py-1 bg-[#111113] border-b border-[#262626] flex items-center justify-between text-[11px] text-[#737373]">
              <span>Pi Commands &amp; Skills ({filteredSlashItems.length})</span>
              <span>↑↓ navigate • Tab/Enter select • Esc close</span>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-[#18181b]">
              {filteredSlashItems.map((item, idx) => {
                const isSelected = idx === slashSelectedIdx;
                return (
                  <button
                    key={item.command}
                    type="button"
                    onMouseEnter={() => setSlashSelectedIdx(idx)}
                    onClick={() => handleSelectSlashItem(item)}
                    className={`w-full px-3 py-1.5 flex items-center justify-between text-left text-[13px] transition-colors ${
                      isSelected ? 'bg-[#18181b] text-[#ffffff]' : 'bg-transparent text-[#d4d4d4] hover:bg-[#111113]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className={`font-bold shrink-0 ${
                          item.kind === 'command'
                            ? 'text-[#00ffff]'
                            : item.kind === 'active-skill'
                            ? 'text-[#ff00ff]'
                            : 'text-[#ffff00]'
                        }`}
                      >
                        {item.command}
                      </span>
                      <span className="text-[12px] text-[#737373] truncate">
                        {item.description}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded shrink-0 ml-2 border ${
                        item.kind === 'command'
                          ? 'text-[#00ffff] border-[#00ffff]/30 bg-[#00ffff]/10'
                          : item.kind === 'active-skill'
                          ? 'text-[#ff00ff] border-[#ff00ff]/30 bg-[#ff00ff]/10'
                          : 'text-[#a3e635] border-[#a3e635]/30 bg-[#a3e635]/10'
                      }`}
                    >
                      {item.kind === 'command' ? 'CMD' : item.kind === 'active-skill' ? 'ACTIVE' : 'SKILL'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* WezTerm Style Bottom Telemetry Status Line */}
        <div className="px-3.5 py-1.5 bg-[#000000] border-t border-[#262626] flex items-center justify-between text-[12px] text-[#737373] select-none">
          <div className="flex items-center space-x-2">
            <span className="text-[#00ffff]">~ • {entity.name}</span>
            <span>|</span>
            <span>↑14M ↓808k R323M CH99.3%</span>
            <span>|</span>
            <span className="text-[#a3e635]">{((entity.tokenUsed / entity.tokenMax) * 100).toFixed(0)}%/1.0M (auto)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>(antigravity) {activeModel} • {thinkingLevel}</span>
          </div>
        </div>

        {/* WezTerm CLI Style Input Bar */}
        <form onSubmit={handleSendPrompt} className="p-2.5 bg-[#000000] border-t border-[#262626] flex items-center space-x-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded hover:bg-[#18181b] text-[#737373] hover:text-[#ffff00] border border-[#262626] transition-colors shrink-0"
            title="Attach Image (Ctrl+V / Drag & Drop)"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <div className="text-[#ff00ff] text-[14px] font-bold pl-1">&gt;</div>
          <input
            ref={inputRef}
            type="text"
            placeholder={
              isSending
                ? `Executing prompt in ${resolveCwd(entity)}...`
                : `Type / for commands & skills, or paste image (Ctrl+V)...`
            }
            value={inputPrompt}
            disabled={isSending}
            onChange={(e) => {
              setInputPrompt(e.target.value);
              setSlashDismissed(false);
            }}
            onKeyDown={handleInputKeyDown}
            className="flex-1 bg-[#000000] border border-[#262626] rounded text-[14px] px-3 py-1.5 text-[#ffffff] placeholder-[#525252] focus:outline-none focus:border-[#ff00ff] disabled:opacity-50"
            autoFocus
          />
          {isSending ? (
            <button
              type="button"
              onClick={handleAbortExecution}
              className="px-3.5 py-1.5 rounded bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[13px] font-bold text-[#f87171] border border-[#ef4444]/40 shadow-xs flex items-center space-x-1.5 shrink-0 transition-colors"
              title="Force stop execution (Esc)"
            >
              <Square className="w-3 h-3 fill-[#f87171] text-[#f87171]" />
              <span>Stop (Esc)</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputPrompt.trim() && attachedImages.length === 0}
              className="px-3.5 py-1.5 rounded bg-[#18181b] hover:bg-[#262626] hover:text-[#ffffff] text-[13px] font-bold text-[#ff00ff] border border-[#262626] disabled:opacity-30 shadow-xs flex items-center space-x-1 shrink-0 transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-[#ff00ff]" />
              <span>Send ↵</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
