import { useState, useEffect } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { ThreadView } from './components/ThreadView';
import { Settings } from './components/Settings';
import { PermissionOnboarding } from './components/PermissionOnboarding';
import type { IMessageConversation } from './types';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<IMessageConversation[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'authorized' | 'denied'>('checking');
  const [loading, setLoading] = useState(true);

  // Check permission and load data on mount
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    // Check FDA permission
    const fdaStatus = await window.electron.checkFullDiskAccess();
    if (fdaStatus !== 'authorized') {
      setPermissionStatus('denied');
      setLoading(false);
      return;
    }
    setPermissionStatus('authorized');

    // Build contact cache
    await window.electron.buildContactCache();

    // Load conversations
    await loadConversations();
    setLoading(false);
  };

  const loadConversations = async () => {
    try {
      const convs = await window.electron.imessage.getConversations(50);
      setConversations(convs);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const handleRetryPermission = async () => {
    setLoading(true);
    await initializeApp();
  };

  const selectedConversation = conversations.find(c => c.id === selectedId) || null;

  // Loading state
  if (loading) {
    return (
      <div className="app-background h-screen flex flex-col text-white">
        <Titlebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/50">Loading...</div>
        </div>
      </div>
    );
  }

  // Permission required
  if (permissionStatus === 'denied') {
    return (
      <div className="app-background h-screen flex flex-col text-white">
        <Titlebar />
        <PermissionOnboarding onRetry={handleRetryPermission} />
      </div>
    );
  }

  return (
    <div className="app-background h-screen flex flex-col text-white">
      <Titlebar onSettingsClick={() => setSettingsOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ThreadView
          conversation={selectedConversation}
          onMessageSent={loadConversations}
        />
      </div>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
