import { create } from 'zustand';
import type { GraphEntity, GraphRelationship, NodeStatus, AgentSkill } from '../types/axon';

export interface EntityTypeConfig {
  type: GraphEntity['type'];
  label: string;
  color: string;
}

export const ENTITY_TYPE_CONFIGS: EntityTypeConfig[] = [
  { type: 'hub', label: 'Core Hub / Brain', color: '#2563eb' },
  { type: 'dev', label: 'Developer (feat/*)', color: '#ea580c' },
  { type: 'qa', label: 'QA & Auditor', color: '#9333ea' },
  { type: 'designer', label: 'Asset Designer', color: '#16a34a' },
  { type: 'system', label: 'System / Utility', color: '#e11d48' },
];

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
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  selectedEntityId: string;
  selectedSessionIds: string[];
  activeViewTab: 'graph' | 'split' | 'workbench';
  isTerminalModalOpen: boolean;

  // Actions
  setSelectedEntityId: (id: string) => void;
  toggleSessionSelect: (id: string) => void;
  selectAllSessions: (select: boolean) => void;
  setActiveViewTab: (tab: 'graph' | 'split' | 'workbench') => void;
  setIsTerminalModalOpen: (open: boolean) => void;
  addEntity: (name: string, type: GraphEntity['type'], worktree: string) => void;
  removeEntity: (id: string) => void;
  updateEntityStatus: (id: string, status: NodeStatus, message?: string) => void;
  applySkillsToSelected: (skillIds: string[]) => void;
  compactEntityMemory: (id: string) => void;
  compactSelectedEntities: () => void;
  compactAllEntities: () => void;
  dispatchTaskToEntity: (id: string, prompt: string) => void;
}

export const useAxonStore = create<AxonState>((set, get) => ({
  projectName: 'ChineseLearning',
  selectedEntityId: 'hub-main',
  selectedSessionIds: ['node-dev-1', 'node-dev-2'],
  activeViewTab: 'graph',
  isTerminalModalOpen: false,

  // Real Pi Sessions matching user workstation
  entities: [
    {
      id: 'hub-main',
      uuid: '9d8a42bd-be72-4036-82ac-daccb1d64d3c',
      name: 'ChineseLearning Hub',
      type: 'hub',
      worktree: 'main',
      status: 'IDLE',
      statusMessage: 'Event router listening on zero-idle bus',
      tokenUsed: 35000,
      tokenMax: 1000000,
      skills: ['git-release', 'rust-tauri'],
      createdAt: '2026-11-23 20:45:10',
      summary: 'Central repository orchestrator. Manages git worktree allocation and delegates build pipelines across specialized agent nodes.',
    },
    {
      id: 'node-dev-1',
      uuid: '4f28aa1b-9e41-4172-8801-7fa8bc31889a',
      name: 'Dev 1 (Belajar Stage)',
      type: 'dev',
      worktree: 'feat/belajar-page',
      status: 'IDLE',
      statusMessage: 'Ready for lesson contract updates',
      tokenUsed: 132000,
      tokenMax: 1000000,
      skills: ['android-compose', 'antislop-ui'],
      createdAt: '2026-11-23 20:46:12',
      summary: 'Responsible for Stage 1-16 Hanzi lesson workflows, MVI ViewModels, and strictly verified pinyin-hanzi contract compliance.',
    },
    {
      id: 'node-dev-2',
      uuid: '8c91024e-128a-4f51-b019-33aa91b17cc1',
      name: 'Dev 2 (Stories HSK 3)',
      type: 'dev',
      worktree: 'feat/cerita-page',
      status: 'WORKING',
      statusMessage: 'Ingesting HSK 3 story corpus via direct REST',
      tokenUsed: 195000,
      tokenMax: 1000000,
      skills: ['android-compose'],
      createdAt: '2026-11-23 20:47:04',
      summary: 'Specialized in reading comprehension feeds, word-level audio synchronization, and story list pagination architecture.',
    },
    {
      id: 'node-designer',
      uuid: 'e5518b9c-7201-49b8-9311-190ab751b32f',
      name: 'UI Asset Designer',
      type: 'designer',
      worktree: 'feat/assets',
      status: 'IDLE',
      statusMessage: 'Vector drawables validated without raster loss',
      tokenUsed: 89000,
      tokenMax: 1000000,
      skills: ['vector-designer', 'antislop-ui'],
      createdAt: '2026-11-23 20:50:00',
      summary: 'Produces pure Android VectorDrawable XML files and SVG assets with strict zero-emoji enforcement.',
    },
    {
      id: 'node-qa',
      uuid: 'b71239aa-5529-410a-8120-cf918a22114d',
      name: 'QA & Test Automation',
      type: 'qa',
      worktree: 'main',
      status: 'IDLE',
      statusMessage: 'Working tree synchronized, 0 merge conflicts',
      tokenUsed: 148000,
      tokenMax: 1000000,
      skills: ['android-compose', 'git-release'],
      createdAt: '2026-11-23 20:48:30',
      summary: 'Automated test suite and contract verification engineer. Audits commits before merging to main branch.',
    },
    {
      id: 'node-epub',
      uuid: '7a18b29c-3321-4d10-8812-cc9182ab4401',
      name: 'Epub Translator',
      type: 'system',
      worktree: 'translate-dfm',
      status: 'IDLE',
      statusMessage: 'Chapter translation complete (1.1 MB output)',
      tokenUsed: 42000,
      tokenMax: 1000000,
      skills: ['antislop-ui'],
      createdAt: '2026-11-23 21:10:00',
      summary: 'Epub translation engine with resumable chapter caching and Indonesian terminology localization.',
    },
    {
      id: 'node-axon',
      uuid: 'fa9910aa-4482-4c99-b129-ef0199aa3312',
      name: 'Axon Meta-Dev',
      type: 'system',
      worktree: 'axon/main',
      status: 'IDLE',
      statusMessage: 'Self-hosting IDE engineer ready',
      tokenUsed: 28000,
      tokenMax: 1000000,
      skills: ['rust-tauri'],
      createdAt: '2026-11-23 21:15:00',
      summary: 'Axon Studio self-bootstrapping agent. Modifies desktop app source code and verifies builds.',
    },
  ],

  relationships: [
    { id: 'rel-hub-dev1', source: 'hub-main', target: 'node-dev-1', label: '' },
    { id: 'rel-hub-dev2', source: 'hub-main', target: 'node-dev-2', label: '' },
    { id: 'rel-hub-designer', source: 'hub-main', target: 'node-designer', label: '' },
    { id: 'rel-hub-qa', source: 'hub-main', target: 'node-qa', label: '' },
    { id: 'rel-hub-epub', source: 'hub-main', target: 'node-epub', label: '' },
    { id: 'rel-hub-axon', source: 'hub-main', target: 'node-axon', label: '' },
    { id: 'rel-dev1-qa', source: 'node-dev-1', target: 'node-qa', label: '' },
    { id: 'rel-dev2-qa', source: 'node-dev-2', target: 'node-qa', label: '' },
    { id: 'rel-dev1-designer', source: 'node-dev-1', target: 'node-designer', label: '' },
  ],

  setSelectedEntityId: (id) => set({ selectedEntityId: id }),

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
      selectedSessionIds: select ? state.entities.map((e) => e.id) : [],
    }));
  },

  setActiveViewTab: (tab) => set({ activeViewTab: tab }),
  setIsTerminalModalOpen: (open) => set({ isTerminalModalOpen: open }),

  addEntity: (name, type, worktree) => {
    const newEntity: GraphEntity = {
      id: `entity-${Date.now()}`,
      uuid: crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}`,
      name: name.trim() || `Node ${get().entities.length + 1}`,
      type,
      worktree: worktree.trim() || 'main',
      status: 'IDLE',
      statusMessage: 'Entity node online (Zero-Idle)',
      tokenUsed: 15000,
      tokenMax: 1000000,
      skills: ['antislop-ui'],
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      summary: 'Dynamic session branch created in relationship network.',
    };

    const newRel: GraphRelationship = {
      id: `rel-hub-${newEntity.id}`,
      source: 'hub-main',
      target: newEntity.id,
      label: '',
    };

    set((state) => ({
      entities: [...state.entities, newEntity],
      relationships: [...state.relationships, newRel],
      selectedEntityId: newEntity.id,
    }));
  },

  removeEntity: (id) => {
    if (id === 'hub-main') return;
    set((state) => ({
      entities: state.entities.filter((e) => e.id !== id),
      relationships: state.relationships.filter((r) => r.source !== id && r.target !== id),
      selectedSessionIds: state.selectedSessionIds.filter((sid) => sid !== id),
      selectedEntityId: state.selectedEntityId === id ? 'hub-main' : state.selectedEntityId,
    }));
  },

  updateEntityStatus: (id, status, message) => {
    set((state) => ({
      entities: state.entities.map((e) =>
        e.id === id ? { ...e, status, statusMessage: message ?? e.statusMessage } : e
      ),
    }));
  },

  applySkillsToSelected: (skillIds) => {
    set((state) => ({
      entities: state.entities.map((e) => {
        if (!state.selectedSessionIds.includes(e.id)) return e;
        const merged = Array.from(new Set([...e.skills, ...skillIds]));
        return { ...e, skills: merged };
      }),
    }));
  },

  compactEntityMemory: (id) => {
    set((state) => ({
      entities: state.entities.map((e) =>
        e.id === id ? { ...e, status: 'COMPACTING', statusMessage: 'Compacting memory...' } : e
      ),
    }));

    setTimeout(() => {
      set((state) => ({
        entities: state.entities.map((e) =>
          e.id === id
            ? { ...e, status: 'IDLE', tokenUsed: Math.floor(e.tokenUsed * 0.25), statusMessage: 'Compacted cleanly' }
            : e
        ),
      }));
    }, 1000);
  },

  compactSelectedEntities: () => {
    const selectedIds = get().selectedSessionIds;
    if (selectedIds.length === 0) return;

    set((state) => ({
      entities: state.entities.map((e) =>
        selectedIds.includes(e.id)
          ? { ...e, status: 'COMPACTING', statusMessage: 'Compacting selected memory...' }
          : e
      ),
    }));

    setTimeout(() => {
      set((state) => ({
        entities: state.entities.map((e) =>
          selectedIds.includes(e.id)
            ? { ...e, status: 'IDLE', tokenUsed: Math.floor(e.tokenUsed * 0.25), statusMessage: 'Compacted cleanly' }
            : e
        ),
      }));
    }, 1000);
  },

  compactAllEntities: () => {
    set((state) => ({
      entities: state.entities.map((e) => ({
        ...e,
        status: 'COMPACTING',
        statusMessage: 'Compacting session transcript...',
      })),
    }));

    setTimeout(() => {
      set((state) => ({
        entities: state.entities.map((e) => ({
          ...e,
          status: 'IDLE',
          tokenUsed: Math.floor(e.tokenUsed * 0.25),
          statusMessage: 'Memory compacted cleanly',
        })),
      }));
    }, 1000);
  },

  dispatchTaskToEntity: (id, prompt) => {
    set((state) => ({
      entities: state.entities.map((e) =>
        e.id === id
          ? { ...e, status: 'WORKING', statusMessage: `Executing: "${prompt.slice(0, 36)}..."` }
          : e
      ),
    }));

    setTimeout(() => {
      set((state) => ({
        entities: state.entities.map((e) =>
          e.id === id
            ? { ...e, status: 'IDLE', tokenUsed: e.tokenUsed + 1200, statusMessage: 'Task finished cleanly' }
            : e
        ),
      }));
    }, 2800);
  },
}));
