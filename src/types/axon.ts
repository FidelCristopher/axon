export type NodeStatus = 'IDLE' | 'WORKING' | 'COMPACTING' | 'ERROR';

export type EntityType = 'hub' | 'dev' | 'qa' | 'designer' | 'skill';

export interface GraphEntity {
  id: string;
  uuid: string;
  name: string;
  type: EntityType;
  worktree: string;
  status: NodeStatus;
  statusMessage?: string;
  tokenUsed: number;
  tokenMax: number;
  skills: string[];
  createdAt: string;
  summary: string;
}

export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  label: string;
}
