import React from 'react';
import { EntityGraphHeader } from './components/EntityGraphHeader';
import { EntitySidebarLeft } from './components/EntitySidebarLeft';
import { EntityGraphCanvas } from './components/EntityGraphCanvas';
import { EntityLegend } from './components/EntityLegend';
import { NodeDetailSidebar } from './components/NodeDetailSidebar';
import { PeekTerminalModal } from './components/PeekTerminalModal';

export const App: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#000000] text-[#f5f5f5]">
      {/* 1. Top Header Navigation */}
      <EntityGraphHeader />

      {/* 2. Main 3-Column Ergonomic Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Active Repo, Search, Entity Nodes Catalog */}
        <EntitySidebarLeft />

        {/* Center Workspace: Relationship Graph Canvas & Floating Legend */}
        <main className="flex-1 h-full relative overflow-hidden">
          <EntityGraphCanvas />
          <EntityLegend />
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
