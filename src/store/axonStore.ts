import { create } from 'zustand';
import type { GraphEntity, GraphRelationship, NodeStatus } from '../types/axon';

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
  { type: 'skill', label: 'Skill & Engine', color: '#e11d48' },
];

interface AxonState {
  projectName: string;
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  selectedEntityId: string;
  showEdgeLabels: boolean;
  activeViewTab: 'graph' | 'split' | 'workbench';
  isTerminalModalOpen: boolean;

  // Actions
  setSelectedEntityId: (id: string) => void;
  setShowEdgeLabels: (show: boolean) => void;
  setActiveViewTab: (tab: 'graph' | 'split' | 'workbench') => void;
  setIsTerminalModalOpen: (open: boolean) => void;
  addEntity: (name: string, type: GraphEntity['type'], worktree: string) => void;
  removeEntity: (id: string) => void;
  updateEntityStatus: (id: string, status: NodeStatus, message?: string) => void;
  compactEntityMemory: (id: string) => void;
  compactAllEntities: () => void;
  dispatchTaskToEntity: (id: string, prompt: string) => void;
}

export const useAxonStore = create<AxonState>((set, get) => ({
  projectName: 'ChineseLearning',
  selectedEntityId: 'hub-main',
  showEdgeLabels: true,
  activeViewTab: 'graph',
  isTerminalModalOpen: false,

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
      id: 'skill-android-compose',
      uuid: '11aa22bb-33cc-44dd-55ee-66ff77889900',
      name: 'android-compose',
      type: 'skill',
      worktree: 'system',
      status: 'IDLE',
      statusMessage: 'Skill library mounted',
      tokenUsed: 12000,
      tokenMax: 1000000,
      skills: [],
      createdAt: '2026-11-23 20:40:00',
      summary: 'NowInAndroid production standards for Jetpack Compose, StateFlow, Coroutines, and responsive UI layouts.',
    },
    {
      id: 'skill-antislop-ui',
      uuid: '22bb33cc-44dd-55ee-66ff-7788990011aa',
      name: 'antislop-ui',
      type: 'skill',
      worktree: 'system',
      status: 'IDLE',
      statusMessage: 'Skill library mounted',
      tokenUsed: 14000,
      tokenMax: 1000000,
      skills: [],
      createdAt: '2026-11-23 20:40:00',
      summary: 'Eliminates generic AI slop, default gradients, and artificial aesthetics in favor of human craftsmanship.',
    },
    {
      id: 'skill-vector-designer',
      uuid: '33cc44dd-55ee-66ff-7788-990011aa22bb',
      name: 'vector-designer',
      type: 'skill',
      worktree: 'system',
      status: 'IDLE',
      statusMessage: 'Skill library mounted',
      tokenUsed: 11000,
      tokenMax: 1000000,
      skills: [],
      createdAt: '2026-11-23 20:40:00',
      summary: 'Generates pure vector XML paths matching AOSP density buckets without pixelation or emoji fallbacks.',
    },
    {
      id: 'skill-git-release',
      uuid: '44dd55ee-66ff-7788-9900-11aa22bb33cc',
      name: 'git-release',
      type: 'skill',
      worktree: 'system',
      status: 'IDLE',
      statusMessage: 'Skill library mounted',
      tokenUsed: 9500,
      tokenMax: 1000000,
      skills: [],
      createdAt: '2026-11-23 20:40:00',
      summary: 'Enforces Conventional Commits 1.0.0 and cleanly orchestrated git worktree lifecycle protocols.',
    },
  ],

  relationships: [
    { id: 'rel-hub-dev1', source: 'hub-main', target: 'node-dev-1', label: 'DELEGATES_TASK' },
    { id: 'rel-hub-dev2', source: 'hub-main', target: 'node-dev-2', label: 'DELEGATES_TASK' },
    { id: 'rel-hub-qa', source: 'hub-main', target: 'node-qa', label: 'AUDITS_PIPELINE' },
    { id: 'rel-hub-designer', source: 'hub-main', target: 'node-designer', label: 'DELEGATES_ASSETS' },
    { id: 'rel-dev1-qa', source: 'node-dev-1', target: 'node-qa', label: 'HANDOFF_AUDIT' },
    { id: 'rel-dev2-qa', source: 'node-dev-2', target: 'node-qa', label: 'HANDOFF_AUDIT' },
    { id: 'rel-dev1-designer', source: 'node-dev-1', target: 'node-designer', label: 'REQUESTS_ICON' },
    { id: 'rel-dev1-skill1', source: 'node-dev-1', target: 'skill-android-compose', label: 'USES_SKILL' },
    { id: 'rel-dev1-skill2', source: 'node-dev-1', target: 'skill-antislop-ui', label: 'USES_SKILL' },
    { id: 'rel-dev2-skill1', source: 'node-dev-2', target: 'skill-android-compose', label: 'USES_SKILL' },
    { id: 'rel-designer-skill1', source: 'node-designer', target: 'skill-vector-designer', label: 'USES_SKILL' },
    { id: 'rel-designer-skill2', source: 'node-designer', target: 'skill-antislop-ui', label: 'USES_SKILL' },
    { id: 'rel-qa-skill1', source: 'node-qa', target: 'skill-git-release', label: 'USES_SKILL' },
  ],

  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  setShowEdgeLabels: (show) => set({ showEdgeLabels: show }),
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
      summary: 'Dynamic entity branch created in graph relationship network.',
    };

    const newRel: GraphRelationship = {
      id: `rel-hub-${newEntity.id}`,
      source: 'hub-main',
      target: newEntity.id,
      label: 'CONNECTED_BRANCH',
    };

    set((state) => ({
      entities: [...state.entities, newEntity],
      relationships: [...state.relationships, newRel],
      selectedEntityId: newEntity.id,
    }));
  },

  removeEntity: (id) => {
    if (id === 'hub-main') return; // Core hub protected
    set((state) => ({
      entities: state.entities.filter((e) => e.id !== id),
      relationships: state.relationships.filter((r) => r.source !== id && r.target !== id),
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
