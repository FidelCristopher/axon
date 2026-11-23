export type NodeStatus = 'IDLE' | 'WORKING' | 'COMPACTING' | 'ERROR';

export type AgentRole = 'dev' | 'qa' | 'designer' | 'architect' | 'custom';

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  category: 'mobile' | 'web' | 'ui' | 'git' | 'system';
}

export interface AgentSession {
  id: string;
  name: string;
  role: AgentRole;
  worktree: string;
  status: NodeStatus;
  statusMessage?: string;
  tokenUsed: number;
  tokenMax: number;
  skills: string[];
  createdAt: string;
  lastActiveAt: string;
}

export interface SynapticEdge {
  id: string;
  source: string;
  target: string;
  active: boolean;
  pulseIntensity: number;
}

export interface GlobalDirective {
  message: string;
  targetMode: 'all' | 'selected';
  targetIds: string[];
  timestamp: string;
}
