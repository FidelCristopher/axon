import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAxonStore } from '../store/axonStore';
import type { GraphEntity } from '../types/axon';
import { X, RotateCw, Image as ImageIcon } from 'lucide-react';

function resolveEntityCwd(ent: GraphEntity | undefined): string {
  if (!ent) return '/mnt/c/Users/Pongo';
  if (ent.worktreePath) return ent.worktreePath;
  const label = `${ent.name || ''} ${ent.worktree || ''}`.toLowerCase();
  if (ent.worktree === 'feat/belajar-page') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-part1';
  if (ent.worktree === 'feat/cerita-page') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-part2';
  if (ent.worktree === 'feat/assets') return '/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-assets';
  if (ent.worktree === 'axon/main' || label.includes('axon')) return '/mnt/c/Users/Pongo/axon';
  if (label.includes('matcha')) return '/mnt/c/Users/Pongo/matcha-showcase';
  if (label.includes('chinese') || label.includes('hanzi')) return '/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning';
  return '/mnt/c/Users/Pongo';
}

interface NativePiPtyPaneProps {
  entity: GraphEntity;
  isActiveVisible: boolean;
  onMinimize: () => void;
}

/**
 * Persistent Native Pi PTY Pane.
 * Stays mounted in DOM even when minimized (X) or switching tabs so xterm.js & WebSocket
 * NEVER disconnect, NEVER replay garbled ANSI diffs, and ALWAYS reopen in 0ms with full focus.
 */
const NativePiPtyPane: React.FC<NativePiPtyPaneProps> = ({
  entity,
  isActiveVisible,
  onMinimize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isActiveRef = useRef(isActiveVisible);
  isActiveRef.current = isActiveVisible;

  const [connStatus, setConnStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [restartNonce, setRestartNonce] = useState(0);

  const cwdDisplay = resolveEntityCwd(entity);

  const sendPtyInput = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  const uploadAndInjectImages = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, 10);
      if (imageFiles.length === 0) return;

      const paths: string[] = [];
      for (const file of imageFiles) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        if (!base64) continue;
        try {
          const res = await fetch('http://127.0.0.1:1425/api/pty/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64 }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.path) {
            paths.push(data.path);
          }
        } catch {
          // ignore upload failure
        }
      }

      if (paths.length > 0) {
        sendPtyInput(paths.join(' ') + ' ');
        termRef.current?.focus();
      }
    },
    [sendPtyInput]
  );

  // Mount xterm.js ONCE per entity (only re-runs on explicit Restart Pi)
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
      fontSize: 14,
      lineHeight: 1.32,
      scrollback: 10000,
      allowProposedApi: true,
      theme: {
        background: '#000000',
        foreground: '#e5e5e5',
        cursor: '#ff00ff',
        cursorAccent: '#000000',
        selectionBackground: '#3f3f46',
        black: '#000000',
        red: '#ef4444',
        green: '#a3e635',
        yellow: '#ffff00',
        blue: '#3b82f6',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#e5e5e5',
        brightBlack: '#737373',
        brightRed: '#f87171',
        brightGreen: '#bef264',
        brightYellow: '#fef08a',
        brightBlue: '#60a5fa',
        brightMagenta: '#ff79c6',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    try {
      fitAddon.fit();
    } catch {
      // container may be hidden initially
    }

    termRef.current = term;
    fitRef.current = fitAddon;

    const cwd = resolveEntityCwd(entity);
    const sessionLookup = entity.uuid || entity.id;

    let isDisposed = false;
    let reconnectTimer: number | null = null;
    let shouldRestartOnce = restartNonce > 0;

    const syncSize = () => {
      if (!isActiveRef.current) return;
      try {
        fitAddon.fit();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN && term.cols > 10 && term.rows > 4) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {
        // ignore resize race
      }
    };

    const connectWs = () => {
      if (isDisposed) return;
      setConnStatus('connecting');
      const cols = Math.max(40, term.cols || 120);
      const rows = Math.max(10, term.rows || 34);

      const wsUrl =
        `ws://127.0.0.1:1425/ws/pty?nodeId=${encodeURIComponent(entity.id)}` +
        `&cwd=${encodeURIComponent(cwd)}` +
        `&sessionFile=${encodeURIComponent(sessionLookup)}` +
        `&cols=${cols}&rows=${rows}` +
        (shouldRestartOnce ? '&restart=1' : '');

      shouldRestartOnce = false;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isDisposed) {
          ws.close();
          return;
        }
        setConnStatus('connected');
        syncSize();
        if (isActiveRef.current) term.focus();
      };

      let receivedFirstOutput = false;
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'output' && typeof msg.data === 'string') {
            if (!receivedFirstOutput) {
              receivedFirstOutput = true;
              term.clear();
            }
            term.write(msg.data);
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setConnStatus('disconnected');
      };

      ws.onclose = () => {
        if (isDisposed) return;
        setConnStatus('disconnected');
        term.write('\r\n\x1b[33m[Axon Bridge reconnecting automatically...]\x1b[0m\r\n');
        reconnectTimer = window.setTimeout(() => {
          connectWs();
        }, 1500);
      };
    };

    term.writeln('\x1b[36m[Connecting to native Pi PTY...]\x1b[0m');
    connectWs();

    // Forward all terminal keystrokes directly to real Pi PTY
    const dataDisp = term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle Ctrl+C copy when text is selected, and Ctrl+V for text + image paste
    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type === 'keydown' && ev.ctrlKey && ev.key.toLowerCase() === 'c') {
        if (term.hasSelection()) {
          navigator.clipboard?.writeText(term.getSelection()).catch(() => {});
          term.clearSelection();
          return false;
        }
        return true; // pass Ctrl+C (\x03) to Pi
      }
      if (ev.type === 'keydown' && ev.ctrlKey && ev.key.toLowerCase() === 'v') {
        return false; // handled by capture-phase paste listener below
      }
      return true;
    });

    // Keep PTY dimensions synced whenever visible container resizes
    const resizeObserver = new ResizeObserver(() => {
      syncSize();
    });
    resizeObserver.observe(container);

    // Handle Ctrl+V paste in CAPTURE phase (only when THIS pane is actively visible!)
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isActiveRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const f = items[i].getAsFile();
          if (f) imageFiles.push(f);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        await uploadAndInjectImages(imageFiles);
        return;
      }

      const text = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text');
      if (text) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data: text }));
        }
      }
    };
    window.addEventListener('paste', handlePaste, true);

    return () => {
      isDisposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      window.removeEventListener('paste', handlePaste, true);
      resizeObserver.disconnect();
      dataDisp.dispose();
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [entity.id, entity.uuid, restartNonce, uploadAndInjectImages]);

  // Whenever this pane becomes visible again after minimize/reopen: refit + scrollToBottom + full redraw + focus!
  useEffect(() => {
    if (!isActiveVisible) return;
    const raf = requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        const term = termRef.current;
        const ws = wsRef.current;
        if (term) {
          term.refresh(0, Math.max(0, term.rows - 1));
          term.scrollToBottom();
          if (ws && ws.readyState === WebSocket.OPEN && term.cols > 10 && term.rows > 4) {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
          }
          term.focus();
        }
      } catch {
        // ignore
      }
    });
    const focusTimer = window.setTimeout(() => {
      const term = termRef.current;
      if (term) {
        term.scrollToBottom();
        term.focus();
      }
    }, 60);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(focusTimer);
    };
  }, [isActiveVisible]);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 transition-opacity duration-75 ${
        isActiveVisible
          ? 'opacity-100 pointer-events-auto z-50'
          : 'opacity-0 pointer-events-none -z-10'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDraggingOver) setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer?.files) {
          uploadAndInjectImages(e.dataTransfer.files);
        }
      }}
    >
      <div className="wezterm-terminal relative w-full max-w-6xl h-[90vh] bg-[#000000] border border-[#262626] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Drag & Drop Image Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-40 bg-[#000000]/90 border-2 border-dashed border-[#ff00ff] rounded-lg flex flex-col items-center justify-center space-y-2 pointer-events-none">
            <ImageIcon className="w-8 h-8 text-[#ff00ff]" />
            <div className="text-[14px] font-bold text-[#ffff00]">Drop image to attach to Pi</div>
            <div className="text-[12px] text-[#a3a3a3]">Saved to /tmp/pi-clipboard-*.png automatically</div>
          </div>
        )}

        {/* Minimal Native Pi Title Bar */}
        <div className="px-3.5 py-2 bg-[#0a0a0a] border-b border-[#262626] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2.5 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                connStatus === 'connected'
                  ? 'bg-[#a3e635]'
                  : connStatus === 'connecting'
                  ? 'bg-[#ffff00] animate-pulse'
                  : 'bg-[#ef4444]'
              }`}
            />
            <span className="text-[13px] font-bold text-[#ffffff] truncate">
              π • {entity.name}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#18181b] border border-[#262626] text-[#00ffff] shrink-0">
              NATIVE PI PTY
            </span>
            <span className="text-[11px] text-[#737373] truncate hidden sm:inline">
              {cwdDisplay}
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadAndInjectImages(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#18181b] hover:bg-[#262626] border border-[#262626] text-[11px] text-[#d4d4d4] transition-colors"
              title="Attach Image (or paste Ctrl+V / Drag & Drop)"
            >
              <ImageIcon className="w-3 h-3 text-[#00ffff]" />
              <span>Image</span>
            </button>
            <button
              type="button"
              onClick={() => setRestartNonce((n) => n + 1)}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#18181b] hover:bg-[#262626] border border-[#262626] text-[11px] text-[#ffff00] transition-colors"
              title="Restart Pi CLI process in this node"
            >
              <RotateCw className="w-3 h-3 text-[#ffff00]" />
              <span>Restart Pi</span>
            </button>
            <button
              type="button"
              onClick={onMinimize}
              className="p-1 rounded hover:bg-[#18181b] text-[#737373] hover:text-[#ffffff] transition-colors"
              title="Minimize terminal (stays live in memory with 0ms reopen)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Outer padded wrapper so inner xterm.js container has 0 padding -> exact FitAddon row height (zero bottom clipping!) */}
        <div
          className="flex-1 min-h-0 w-full bg-[#000000] px-2.5 pt-2 pb-3 overflow-hidden"
          onClick={() => termRef.current?.focus()}
        >
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

export const PeekTerminalModal: React.FC = () => {
  const {
    entities,
    selectedEntityId,
    isTerminalModalOpen,
    setIsTerminalModalOpen,
  } = useAxonStore();

  // Keep opened terminal panes mounted in memory (up to 6) so minimize/reopen is 0ms & 100% glitch-free
  const [mountedPanes, setMountedPanes] = useState<GraphEntity[]>([]);

  const activeEntity = entities.find((e) => e.id === selectedEntityId);

  useEffect(() => {
    if (!isTerminalModalOpen || !activeEntity) return;
    setMountedPanes((prev) => {
      const exists = prev.some((p) => p.id === activeEntity.id);
      if (exists) {
        return prev.map((p) => (p.id === activeEntity.id ? activeEntity : p));
      }
      const next = [...prev, activeEntity];
      return next.length > 6 ? next.slice(next.length - 6) : next;
    });
  }, [isTerminalModalOpen, activeEntity]);

  const handleMinimize = useCallback(() => {
    setIsTerminalModalOpen(false);
  }, [setIsTerminalModalOpen]);

  if (mountedPanes.length === 0) return null;

  return (
    <>
      {mountedPanes.map((paneEntity) => (
        <NativePiPtyPane
          key={paneEntity.id}
          entity={paneEntity}
          isActiveVisible={Boolean(isTerminalModalOpen && selectedEntityId === paneEntity.id)}
          onMinimize={handleMinimize}
        />
      ))}
    </>
  );
};
