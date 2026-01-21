import { useState } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { ThreadView } from './components/ThreadView';
import { Settings } from './components/Settings';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-transparent text-white">
      <Titlebar onSettingsClick={() => setSettingsOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <ThreadView />
      </div>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
