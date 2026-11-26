import React, { useEffect } from 'react';
import { EntityGraphHeader } from './components/EntityGraphHeader';
import { EntitySidebarLeft } from './components/EntitySidebarLeft';
import { EntityGraphCanvas } from './components/EntityGraphCanvas';
import { NodeDetailSidebar } from './components/NodeDetailSidebar';
import { PeekTerminalModal } from './components/PeekTerminalModal';
import { useAxonStore } from './store/axonStore';

export const App: React.FC = () => {
  // Global real-time SSE telemetry listener for Native Pi PTY [WORKING] / [IDLE] badges across canvas
  useEffect(() => {
    const sse = new EventSource('http://127.0.0.1:1425/api/stream');
    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!data || !data.type) return;
        const { entities, updateEntityStatus } = useAxonStore.getState();

        if (data.type === 'pty_status' && data.nodeId) {
          const match = entities.find(
            (ent) =>
              ent.id === data.nodeId ||
              (data.sessionFile && ent.uuid && data.sessionFile.includes(ent.uuid))
          );
          if (match) {
            updateEntityStatus(
              match.id,
              data.status === 'WORKING' ? 'WORKING' : 'IDLE',
              data.status === 'WORKING' ? 'Pi CLI active in Native PTY' : 'Ready (Zero-Idle)'
            );
          }
        } else if (data.type === 'agent_start' && data.nodeId) {
          updateEntityStatus(data.nodeId, 'WORKING', 'Executing prompt...');
        } else if (data.type === 'agent_end' && data.nodeId) {
          updateEntityStatus(data.nodeId, 'IDLE', 'Ready (Zero-Idle)');
        }
      } catch {
        // ignore malformed SSE
      }
    };
    return () => sse.close();
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#ffffff] text-[#0f172a]">
      {/* 1. Top Header Navigation */}
      <EntityGraphHeader />

      {/* 2. Main 3-Column Ergonomic Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Active Repo, Search, Entity Nodes Catalog */}
        <EntitySidebarLeft />

        {/* Center Workspace: Pure Clean Relationship Graph Canvas */}
        <main className="flex-1 h-full relative overflow-hidden bg-[#ffffff]">
          <EntityGraphCanvas />
        </main>

        {/* Right Sidebar: Node Details Inspector */}
        <NodeDetailSidebar />
      </div>

      {/* Floating Peek Terminal Modal */}
      <PeekTerminalModal />
    </div>
  );
};

export default App;
