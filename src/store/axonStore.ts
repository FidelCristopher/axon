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
  { type: 'system', label: 'System / Utility', color: '#64748b' },
];

export const AVAILABLE_SKILLS: AgentSkill[] = [
  { id: 'android-compose', name: 'android-compose', description: 'Production Jetpack Compose standards & MVI state patterns', category: 'mobile' },
  { id: 'antislop-ui', name: 'antislop-ui', description: 'Anti-slop human-crafted design system & accessible aesthetics', category: 'ui' },
  { id: 'vector-designer', name: 'vector-designer', description: 'AOSP VectorDrawable XML pipeline without raster degradation', category: 'ui' },
  { id: 'git-release', name: 'git-release', description: 'Conventional Commits 1.0.0 & worktree branch hygiene', category: 'git' },
  { id: 'rust-tauri', name: 'rust-tauri', description: 'Tauri v2 native desktop shell & PTY process integration', category: 'system' },
  { id: 'nextjs-web', name: 'nextjs-web', description: 'Next.js 15 App Router & Server Components architecture', category: 'web' },
  { id: 'ai-engineer', name: 'ai-engineer', description: 'LLM orchestration, structured outputs & agent patterns', category: 'system' },
  { id: 'blender-bridge', name: 'blender-bridge', description: 'Blender 3D desktop bridge & PBR procedural assets', category: 'ui' },
  { id: 'clone-website', name: 'clone-website', description: 'Reverse-engineer and clone websites pixel-perfect', category: 'web' },
];

export interface ProjectWorkspace {
  id: string;
  name: string;
  path: string;
  entities: GraphEntity[];
  relationships: GraphRelationship[];
}

// REAL PI SESSIONS DATA ARCHITECTURE:
// Each project has its OWN isolated graph network!
// Unrelated projects are NOT connected to ChineseLearning Hub.
export const PROJECT_WORKSPACES: ProjectWorkspace[] = [
  {
    id: 'proj-chineselearning',
    name: 'ChineseLearning',
    path: '/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning',
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
        skills: ['git-release', 'android-compose'],
        createdAt: '2026-11-23 20:45:10',
        summary: 'Central repository orchestrator for HaloHanzi. Coordinates git worktrees and manages unified build verification.',
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
        summary: 'Responsible for Stage 1-16 Hanzi lesson workflows in halohanzi-part1 worktree.',
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
        summary: 'Specialized in reading comprehension feeds and audio sync in halohanzi-part2 worktree.',
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
        summary: 'Produces pure Android VectorDrawable XML files in halohanzi-assets worktree.',
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
        summary: 'Automated test suite and contract verification engineer. Audits commits before merging to main.',
      },
    ],
    relationships: [
      { id: 'rel-hub-dev1', source: 'hub-main', target: 'node-dev-1', label: '' },
      { id: 'rel-hub-dev2', source: 'hub-main', target: 'node-dev-2', label: '' },
      { id: 'rel-hub-designer', source: 'hub-main', target: 'node-designer', label: '' },
      { id: 'rel-hub-qa', source: 'hub-main', target: 'node-qa', label: '' },
      { id: 'rel-dev1-qa', source: 'node-dev-1', target: 'node-qa', label: '' },
      { id: 'rel-dev2-qa', source: 'node-dev-2', target: 'node-qa', label: '' },
      { id: 'rel-dev1-designer', source: 'node-dev-1', target: 'node-designer', label: '' },
    ],
  },
  {
    id: 'proj-epub-translator',
    name: 'Epub Translator',
    path: '/home/fidel/translate_dfm.py',
    entities: [
      {
        id: 'epub-engine',
        uuid: '7a18b29c-3321-4d10-8812-cc9182ab4401',
        name: 'Epub Translation Engine',
        type: 'system',
        worktree: 'translate-dfm',
        status: 'IDLE',
        statusMessage: 'Chapter translation complete (1.1 MB output)',
        tokenUsed: 42000,
        tokenMax: 1000000,
        skills: ['antislop-ui'],
        createdAt: '2026-11-23 21:10:00',
        summary: 'Standalone Pi session for translating English epubs into Indonesian with chapter caching.',
      },
    ],
    relationships: [],
  },
  {
    id: 'proj-axon',
    name: 'Axon Studio',
    path: '/mnt/c/Users/Pongo/axon',
    entities: [
      {
        id: 'axon-meta-dev',
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
        summary: 'Axon Studio self-bootstrapping agent modifying desktop app source code and verifying builds.',
      },
    ],
    relationships: [],
  },
];

interface AxonState {
  activeProjectId: string;
  projectName: string;
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  selectedEntityId: string;
  selectedSessionIds: string[];
  activeViewTab: 'graph' | 'split' | 'workbench';
  isTerminalModalOpen: boolean;
  sessionTopologies: Record<string, { entities: GraphEntity[]; relationships: GraphRelationship[] }>;

  // Actions
  switchProject: (projectId: string) => void;
  selectSessionTopology: (session: { id: string; name: string; category?: string; cwd?: string; skills?: string[] | null; role?: string; tokens?: number; size?: number }) => void;
  setSelectedEntityId: (id: string) => void;
  toggleSessionSelect: (id: string) => void;
  selectAllSessions: (select: boolean) => void;
  setActiveViewTab: (tab: 'graph' | 'split' | 'workbench') => void;
  setIsTerminalModalOpen: (open: boolean) => void;
  addEntity: (name: string, type: GraphEntity['type'], worktree: string, worktreePath?: string) => void;
  removeEntity: (id: string) => void;
  updateEntityStatus: (id: string, status: NodeStatus, message?: string) => void;
  applySkillsToSelected: (skillIds: string[]) => void;
  addSkillToEntity: (entityId: string, skillName: string) => void;
  removeSkillFromEntity: (entityId: string, skillName: string) => void;
  compactEntityMemory: (id: string) => void;
  compactSelectedEntities: () => void;
  compactAllEntities: () => void;
  syncRealWorktrees: (repoPath: string) => Promise<void>;
  dispatchTaskToEntity: (id: string, prompt: string) => void;
}

export const useAxonStore = create<AxonState>((set, get) => {
  const defaultProj = PROJECT_WORKSPACES[0];

  const initialTopologies: Record<string, { entities: GraphEntity[]; relationships: GraphRelationship[] }> = {
    [defaultProj.id]: {
      entities: defaultProj.entities,
      relationships: defaultProj.relationships,
    },
    [PROJECT_WORKSPACES[1].id]: {
      entities: PROJECT_WORKSPACES[1].entities,
      relationships: PROJECT_WORKSPACES[1].relationships,
    },
    [PROJECT_WORKSPACES[2].id]: {
      entities: PROJECT_WORKSPACES[2].entities,
      relationships: PROJECT_WORKSPACES[2].relationships,
    },
  };

  return {
    activeProjectId: '',
    projectName: '',
    entities: [],
    relationships: [],
    selectedEntityId: '',
    selectedSessionIds: [],
    activeViewTab: 'graph',
    isTerminalModalOpen: false,
    sessionTopologies: initialTopologies,

    selectSessionTopology: (session) => {
      const currentId = get().activeProjectId;
      const currentEntities = get().entities;
      const currentRelationships = get().relationships;

      const topologies = { ...get().sessionTopologies };
      if (currentId) {
        topologies[currentId] = {
          entities: currentEntities,
          relationships: currentRelationships,
        };
      }

      let targetTopology = topologies[session.id];

      if (!targetTopology) {
        const lowerName = session.name.toLowerCase();
        const isChinese = lowerName.includes('chinese') || lowerName.includes('hanzi') || lowerName.includes('hsk');
        const isMatcha = lowerName.includes('matcha');

        if (isChinese) {
          const chineseProj = PROJECT_WORKSPACES[0];
          targetTopology = {
            entities: chineseProj.entities,
            relationships: chineseProj.relationships,
          };
        } else if (isMatcha) {
          const matchaRoot: GraphEntity = {
            id: `matcha-main-${session.id}`,
            uuid: session.id,
            name: 'Matcha Showcase (Main)',
            type: 'hub',
            worktree: 'main',
            worktreePath: '/mnt/c/Users/Pongo/matcha-showcase',
            status: 'IDLE',
            statusMessage: 'Live menu & customizer orchestrator',
            tokenUsed: session.tokens || 31000,
            tokenMax: 1000000,
            skills: session.skills && session.skills.length > 0 ? session.skills : ['nextjs-web', 'antislop-ui'],
            createdAt: 'Active Pi Session',
            summary: 'Artisan Matcha simulation & beverage ordering app.',
          };
          const matchaDev: GraphEntity = {
            id: `matcha-craft-${session.id}`,
            uuid: `${session.id}-craft`,
            name: 'Custom Beverage Craft',
            type: 'dev',
            worktree: 'pages/customize',
            status: 'IDLE',
            statusMessage: 'Beverage SVG craft & pricing math',
            tokenUsed: 12000,
            tokenMax: 1000000,
            skills: ['antislop-ui'],
            createdAt: 'Active Pi Session',
            summary: 'Interactive tumbler SVG sketch and ingredient layer controller.',
          };
          targetTopology = {
            entities: [matchaRoot, matchaDev],
            relationships: [
              { id: `rel-matcha-${session.id}`, source: matchaRoot.id, target: matchaDev.id, label: '' },
            ],
          };
        } else {
          // Dynamic Single Node representing this exact session
          const singleNode: GraphEntity = {
            id: `node-${session.id}`,
            uuid: session.id,
            name: session.name,
            type: (session.role as any) || 'dev',
            worktree: session.category === 'Global' ? 'main' : session.category || 'main',
            worktreePath: session.cwd || '/mnt/c/Users/Pongo',
            status: 'IDLE',
            statusMessage: 'Session entity ready (Zero-Idle)',
            tokenUsed: session.tokens ?? 0,
            tokenMax: 1000000,
            skills: session.skills && session.skills.length > 0 ? session.skills : ['antislop-ui'],
            createdAt: 'Active Pi Session',
            summary: `Pi session: ${session.name} (${session.category || 'Local'}). Click to inspect terminal.`,
          };
          targetTopology = {
            entities: [singleNode],
            relationships: [],
          };
        }
        topologies[session.id] = targetTopology;
      }

      set({
        sessionTopologies: topologies,
        activeProjectId: session.id,
        projectName: session.name,
        entities: targetTopology.entities,
        relationships: targetTopology.relationships,
        selectedEntityId: targetTopology.entities[0]?.id || '',
        selectedSessionIds: targetTopology.entities.map((e) => e.id),
      });

      // Automatically sync real sibling Git worktrees from disk onto the canvas
      const repoPath =
        session.cwd && session.cwd !== '/home/fidel' && session.cwd !== '/mnt/c/Users/Pongo'
          ? session.cwd
          : session.name.toLowerCase().includes('matcha')
          ? '/mnt/c/Users/Pongo/matcha-showcase'
          : session.name.toLowerCase().includes('chinese') || session.name.toLowerCase().includes('hanzi')
          ? '/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning'
          : session.name.toLowerCase().includes('axon')
          ? '/mnt/c/Users/Pongo/axon'
          : '';
      if (repoPath) {
        get().syncRealWorktrees(repoPath);
      }
    },

    switchProject: (projectId) => {
      const proj = PROJECT_WORKSPACES.find((p) => p.id === projectId) || PROJECT_WORKSPACES[0];
      set({
        activeProjectId: proj.id,
        projectName: proj.name,
        entities: proj.entities,
        relationships: proj.relationships,
        selectedEntityId: proj.entities[0]?.id || '',
        selectedSessionIds: proj.entities.slice(0, 2).map((e) => e.id),
      });
    },

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

    addEntity: (name, type, worktree, worktreePath) => {
      const newEntity: GraphEntity = {
        id: `entity-${Date.now()}`,
        uuid: crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}`,
        name: name.trim() || `Node ${get().entities.length + 1}`,
        type,
        worktree: worktree.trim() || 'main',
        worktreePath: worktreePath || undefined,
        status: 'IDLE',
        statusMessage: 'Entity node online (Zero-Idle)',
        tokenUsed: 15000,
        tokenMax: 1000000,
        skills: ['antislop-ui'],
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        summary: 'Dynamic session branch created in relationship network.',
      };

      const hub = get().entities.find((e) => e.type === 'hub') || get().entities[0];
      const newRel: GraphRelationship = {
        id: `rel-${hub?.id || 'root'}-${newEntity.id}`,
        source: hub?.id || 'root',
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
      const hub = get().entities.find((e) => e.type === 'hub');
      if (hub && hub.id === id) return;
      set((state) => ({
        entities: state.entities.filter((e) => e.id !== id),
        relationships: state.relationships.filter((r) => r.source !== id && r.target !== id),
        selectedSessionIds: state.selectedSessionIds.filter((sid) => sid !== id),
        selectedEntityId: state.selectedEntityId === id ? (hub?.id || state.entities[0]?.id || '') : state.selectedEntityId,
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

    addSkillToEntity: (entityId, skillName) => {
      const cleanSkill = skillName.trim();
      if (!cleanSkill) return;
      set((state) => ({
        entities: state.entities.map((e) => {
          if (e.id !== entityId) return e;
          if (e.skills.includes(cleanSkill)) return e;
          return { ...e, skills: [...e.skills, cleanSkill] };
        }),
      }));
    },

    removeSkillFromEntity: (entityId, skillName) => {
      set((state) => ({
        entities: state.entities.map((e) => {
          if (e.id !== entityId) return e;
          return { ...e, skills: e.skills.filter((s) => s !== skillName) };
        }),
      }));
    },

    syncRealWorktrees: async (repoPath: string) => {
      try {
        const res = await fetch(
          `http://127.0.0.1:1425/api/worktrees?repoPath=${encodeURIComponent(repoPath)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const wts: Array<{ path: string; branch: string; isMain: boolean }> = Array.isArray(data?.worktrees)
          ? data.worktrees
          : [];
        const secondary = wts.filter((w) => !w.isMain);
        if (secondary.length === 0) return;

        set((state) => {
          const hub = state.entities.find((e) => e.type === 'hub') || state.entities[0];
          if (!hub) return state;

          const nextEntities = [...state.entities];
          const nextRels = [...state.relationships];
          const nextSelected = [...state.selectedSessionIds];

          for (const wt of secondary) {
            const exists = nextEntities.some(
              (e) =>
                e.worktree === wt.branch ||
                (e.worktreePath && e.worktreePath === wt.path)
            );
            if (exists) continue;

            const newId = `wt-${wt.branch.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            nextEntities.push({
              id: newId,
              uuid: newId,
              name: wt.branch,
              type: 'dev',
              worktree: wt.branch,
              worktreePath: wt.path,
              status: 'IDLE',
              statusMessage: `Git worktree: ${wt.path}`,
              tokenUsed: 0,
              tokenMax: 1000000,
              skills: ['antislop-ui'],
              createdAt: 'Git Worktree',
              summary: `Real Git worktree branch at ${wt.path}`,
            });
            nextRels.push({
              id: `rel-${hub.id}-${newId}`,
              source: hub.id,
              target: newId,
              label: '',
            });
            nextSelected.push(newId);
          }

          return {
            entities: nextEntities,
            relationships: nextRels,
            selectedSessionIds: nextSelected,
          };
        });
      } catch {
        // ignore if not a git repo or bridge offline
      }
    },

    compactEntityMemory: async (id) => {
      const target = get().entities.find((e) => e.id === id);
      if (!target) return;

      set((state) => ({
        entities: state.entities.map((e) =>
          e.id === id ? { ...e, status: 'COMPACTING', statusMessage: 'Compacting Pi session...' } : e
        ),
      }));

      try {
        const res = await fetch('http://127.0.0.1:1425/api/compact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: target.id,
            sessionId: target.uuid || target.id,
            cwd: target.worktreePath,
          }),
        });
        const ok = res.ok;
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: 'IDLE',
                  statusMessage: ok ? 'Compacted via Pi engine' : 'Compact failed',
                }
              : e
          ),
        }));
      } catch {
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === id ? { ...e, status: 'IDLE', statusMessage: 'Bridge unreachable' } : e
          ),
        }));
      }
    },

    compactSelectedEntities: async () => {
      const selectedIds = get().selectedSessionIds;
      if (selectedIds.length === 0) return;
      await Promise.all(selectedIds.map((id) => get().compactEntityMemory(id)));
    },

    compactAllEntities: async () => {
      const allIds = get().entities.map((e) => e.id);
      if (allIds.length === 0) return;
      await Promise.all(allIds.map((id) => get().compactEntityMemory(id)));
    },

    dispatchTaskToEntity: async (id, prompt) => {
      const target = get().entities.find((e) => e.id === id);
      if (!target) return;
      set((state) => ({
        entities: state.entities.map((e) =>
          e.id === id
            ? { ...e, status: 'WORKING', statusMessage: `Executing: "${prompt.slice(0, 36)}..."` }
            : e
        ),
      }));
      try {
        await fetch('http://127.0.0.1:1425/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: target.id,
            sessionId: target.uuid || target.id,
            cwd: target.worktreePath,
            prompt,
          }),
        });
      } catch {
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === id ? { ...e, status: 'IDLE', statusMessage: 'Bridge error' } : e
          ),
        }));
      }
    },
  };
});
