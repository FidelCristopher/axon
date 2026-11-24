import React from 'react';
import { EntityGraphHeader } from './components/EntityGraphHeader';
import { EntitySidebarLeft } from './components/EntitySidebarLeft';
import { EntityGraphCanvas } from './components/EntityGraphCanvas';
import { NodeDetailSidebar } from './components/NodeDetailSidebar';
import { PeekTerminalModal } from './components/PeekTerminalModal';

export const App: React.FC = () => {
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
