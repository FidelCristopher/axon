import React, { useState } from 'react';
import { useAxonStore } from '../store/axonStore';
import { Brain, X, Radio, Send } from 'lucide-react';

export const GlobalDirectiveModal: React.FC = () => {
  const { 
    isGlobalDirectiveOpen, 
    setGlobalDirectiveOpen, 
    dispatchGlobalDirective, 
    sessions 
  } = useAxonStore();

  const [directiveText, setDirectiveText] = useState('');

  if (!isGlobalDirectiveOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directiveText.trim()) return;
    dispatchGlobalDirective(directiveText.trim());
    setDirectiveText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="w-[560px] max-w-[90vw] bg-[#0b0f19] border border-[#1e293b] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-[#090d16] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-full bg-[#3b82f6]/20 border border-[#3b82f6] text-[#3b82f6]">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-[#f8fafc] uppercase tracking-wider">
                Broadcast Global Directive
              </h2>
              <p className="text-[10px] text-[#94a3b8]">
                Fan-out instruction simultaneously across all {sessions.length} active branches
              </p>
            </div>
          </div>
          <button
            onClick={() => setGlobalDirectiveOpen(false)}
            className="p-1 rounded hover:bg-[#1e293b] text-[#64748b] hover:text-[#f8fafc]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-[#0f172a]">
          <div className="text-[11px] font-mono text-[#06b6d4] flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Target: All Network Nodes (Zero-Idle Trigger)</span>
          </div>

          <textarea
            rows={3}
            placeholder="Type directive (e.g., 'Save current progress, run build test, and synchronize with main branch')..."
            value={directiveText}
            onChange={(e) => setDirectiveText(e.target.value)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded text-xs p-3 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#06b6d4] font-mono resize-none"
            autoFocus
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-[#64748b] font-mono">
              Tokens only consumed during active execution
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setGlobalDirectiveOpen(false)}
                className="px-3 py-1.5 rounded text-xs text-[#94a3b8] hover:text-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!directiveText.trim()}
                className="px-4 py-1.5 rounded bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] hover:from-[#0891b2] hover:to-[#2563eb] text-xs font-semibold text-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
              >
                <Send className="w-3 h-3" />
                <span>Broadcast to Network</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
