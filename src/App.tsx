import React from 'react';
import { MirofishHeader } from './components/MirofishHeader';
import { MirofishCanvas } from './components/MirofishCanvas';
import { EntityLegend } from './components/EntityLegend';
import { NodeDetailSidebar } from './components/NodeDetailSidebar';
import { PeekTerminalModal } from './components/PeekTerminalModal';

export const App: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#000000] text-[#f5f5f5]">
      {/* 1. MiroFish Top Header Navigation */}
      <MirofishHeader />

      {/* 2. Main Workspace (Canvas + Floating Legend + Right Detail Panel) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Center Graph Canvas */}
        <main className="flex-1 h-full relative overflow-hidden">
          <MirofishCanvas />
          <EntityLegend />
        </main>

        {/* Right Sidebar: MiroFish Node Details (노드 상세) */}
        <NodeDetailSidebar />
      </div>

      {/* Floating Peek Terminal Modal */}
      <PeekTerminalModal />
    </div>
  );
};

export default App;
