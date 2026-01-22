import { useState, useEffect, useRef } from 'react';
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
  const [gmailAuth, setGmailAuth] = useState<{ authenticated: boolean; email: string | null }>({
    authenticated: false,
    email: null,
  });

  // Keep a reference to the currently selected conversation so it persists after reply
  const selectedConversationRef = useRef<IMessageConversation | null>(null);

  // Check permission and load data on mount
  useEffect(() => {
    initializeApp();
  }, []);

  // Poll for new conversations every 5 seconds
  useEffect(() => {
    if (permissionStatus !== 'authorized') return;

    const interval = setInterval(() => {
      loadConversations();
    }, 5000);

    return () => clearInterval(interval);
  }, [permissionStatus]);

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

    // Check Gmail auth status
    try {
      const gmailStatus = await window.electron.gmail.isAuthenticated();
      const gmailEmail = gmailStatus ? await window.electron.gmail.getUserEmail() : null;
      setGmailAuth({ authenticated: gmailStatus, email: gmailEmail });
    } catch (err) {
      console.error('Failed to check Gmail auth:', err);
    }

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

  const handleGmailConnect = async () => {
    try {
      const success = await window.electron.gmail.authenticate();
      if (success) {
        const email = await window.electron.gmail.getUserEmail();
        setGmailAuth({ authenticated: true, email });
      }
    } catch (err) {
      console.error('Gmail auth failed:', err);
    }
  };

  const handleGmailDisconnect = async () => {
    await window.electron.gmail.disconnect();
    setGmailAuth({ authenticated: false, email: null });
  };

  const handleSelectConversation = (id: number) => {
    // When selecting a new conversation, clear the cached one
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      selectedConversationRef.current = conv;
    }
    setSelectedId(id);
  };

  // Use the conversation from the list if available, otherwise use the cached one
  // This keeps the thread visible after replying until user clicks away
  const selectedConversation =
    conversations.find(c => c.id === selectedId) ||
    (selectedId === selectedConversationRef.current?.id ? selectedConversationRef.current : null);

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
          onSelect={handleSelectConversation}
        />
        <ThreadView
          conversation={selectedConversation}
          onMessageSent={loadConversations}
        />
      </div>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        gmailAuth={gmailAuth}
        onGmailConnect={handleGmailConnect}
        onGmailDisconnect={handleGmailDisconnect}
      />
    </div>
  );
}
