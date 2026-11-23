import React from 'react';
import { SidebarLeft } from './components/SidebarLeft';
import { NeuralCanvas } from './components/NeuralCanvas';
import { SidebarRight } from './components/SidebarRight';
import { PeekTerminalModal } from './components/PeekTerminalModal';
import { GlobalDirectiveModal } from './components/GlobalDirectiveModal';

export const App: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-[#f8fafc]">
      {/* 1. Left Sidebar: Projects, History, Search */}
      <SidebarLeft />

      {/* 2. Center Workspace: Interactive Neural Synapse Canvas */}
      <main className="flex-1 h-full relative flex flex-col overflow-hidden">
        <NeuralCanvas />
      </main>

      {/* 3. Right Sidebar: Inspector, Batch Skills, Memory Compact Controls */}
      <SidebarRight />

      {/* Interactive Overlays */}
      <PeekTerminalModal />
      <GlobalDirectiveModal />
    </div>
  );
};

export default App;
