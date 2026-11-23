import { create } from 'zustand';
import type { AgentSession, AgentSkill, NodeStatus } from '../types/axon';

export const AVAILABLE_SKILLS: AgentSkill[] = [
  { id: 'android-compose', name: 'android-compose', description: 'Production Jetpack Compose standards & MVI state patterns', category: 'mobile' },
  { id: 'antislop-ui', name: 'antislop-ui', description: 'Anti-slop human-crafted design system & accessible aesthetics', category: 'ui' },
  { id: 'vector-designer', name: 'vector-designer', description: 'AOSP VectorDrawable XML pipeline without raster degradation', category: 'ui' },
  { id: 'git-release', name: 'git-release', description: 'Conventional Commits 1.0.0 & worktree branch hygiene', category: 'git' },
  { id: 'rust-tauri', name: 'rust-tauri', description: 'Tauri v2 native desktop shell & PTY process integration', category: 'system' },
  { id: 'nextjs-web', name: 'nextjs-web', description: 'Next.js 15 App Router & Server Components architecture', category: 'web' },
];

interface AxonState {
  projectName: string;
  sessions: AgentSession[];
  selectedSessionIds: string[];
  inspectedSessionId: string | null;
  isGlobalDirectiveOpen: boolean;

  // Actions
  addSession: (name: string, role: AgentSession['role'], worktree: string) => void;
  removeSession: (id: string) => void;
  updateSessionStatus: (id: string, status: NodeStatus, message?: string) => void;
  toggleSessionSelect: (id: string) => void;
  selectAllSessions: (select: boolean) => void;
  setInspectedSession: (id: string | null) => void;
  applySkillsToSelected: (skillIds: string[]) => void;
  compactAllSessions: () => void;
  compactSelectedSessions: () => void;
  setGlobalDirectiveOpen: (open: boolean) => void;
  dispatchGlobalDirective: (message: string) => void;
}

export const useAxonStore = create<AxonState>((set, get) => ({
  projectName: 'ChineseLearning',
  sessions: [
    {
      id: 'node-dev-1',
      name: 'Dev 1 (Belajar)',
      role: 'dev',
      worktree: 'feat/belajar-page',
      status: 'IDLE',
      statusMessage: 'Ready for tasks',
      tokenUsed: 130000,
      tokenMax: 1000000,
      skills: ['android-compose', 'antislop-ui'],
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: 'node-dev-2',
      name: 'Dev 2 (Stories)',
      role: 'dev',
      worktree: 'feat/cerita-page',
      status: 'WORKING',
      statusMessage: 'Processing HSK 3 stories data',
      tokenUsed: 180000,
      tokenMax: 1000000,
      skills: ['android-compose'],
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: 'node-designer',
      name: 'Designer',
      role: 'designer',
      worktree: 'feat/assets',
      status: 'IDLE',
      statusMessage: 'Assets vector sync complete',
      tokenUsed: 98000,
      tokenMax: 1000000,
      skills: ['vector-designer', 'antislop-ui'],
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: 'node-qa',
      name: 'QA & Auditor',
      role: 'qa',
      worktree: 'main',
      status: 'IDLE',
      statusMessage: 'Audit clean, 0 merge conflicts',
      tokenUsed: 150000,
      tokenMax: 1000000,
      skills: ['android-compose', 'git-release'],
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    },
  ],
  selectedSessionIds: ['node-dev-1', 'node-dev-2'],
  inspectedSessionId: null,
  isGlobalDirectiveOpen: false,

  addSession: (name, role, worktree) => {
    const newSession: AgentSession = {
      id: `node-${Date.now()}`,
      name: name.trim() || `Agent ${get().sessions.length + 1}`,
      role,
      worktree: worktree.trim() || 'main',
      status: 'IDLE',
      statusMessage: 'Branch initialized',
      tokenUsed: 2500,
      tokenMax: 1000000,
      skills: ['antislop-ui'],
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    set((state) => ({ sessions: [...state.sessions, newSession] }));
  },

  removeSession: (id) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      selectedSessionIds: state.selectedSessionIds.filter((sid) => sid !== id),
      inspectedSessionId: state.inspectedSessionId === id ? null : state.inspectedSessionId,
    }));
  },

  updateSessionStatus: (id, status, message) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, status, statusMessage: message ?? s.statusMessage, lastActiveAt: new Date().toISOString() } : s
      ),
    }));
  },

  toggleSessionSelect: (id) => {
    set((state) => {
      const exists = state.selectedSessionIds.includes(id);
      return {
        selectedSessionIds: exists
          ? state.selectedSessionIds.filter((sid) => sid !== id)
          : [...state.selectedSessionIds, id],
      };
    });
  },

  selectAllSessions: (select) => {
    set((state) => ({
      selectedSessionIds: select ? state.sessions.map((s) => s.id) : [],
    }));
  },

  setInspectedSession: (id) => {
    set({ inspectedSessionId: id });
  },

  applySkillsToSelected: (skillIds) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (!state.selectedSessionIds.includes(s.id)) return s;
        // Merge without duplicates
        const merged = Array.from(new Set([...s.skills, ...skillIds]));
        return { ...s, skills: merged };
      }),
    }));
  },

  compactAllSessions: () => {
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        status: 'COMPACTING',
        statusMessage: 'Compacting memory transcript...',
      })),
    }));

    // Simulate completion after 1.2s
    setTimeout(() => {
      set((state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          status: 'IDLE',
          tokenUsed: Math.max(15000, Math.floor(s.tokenUsed * 0.25)), // Token footprint reduced by ~75%
          statusMessage: 'Memory compacted successfully',
        })),
      }));
    }, 1200);
  },

  compactSelectedSessions: () => {
    const selectedIds = get().selectedSessionIds;
    if (selectedIds.length === 0) return;

    set((state) => ({
      sessions: state.sessions.map((s) =>
        selectedIds.includes(s.id)
          ? { ...s, status: 'COMPACTING', statusMessage: 'Compacting selected memory...' }
          : s
      ),
    }));

    setTimeout(() => {
      set((state) => ({
        sessions: state.sessions.map((s) =>
          selectedIds.includes(s.id)
            ? {
                ...s,
                status: 'IDLE',
                tokenUsed: Math.max(15000, Math.floor(s.tokenUsed * 0.25)),
                statusMessage: 'Memory compacted successfully',
              }
            : s
        ),
      }));
    }, 1200);
  },

  setGlobalDirectiveOpen: (open) => {
    set({ isGlobalDirectiveOpen: open });
  },

  dispatchGlobalDirective: (message) => {
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        status: 'WORKING',
        statusMessage: `Executing directive: "${message.slice(0, 36)}..."`,
      })),
      isGlobalDirectiveOpen: false,
    }));

    // Auto-settle to IDLE after demo execution
    setTimeout(() => {
      set((state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          status: 'IDLE',
          statusMessage: 'Directive completed cleanly',
        })),
      }));
    }, 3500);
  },
}));
