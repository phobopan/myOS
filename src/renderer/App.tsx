import { useState, useEffect, useRef } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { ThreadView } from './components/ThreadView';
import { GmailThreadView } from './components/GmailThreadView';
import { InstagramThreadView } from './components/InstagramThreadView';
import { Settings } from './components/Settings';
import { PermissionOnboarding } from './components/PermissionOnboarding';
import type { IMessageConversation, GmailThread, InstagramConversation } from './types';

type SourceFilter = 'all' | 'imessage' | 'gmail' | 'instagram';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [selectedImessageId, setSelectedImessageId] = useState<number | null>(null);
  const [selectedGmailThreadId, setSelectedGmailThreadId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<'imessage' | 'gmail' | 'instagram' | null>(null);
  const [conversations, setConversations] = useState<IMessageConversation[]>([]);
  const [gmailThreads, setGmailThreads] = useState<GmailThread[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'authorized' | 'denied'>('checking');
  const [loading, setLoading] = useState(true);
  const [gmailAuth, setGmailAuth] = useState<{ authenticated: boolean; email: string | null; error: string | null }>({
    authenticated: false,
    email: null,
    error: null,
  });
  const [instagramAuth, setInstagramAuth] = useState<{ authenticated: boolean; username: string | null; error: string | null }>({
    authenticated: false,
    username: null,
    error: null,
  });
  const [instagramConversations, setInstagramConversations] = useState<InstagramConversation[]>([]);
  const [selectedInstagramConversationId, setSelectedInstagramConversationId] = useState<string | null>(null);

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
      setGmailAuth({ authenticated: gmailStatus, email: gmailEmail, error: null });
    } catch (err) {
      console.error('Failed to check Gmail auth:', err);
    }

    // Check Instagram auth status
    try {
      const instagramStatus = await window.electron.instagram.isAuthenticated();
      if (instagramStatus) {
        const accountInfo = await window.electron.instagram.getAccountInfo();
        setInstagramAuth({
          authenticated: true,
          username: accountInfo?.instagramUsername || null,
          error: null
        });
        // Fetch conversations
        try {
          const convs = await window.electron.instagram.getConversations();
          setInstagramConversations(convs);
        } catch (err) {
          console.error('Failed to fetch Instagram conversations:', err);
        }
      }
    } catch (err) {
      console.error('Failed to check Instagram auth:', err);
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

  const loadGmailThreads = async () => {
    try {
      console.log('Loading Gmail threads...');
      const threads = await window.electron.gmail.getThreads(20);
      console.log('Gmail threads loaded:', threads?.length || 0);
      setGmailThreads(threads || []);
    } catch (err) {
      console.error('Failed to load Gmail threads:', err);
    }
  };

  const loadInstagramConversations = async () => {
    try {
      const convs = await window.electron.instagram.getConversations();
      setInstagramConversations(convs);
    } catch (err) {
      console.error('Failed to load Instagram conversations:', err);
    }
  };

  // Load Gmail threads when authenticated
  useEffect(() => {
    if (gmailAuth.authenticated) {
      loadGmailThreads();
    }
  }, [gmailAuth.authenticated]);

  // Load Instagram conversations when authenticated
  useEffect(() => {
    if (instagramAuth.authenticated) {
      loadInstagramConversations();
    }
  }, [instagramAuth.authenticated]);

  const handleRetryPermission = async () => {
    setLoading(true);
    await initializeApp();
  };

  const handleGmailConnect = async () => {
    setGmailAuth(prev => ({ ...prev, error: null }));
    try {
      const success = await window.electron.gmail.authenticate();
      if (success) {
        const email = await window.electron.gmail.getUserEmail();
        setGmailAuth({ authenticated: true, email, error: null });
        // Load Gmail threads immediately
        loadGmailThreads();
      }
    } catch (err: any) {
      console.error('Gmail auth failed:', err);
      const errorMsg = err?.message || 'Authentication failed';
      setGmailAuth(prev => ({ ...prev, error: errorMsg }));
    }
  };

  const handleGmailDisconnect = async () => {
    await window.electron.gmail.disconnect();
    setGmailAuth({ authenticated: false, email: null, error: null });
  };

  const handleInstagramConnect = async () => {
    setInstagramAuth(prev => ({ ...prev, error: null }));
    try {
      const accountInfo = await window.electron.instagram.authenticate();
      setInstagramAuth({
        authenticated: true,
        username: accountInfo.instagramUsername,
        error: null
      });
      // Fetch conversations after auth
      loadInstagramConversations();
    } catch (err: unknown) {
      console.error('Instagram auth failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
      setInstagramAuth(prev => ({ ...prev, error: errorMsg }));
    }
  };

  const handleInstagramDisconnect = async () => {
    await window.electron.instagram.disconnect();
    setInstagramAuth({ authenticated: false, username: null, error: null });
    setInstagramConversations([]);
    setSelectedInstagramConversationId(null);
  };

  const handleInstagramSend = async (recipientId: string, text: string) => {
    const result = await window.electron.instagram.sendMessage(recipientId, text);
    if (!result.success) {
      throw new Error(result.error || 'Failed to send message');
    }
    // Refresh conversations to update list
    loadInstagramConversations();
  };

  const handleSelectImessage = (id: number) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      selectedConversationRef.current = conv;
    }
    setSelectedImessageId(id);
    setSelectedGmailThreadId(null);
    setSelectedInstagramConversationId(null);
    setActiveSource('imessage');
  };

  const handleSelectGmailThread = (id: string) => {
    setSelectedGmailThreadId(id);
    setSelectedImessageId(null);
    setSelectedInstagramConversationId(null);
    setActiveSource('gmail');
  };

  const handleSelectInstagramConversation = (id: string) => {
    setSelectedInstagramConversationId(id);
    setSelectedImessageId(null);
    setSelectedGmailThreadId(null);
    setActiveSource('instagram');
  };

  // Use the conversation from the list if available, otherwise use the cached one
  const selectedConversation =
    conversations.find(c => c.id === selectedImessageId) ||
    (selectedImessageId === selectedConversationRef.current?.id ? selectedConversationRef.current : null);

  const selectedInstagramConversation = instagramConversations.find(
    c => c.id === selectedInstagramConversationId
  ) || null;

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
          filter={filter}
          onFilterChange={setFilter}
          gmailConnected={gmailAuth.authenticated}
          instagramConnected={instagramAuth.authenticated}
          conversations={conversations}
          gmailThreads={gmailThreads}
          instagramConversations={instagramConversations}
          selectedImessageId={selectedImessageId}
          selectedGmailThreadId={selectedGmailThreadId}
          selectedInstagramConversationId={selectedInstagramConversationId}
          onSelectImessage={handleSelectImessage}
          onSelectGmailThread={handleSelectGmailThread}
          onSelectInstagramConversation={handleSelectInstagramConversation}
        />
        {activeSource === 'gmail' ? (
          <GmailThreadView
            threadId={selectedGmailThreadId}
            onReplySent={loadGmailThreads}
          />
        ) : activeSource === 'instagram' && selectedInstagramConversation ? (
          <InstagramThreadView
            conversation={selectedInstagramConversation}
            onSendMessage={handleInstagramSend}
          />
        ) : (
          <ThreadView
            conversation={selectedConversation}
            onMessageSent={loadConversations}
          />
        )}
      </div>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        gmailAuth={gmailAuth}
        onGmailConnect={handleGmailConnect}
        onGmailDisconnect={handleGmailDisconnect}
        imessageConnected={permissionStatus === 'authorized'}
        instagramAuth={instagramAuth}
        onInstagramConnect={handleInstagramConnect}
        onInstagramDisconnect={handleInstagramDisconnect}
      />
    </div>
  );
}
