import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { ThreadView } from './components/ThreadView';
import { GmailThreadView } from './components/GmailThreadView';
import { InstagramThreadView } from './components/InstagramThreadView';
import { DigestView } from './components/DigestView';
import { PinnedDashboard } from './components/PinnedDashboard';
import { Settings } from './components/Settings';
import { PermissionOnboarding } from './components/PermissionOnboarding';
import { OnboardingWizard } from './components/OnboardingWizard';
import { FeatureTooltip } from './components/FeatureTooltip';
import { useFeatureHints } from './hooks/useFeatureHints';
import type { IMessageConversation, GmailThread, InstagramConversation, Tag, ContactTagAssignment, DigestCategory, Digest, DismissedThread, PinnedDashboard as PinnedDashboardType, PinnedChat, Cluster } from './types';

type SourceFilter = 'all' | 'imessage' | 'gmail' | 'instagram';

const INSTAGRAM_ENABLED = false;

export default function App() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [appName, setAppName] = useState('OS');
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

  // Pagination state
  const [gmailNextPageToken, setGmailNextPageToken] = useState<string | undefined>(undefined);
  const [gmailHasMore, setGmailHasMore] = useState(true);
  const [gmailLoadingMore, setGmailLoadingMore] = useState(false);
  const [instagramHasMore, setInstagramHasMore] = useState(true);
  const [instagramLoadingMore, setInstagramLoadingMore] = useState(false);
  const [instagramCurrentLimit, setInstagramCurrentLimit] = useState(25);

  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  // Tag state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [customTags, setCustomTags] = useState<Tag[]>([]);
  const [tagAssignments, setTagAssignments] = useState<ContactTagAssignment[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Digest state
  const [digestSelected, setDigestSelected] = useState(false);
  const [currentDigest, setCurrentDigest] = useState<Digest | null>(null);
  const [digestGenerating, setDigestGenerating] = useState(false);
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [digestCategories, setDigestCategories] = useState<DigestCategory[]>([]);
  const [digestAutoEnabled, setDigestAutoEnabled] = useState(false);
  const [digestAutoTime, setDigestAutoTime] = useState('18:00');
  const [digestFrequency, setDigestFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [digestLookbackDays, setDigestLookbackDays] = useState(7);
  const [digestIntervalHours, setDigestIntervalHours] = useState(1);
  const [digestWeekday, setDigestWeekday] = useState(1);
  const [digestRepliedThreadIds, setDigestRepliedThreadIds] = useState<Set<string>>(new Set());
  const [cameFromDigest, setCameFromDigest] = useState(false);

  // Dismissed threads state
  const [dismissedThreads, setDismissedThreads] = useState<DismissedThread[]>([]);

  // Dashboard state (for sidebar cluster list + refresh trigger)
  const [dashboardClusters, setDashboardClusters] = useState<Cluster[]>([]);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([]);

  // Feature hints (post-onboarding tooltips)
  const featureHints = useFeatureHints(onboardingComplete === true);

  // Keep a reference to the currently selected conversation so it persists after reply
  const selectedConversationRef = useRef<IMessageConversation | null>(null);

  // Track previous messages for notification detection
  const prevImessageIdsRef = useRef<Set<string>>(new Set());
  const prevGmailIdsRef = useRef<Set<string>>(new Set());
  const prevInstagramIdsRef = useRef<Set<string>>(new Set());
  const initialLoadCompleteRef = useRef(false);

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const complete = await window.electron.app.getOnboardingComplete();
        setOnboardingComplete(complete);
        if (complete) {
          const name = await window.electron.app.getAppName();
          setAppName(name);
        }
      } catch {
        setOnboardingComplete(false);
      }
    };
    checkOnboarding();
  }, []);

  // Check permission and load data on mount (only after onboarding)
  useEffect(() => {
    if (onboardingComplete) {
      initializeApp();
    }
  }, [onboardingComplete]);

  // Poll for new conversations every 30 seconds (all sources)
  useEffect(() => {
    if (permissionStatus !== 'authorized') return;

    const interval = setInterval(() => {
      // Poll iMessage
      loadConversations();

      // Poll Gmail if authenticated
      if (gmailAuth.authenticated) {
        loadGmailThreads();
      }

      // Poll Instagram if authenticated and enabled
      if (INSTAGRAM_ENABLED && instagramAuth.authenticated) {
        loadInstagramConversations();
      }
    }, 30000); // 30 seconds to avoid rate limits

    return () => clearInterval(interval);
  }, [permissionStatus, gmailAuth.authenticated, instagramAuth.authenticated]);

  // Load notification settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const notifEnabled = await window.electron.settings.getNotificationsEnabled();
        console.log('[Settings] Loaded from store:', { notifEnabled });
        setNotificationsEnabled(notifEnabled);
      } catch (err) {
        console.error('[Settings] Failed to load:', err);
      }
    };
    loadSettings();
  }, []);

  // Load tags on mount, poll every 30s, and listen for instant change events
  useEffect(() => {
    loadTags();

    const interval = setInterval(() => {
      loadTags();
    }, 30000);

    // Listen for instant tag change notifications from main process
    const cleanup = window.electron.tags.onChanged(() => {
      loadTags();
    });

    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, []);

  // Load digest state on mount
  useEffect(() => {
    loadDigestState();

    // Listen for auto-generated digest
    const cleanup = window.electron.digest.onAutoGenerated(() => {
      loadDigestState();
    });
    return cleanup;
  }, []);

  // Load dismissed threads on mount
  useEffect(() => {
    window.electron.threads.getDismissed().then(setDismissedThreads).catch(err => {
      console.error('[Dismissed] Failed to load:', err);
    });
  }, []);

  // Auto-invalidation: check dismissed threads against current activity keys
  useEffect(() => {
    if (dismissedThreads.length === 0) return;

    const toUndismiss: { id: string; source: string }[] = [];

    for (const dt of dismissedThreads) {
      let currentKey = '';
      if (dt.source === 'imessage') {
        const conv = conversations.find(c => String(c.id) === dt.id);
        if (conv) currentKey = new Date(conv.lastMessageDate).toISOString();
      } else if (dt.source === 'gmail') {
        const thread = gmailThreads.find(t => t.id === dt.id);
        if (thread) {
          const lastMsg = thread.messages[thread.messages.length - 1];
          currentKey = lastMsg?.id || '';
        }
      } else if (dt.source === 'instagram') {
        const conv = instagramConversations.find(c => c.id === dt.id);
        if (conv) currentKey = new Date(conv.updatedTime).toISOString();
      }

      // If we found a current key and it differs from the dismissed key, invalidate
      if (currentKey && currentKey !== dt.lastActivityKey) {
        toUndismiss.push({ id: dt.id, source: dt.source });
      }
    }

    if (toUndismiss.length > 0) {
      // Remove from local state
      setDismissedThreads(prev => prev.filter(dt =>
        !toUndismiss.some(u => u.id === dt.id && u.source === dt.source)
      ));
      // Remove from persistent storage
      for (const u of toUndismiss) {
        window.electron.threads.undismiss(u.id, u.source);
      }
    }
  }, [conversations, gmailThreads, instagramConversations, dismissedThreads]);

  // Load dashboard clusters for sidebar pin menu
  useEffect(() => {
    window.electron.dashboard.get().then(d => setDashboardClusters(d.clusters));
  }, []);

  const handlePinToDashboard = useCallback(async (source: 'imessage' | 'gmail' | 'instagram', id: string, clusterId?: string) => {
    const pin: PinnedChat = {
      source,
      id,
      position: { x: 0, y: 0 },
      addedAt: new Date().toISOString(),
    };
    await window.electron.dashboard.pinChat(pin, clusterId);
    const updated = await window.electron.dashboard.get();
    setDashboardClusters(updated.clusters);
    setDashboardRefreshKey(k => k + 1);
  }, []);

  const handleToggleClusterFilter = useCallback((clusterId: string) => {
    setSelectedClusterIds(prev =>
      prev.includes(clusterId)
        ? prev.filter(id => id !== clusterId)
        : [...prev, clusterId]
    );
  }, []);

  // Build dismissed ID set for quick lookup
  const dismissedIdSet = useMemo(() => new Set(dismissedThreads.map(dt => dt.id)), [dismissedThreads]);

  // Handler to dismiss a thread
  const handleDismissThread = useCallback(async (id: string, source: 'imessage' | 'gmail' | 'instagram', activityKey: string) => {
    const dismissed: DismissedThread = {
      id,
      source,
      dismissedAt: new Date().toISOString(),
      lastActivityKey: activityKey,
    };
    await window.electron.threads.dismiss(dismissed);
    setDismissedThreads(prev => [...prev.filter(dt => !(dt.id === id && dt.source === source)), dismissed]);
  }, []);

  const loadDigestState = async () => {
    try {
      const [available, categories, lastDigest, autoSettings] = await Promise.all([
        window.electron.claude.isAvailable(),
        window.electron.digest.getCategories(),
        window.electron.digest.getLast(),
        window.electron.digest.getAutoSettings(),
      ]);
      setClaudeAvailable(available);
      setDigestCategories(categories);
      setCurrentDigest(lastDigest);
      setDigestAutoEnabled(autoSettings.enabled);
      setDigestAutoTime(autoSettings.time);
      setDigestFrequency(autoSettings.frequency || 'daily');
      setDigestLookbackDays(autoSettings.lookbackDays ?? 7);
      setDigestIntervalHours(autoSettings.intervalHours ?? 1);
      setDigestWeekday(autoSettings.weekday ?? 1);
    } catch (err) {
      console.error('[Digest] Failed to load state:', err);
    }
  };

  const loadTags = async () => {
    try {
      const [all, custom, assignments] = await Promise.all([
        window.electron.tags.getAll(),
        window.electron.tags.getCustom(),
        window.electron.tags.getAssignments(),
      ]);
      setAllTags(all);
      setCustomTags(custom);
      setTagAssignments(assignments);
    } catch (err) {
      console.error('[Tags] Failed to load:', err);
    }
  };

  const handleTagCreate = async (tag: { name: string; importance: number; color: string }) => {
    await window.electron.tags.create(tag);
    await loadTags();
  };

  const handleTagUpdate = async (tagId: string, updates: { name?: string; color?: string; importance?: number }) => {
    await window.electron.tags.update(tagId, updates);
    await loadTags();
  };

  const handleTagDelete = async (tagId: string) => {
    await window.electron.tags.delete(tagId);
    // Also remove from selected filters if it was selected
    setSelectedTagIds(prev => prev.filter(id => id !== tagId));
    await loadTags();
  };

  const handleToggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const handleClearTagFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedClusterIds([]);
  }, []);

  const handleTagAssign = async (contact: { platform: string; identifier: string }, tagIds: string[], displayName: string) => {
    await window.electron.tags.assignToContact(contact as any, tagIds, displayName);
    await loadTags();
  };

  // ============ Digest Handlers ============

  const handleSelectDashboard = useCallback(() => {
    setDigestSelected(false);
    setCameFromDigest(false);
    setSelectedImessageId(null);
    setSelectedGmailThreadId(null);
    setSelectedInstagramConversationId(null);
    setActiveSource(null);
    selectedConversationRef.current = null;
  }, []);

  // Derived: is the dashboard currently showing?
  const dashboardSelected = !digestSelected && !activeSource && !selectedImessageId && !selectedGmailThreadId && !selectedInstagramConversationId;

  const handleSelectDigest = useCallback(() => {
    setDigestSelected(true);
    setCameFromDigest(false);
    setSelectedImessageId(null);
    setSelectedGmailThreadId(null);
    setSelectedInstagramConversationId(null);
    setActiveSource(null);
  }, []);

  const handleGenerateDigest = useCallback(async () => {
    setDigestGenerating(true);
    try {
      const digest = await window.electron.digest.generate();
      setCurrentDigest(digest);
    } catch (err) {
      console.error('[Digest] Generation failed:', err);
    } finally {
      setDigestGenerating(false);
    }
  }, []);

  const handleDigestSelectGmail = (threadId: string) => {
    setDigestSelected(false);
    setCameFromDigest(true);
    handleSelectGmailThread(threadId);
  };

  const handleDigestSelectImessage = (conversationId: number) => {
    setDigestSelected(false);
    setCameFromDigest(true);
    handleSelectImessage(conversationId);
  };

  const handleDigestCategoryCreate = async (category: { name: string; color: string; description?: string }) => {
    await window.electron.digest.createCategory(category);
    const categories = await window.electron.digest.getCategories();
    setDigestCategories(categories);
  };

  const handleDigestCategoryUpdate = async (id: string, updates: { name?: string; color?: string; description?: string }) => {
    await window.electron.digest.updateCategory(id, updates);
    const categories = await window.electron.digest.getCategories();
    setDigestCategories(categories);
  };

  const handleDigestCategoryDelete = async (id: string) => {
    await window.electron.digest.deleteCategory(id);
    const categories = await window.electron.digest.getCategories();
    setDigestCategories(categories);
  };

  const handleDigestAutoSettingsChange = async (enabled: boolean, time: string, frequency: 'hourly' | 'daily' | 'weekly', lookbackDays: number, intervalHours: number, weekday: number) => {
    await window.electron.digest.setAutoSettings(enabled, time, frequency, lookbackDays, intervalHours, weekday);
    setDigestAutoEnabled(enabled);
    setDigestAutoTime(time);
    setDigestFrequency(frequency);
    setDigestLookbackDays(lookbackDays);
    setDigestIntervalHours(intervalHours);
    setDigestWeekday(weekday);
  };

  // Helper to show notification for new message
  const showNewMessageNotification = async (source: string, senderName: string, preview: string) => {
    console.log('[Notification] Attempting to show:', { source, senderName, notificationsEnabled, initialLoadComplete: initialLoadCompleteRef.current });

    if (!notificationsEnabled) {
      console.log('[Notification] Skipped - notifications disabled');
      return;
    }

    if (!initialLoadCompleteRef.current) {
      console.log('[Notification] Skipped - initial load not complete');
      return;
    }

    try {
      const result = await window.electron.app.showNotification({
        title: senderName,
        body: preview.length > 100 ? preview.slice(0, 100) + '...' : preview,
        subtitle: source,
      });
      console.log('[Notification] Result:', result);
    } catch (err) {
      console.error('[Notification] Error:', err);
    }
  };

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

    // Check Instagram auth status (only if enabled)
    if (INSTAGRAM_ENABLED) {
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
            const result = await window.electron.instagram.getConversations();
            setInstagramConversations(result.conversations);
            setInstagramHasMore(result.hasMore);
          } catch (err) {
            console.error('Failed to fetch Instagram conversations:', err);
          }
        }
      } catch (err) {
        console.error('Failed to check Instagram auth:', err);
      }
    }


    // Load conversations
    await loadConversations();
    setLoading(false);

    // Mark initial load complete - notifications will only show after this
    initialLoadCompleteRef.current = true;
  };

  const loadConversations = async () => {
    try {
      let convs = await window.electron.imessage.getConversations(50);

      // Check for new messages (not from me)
      if (initialLoadCompleteRef.current) {
        const prevIds = prevImessageIdsRef.current;
        for (const conv of convs) {
          // Create unique ID based on conversation + last message
          const msgKey = `${conv.id}-${conv.lastMessageDate}`;
          if (!conv.isFromMe && !prevIds.has(msgKey)) {
            console.log('[iMessage] New message detected:', { from: conv.displayName, msgKey, prevCount: prevIds.size });
            const senderName = conv.contactName || conv.displayName || conv.handleId || 'Unknown';
            showNewMessageNotification('iMessage', senderName, conv.lastMessage || 'New message');
          }
        }
      }

      // Update tracked IDs
      prevImessageIdsRef.current = new Set(
        convs.map(c => `${c.id}-${c.lastMessageDate}`)
      );

      // Supplement with pinned iMessage conversations not in the sidebar list
      // (e.g. conversations where user already replied, or older ones)
      try {
        const dashboard = await window.electron.dashboard.get();
        const pinnedImessageIds: number[] = [];
        for (const pin of dashboard.unclusteredPins) {
          if (pin.source === 'imessage') pinnedImessageIds.push(Number(pin.id));
        }
        for (const cluster of dashboard.clusters) {
          for (const pin of cluster.pins) {
            if (pin.source === 'imessage') pinnedImessageIds.push(Number(pin.id));
          }
        }
        const existingIds = new Set(convs.map(c => c.id));
        const missingIds = pinnedImessageIds.filter(id => !existingIds.has(id));
        if (missingIds.length > 0) {
          const missing = await window.electron.imessage.getConversationsByIds(missingIds);
          convs.push(...missing);
        }
      } catch (err) {
        console.error('Failed to supplement pinned conversations:', err);
      }

      // Deduplicate conversations — keep the entry with the most recent message.
      // The SQL already deduplicates by chat_identifier (1:1) and display_name
      // (group chats), but supplementing pinned convos can re-introduce dupes.
      const seen = new Map<string, number>();
      for (let i = 0; i < convs.length; i++) {
        // Use same dedup key as the SQL: group chats by displayName, others by chatIdentifier
        const key = convs[i].isGroup && convs[i].displayName
          ? `group:${convs[i].displayName}`
          : convs[i].chatIdentifier;
        const prev = seen.get(key);
        if (prev !== undefined) {
          const prevDate = new Date(convs[prev].lastMessageDate).getTime();
          const currDate = new Date(convs[i].lastMessageDate).getTime();
          if (currDate > prevDate) {
            seen.set(key, i);
          }
        } else {
          seen.set(key, i);
        }
      }
      const keepIndices = new Set(seen.values());
      convs = convs.filter((_, i) => keepIndices.has(i));

      // Fix stale dashboard pin IDs: if a pin references a ROWID that was
      // deduped away (e.g. SMS row replaced by iMessage row for same contact),
      // update it to the canonical ROWID
      try {
        const dashboard = await window.electron.dashboard.get();
        const imessagePinIds: number[] = [];
        for (const pin of dashboard.unclusteredPins) {
          if (pin.source === 'imessage') imessagePinIds.push(Number(pin.id));
        }
        for (const cluster of dashboard.clusters) {
          for (const pin of cluster.pins) {
            if (pin.source === 'imessage') imessagePinIds.push(Number(pin.id));
          }
        }
        const canonicalIds = new Set(convs.map(c => c.id));
        const staleIds = imessagePinIds.filter(id => !canonicalIds.has(id));
        if (staleIds.length > 0) {
          const remapped = await window.electron.imessage.resolveCanonicalIds(staleIds);
          let dashboardDirty = false;
          const fixPin = (pin: { source: string; id: string }) => {
            if (pin.source !== 'imessage') return;
            const newId = remapped[Number(pin.id)];
            if (newId !== undefined) {
              pin.id = String(newId);
              dashboardDirty = true;
            }
          };
          for (const pin of dashboard.unclusteredPins) fixPin(pin);
          for (const cluster of dashboard.clusters) {
            for (const pin of cluster.pins) fixPin(pin);
          }
          if (dashboardDirty) {
            await window.electron.dashboard.save(dashboard);
          }
        }
      } catch (err) {
        console.error('Failed to fix stale pin IDs:', err);
      }

      setConversations(convs);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadGmailThreads = async () => {
    try {
      console.log('Loading Gmail threads...');
      const result = await window.electron.gmail.getThreads(20);
      console.log('Gmail threads loaded:', result.threads?.length || 0);

      // Check for new emails
      if (initialLoadCompleteRef.current && result.threads) {
        const prevIds = prevGmailIdsRef.current;
        for (const thread of result.threads) {
          const lastMsg = thread.messages[thread.messages.length - 1];
          const msgKey = `${thread.id}-${lastMsg?.id}`;
          if (!prevIds.has(msgKey)) {
            console.log('[Gmail] New email detected:', { threadId: thread.id, msgKey, prevCount: prevIds.size });
            const fromMatch = lastMsg?.from?.match(/^([^<]+)</);
            const senderName = fromMatch ? fromMatch[1].trim() : lastMsg?.from || 'Unknown';
            showNewMessageNotification('Gmail', senderName, lastMsg?.snippet || lastMsg?.subject || 'New email');
          }
        }
      }

      // Update tracked IDs
      prevGmailIdsRef.current = new Set(
        (result.threads || []).map(t => {
          const lastMsg = t.messages[t.messages.length - 1];
          return `${t.id}-${lastMsg?.id}`;
        })
      );

      // Clear local replied tracking for threads where the API now shows our reply
      if (result.threads) {
        const confirmedReplied = new Set<string>();
        for (const t of result.threads) {
          const last = t.messages[t.messages.length - 1];
          if (last?.labelIds?.includes('SENT')) {
            confirmedReplied.add(t.id);
          }
        }
        if (confirmedReplied.size > 0) {
          setDigestRepliedThreadIds(prev => {
            const next = new Set(prev);
            for (const id of confirmedReplied) next.delete(id);
            return next.size !== prev.size ? next : prev;
          });
        }
      }

      // Backfill: keep fetching pages until we have enough visible threads
      let allThreads = result.threads || [];
      let nextToken = result.nextPageToken;

      const countVisible = (threads: typeof allThreads) =>
        threads.filter(t => {
          const lastMsg = t.messages[t.messages.length - 1];
          if (lastMsg?.labelIds?.includes('SENT')) return false;
          if (digestRepliedThreadIds.has(t.id)) return false;
          if (dismissedIdSet.has(t.id)) return false;
          return true;
        }).length;

      while (countVisible(allThreads) < 15 && nextToken) {
        console.log(`[Gmail backfill] Only ${countVisible(allThreads)} visible threads, fetching more...`);
        const more = await window.electron.gmail.getThreads(20, nextToken);
        allThreads = [...allThreads, ...(more.threads || [])];
        nextToken = more.nextPageToken;
      }

      console.log(`[Gmail] Total threads: ${allThreads.length}, visible: ${countVisible(allThreads)}`);
      setGmailThreads(allThreads);
      setGmailNextPageToken(nextToken);
      setGmailHasMore(!!nextToken);
    } catch (err) {
      console.error('Failed to load Gmail threads:', err);
    }
  };

  const loadMoreGmailThreads = async () => {
    if (gmailLoadingMore || !gmailHasMore || !gmailNextPageToken) return;

    setGmailLoadingMore(true);
    try {
      const result = await window.electron.gmail.getThreads(20, gmailNextPageToken);
      setGmailThreads(prev => [...prev, ...(result.threads || [])]);
      setGmailNextPageToken(result.nextPageToken);
      setGmailHasMore(!!result.nextPageToken);
    } catch (err) {
      console.error('Failed to load more Gmail threads:', err);
    } finally {
      setGmailLoadingMore(false);
    }
  };

  // Auto-backfill Gmail threads when visible count drops below threshold
  const gmailBackfillInProgressRef = useRef(false);
  useEffect(() => {
    if (!gmailHasMore || gmailLoadingMore || gmailBackfillInProgressRef.current) return;

    const visibleCount = gmailThreads.filter(t => {
      const lastMsg = t.messages[t.messages.length - 1];
      if (lastMsg?.labelIds?.includes('SENT')) return false;
      if (digestRepliedThreadIds.has(t.id)) return false;
      if (dismissedIdSet.has(t.id)) return false;
      return true;
    }).length;

    if (visibleCount < 15) {
      gmailBackfillInProgressRef.current = true;
      loadMoreGmailThreads().finally(() => {
        gmailBackfillInProgressRef.current = false;
      });
    }
  }, [gmailThreads, digestRepliedThreadIds, dismissedIdSet, gmailHasMore, gmailLoadingMore]);

  const loadInstagramConversations = async (reset?: boolean) => {
    try {
      console.log('Loading Instagram conversations...');
      const limit = (reset !== false) ? 25 : instagramCurrentLimit;
      const result = await window.electron.instagram.getConversations(limit);
      console.log('Instagram conversations loaded:', result.conversations?.length || 0);

      // Check for new messages (from others, not from me)
      if (initialLoadCompleteRef.current && result.conversations) {
        const prevIds = prevInstagramIdsRef.current;
        for (const conv of result.conversations) {
          const msgKey = `${conv.id}-${conv.updatedTime}`;
          if (conv.lastMessage?.fromUser && !prevIds.has(msgKey)) {
            console.log('[Instagram] New message detected:', { from: conv.recipientUsername, msgKey, prevCount: prevIds.size });
            const senderName = conv.recipientName || `@${conv.recipientUsername}`;
            showNewMessageNotification('Instagram', senderName, conv.lastMessage?.text || 'New message');
          }
        }
      }

      // Update tracked IDs
      prevInstagramIdsRef.current = new Set(
        (result.conversations || []).map(c => `${c.id}-${c.updatedTime}`)
      );

      setInstagramConversations(result.conversations || []);
      setInstagramHasMore(result.hasMore);
      if (reset !== false) setInstagramCurrentLimit(25);
    } catch (err) {
      console.error('Failed to load Instagram conversations:', err);
    }
  };

  const loadMoreInstagramConversations = async () => {
    if (instagramLoadingMore || !instagramHasMore) return;

    setInstagramLoadingMore(true);
    try {
      // For Instagram, we increase the limit and refetch
      const newLimit = instagramCurrentLimit + 25;
      const result = await window.electron.instagram.getConversations(newLimit);
      setInstagramConversations(result.conversations || []);
      setInstagramHasMore(result.hasMore);
      setInstagramCurrentLimit(newLimit);
    } catch (err) {
      console.error('Failed to load more Instagram conversations:', err);
    } finally {
      setInstagramLoadingMore(false);
    }
  };

  // Load Gmail threads when authenticated
  useEffect(() => {
    if (gmailAuth.authenticated) {
      loadGmailThreads();
    }
  }, [gmailAuth.authenticated]);

  // Load Instagram conversations when authenticated (only if enabled)
  useEffect(() => {
    if (INSTAGRAM_ENABLED && instagramAuth.authenticated) {
      loadInstagramConversations();
    }
  }, [instagramAuth.authenticated]);

  const handleRetryPermission = async () => {
    setLoading(true);
    await initializeApp();
  };

  const handleOnboardingComplete = async () => {
    const name = await window.electron.app.getAppName();
    setAppName(name);
    setOnboardingComplete(true);
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

  const handleImessageOpenSettings = async () => {
    await window.electron.requestFullDiskAccess();
  };

  const handleNotificationsChange = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await window.electron.settings.setNotificationsEnabled(enabled);
  };

  const handleInstagramConnect = async (username: string, password: string) => {
    setInstagramAuth(prev => ({ ...prev, error: null }));
    const accountInfo = await window.electron.instagram.authenticateWithCredentials(username, password);
    setInstagramAuth({
      authenticated: true,
      username: accountInfo.instagramUsername,
      error: null
    });
    // Fetch conversations after auth
    loadInstagramConversations();
  };

  const handleInstagramConnect2FA = async (username: string, password: string, code: string) => {
    setInstagramAuth(prev => ({ ...prev, error: null }));
    const accountInfo = await window.electron.instagram.completeWithTwoFactor(username, password, code);
    setInstagramAuth({
      authenticated: true,
      username: accountInfo.instagramUsername,
      error: null
    });
    // Fetch conversations after auth
    loadInstagramConversations();
  };

  const handleInstagramDisconnect = async () => {
    await window.electron.instagram.disconnect();
    setInstagramAuth({ authenticated: false, username: null, error: null });
    setInstagramConversations([]);
    setSelectedInstagramConversationId(null);
  };

  const handleInstagramSend = async (threadId: string, text: string) => {
    const result = await window.electron.instagram.sendMessage(threadId, text);
    if (!result.success) {
      throw new Error(result.error || 'Failed to send message');
    }
    // Refresh conversations to update list
    loadInstagramConversations();
  };

  const handleSelectImessage = useCallback((id: number) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      selectedConversationRef.current = conv;
    }
    setSelectedImessageId(id);
    setSelectedGmailThreadId(null);
    setSelectedInstagramConversationId(null);
    setActiveSource('imessage');
    setDigestSelected(false);
    // Don't clear cameFromDigest here — handleDigestSelectImessage calls this
  }, [conversations]);

  const handleSelectGmailThread = useCallback((id: string) => {
    setSelectedGmailThreadId(id);
    setSelectedImessageId(null);
    setSelectedInstagramConversationId(null);
    setActiveSource('gmail');
    setDigestSelected(false);
    // Don't clear cameFromDigest here — handleDigestSelectGmail calls this
  }, []);

  const handleSelectInstagramConversation = useCallback((id: string) => {
    setSelectedInstagramConversationId(id);
    setSelectedImessageId(null);
    setSelectedGmailThreadId(null);
    setActiveSource('instagram');
    setDigestSelected(false);
    setCameFromDigest(false);
  }, []);

  // Use the conversation from the list if available, otherwise use the cached one
  const selectedConversation =
    conversations.find(c => c.id === selectedImessageId) ||
    (selectedImessageId === selectedConversationRef.current?.id ? selectedConversationRef.current : null);

  const selectedInstagramConversation = instagramConversations.find(
    c => c.id === selectedInstagramConversationId
  ) || null;

  // Helper to get tags for a specific contact
  const getContactTagsForView = (platform: 'imessage' | 'gmail' | 'instagram', identifier: string): Tag[] => {
    const assignment = tagAssignments.find(
      a => a.contact.platform === platform && a.contact.identifier === identifier
    );
    if (!assignment) return [];
    return assignment.tagIds
      .map(id => allTags.find(t => t.id === id))
      .filter((t): t is Tag => t !== undefined);
  };

  // Get tags for currently selected conversations
  const selectedImessageTags = selectedConversation
    ? getContactTagsForView('imessage', selectedConversation.handleId || selectedConversation.chatIdentifier || '')
    : [];

  const selectedGmailTags = (() => {
    if (!selectedGmailThreadId) return [];
    const thread = gmailThreads.find(t => t.id === selectedGmailThreadId);
    if (!thread) return [];
    const lastMsg = thread.messages[thread.messages.length - 1];
    const emailMatch = lastMsg?.from?.match(/<([^>]+)>/);
    const email = emailMatch ? emailMatch[1] : lastMsg?.from || '';
    return getContactTagsForView('gmail', email);
  })();

  const selectedInstagramTags = selectedInstagramConversation
    ? getContactTagsForView('instagram', selectedInstagramConversation.recipientId)
    : [];

  // Checking onboarding status
  if (onboardingComplete === null) {
    return (
      <div className="app-background h-screen flex flex-col text-white">
        <Titlebar appName={appName} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/50">Loading...</div>
        </div>
      </div>
    );
  }

  // Onboarding wizard
  if (!onboardingComplete) {
    return (
      <div className="app-background h-screen flex flex-col text-white">
        <Titlebar appName={appName} />
        <OnboardingWizard onComplete={handleOnboardingComplete} onNameChange={setAppName} />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="app-background h-screen flex flex-col text-white">
        <Titlebar appName={appName} />
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
        <Titlebar appName={appName} />
        <PermissionOnboarding onRetry={handleRetryPermission} appName={appName} />
      </div>
    );
  }

  return (
    <div className="app-background h-screen flex flex-col text-white">
      <Titlebar onSettingsClick={() => setSettingsOpen(true)} appName={appName} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          filter={filter}
          onFilterChange={setFilter}
          gmailConnected={gmailAuth.authenticated}
          instagramConnected={INSTAGRAM_ENABLED && instagramAuth.authenticated}
          conversations={conversations}
          gmailThreads={gmailThreads}
          instagramConversations={instagramConversations}
          selectedImessageId={selectedImessageId}
          selectedGmailThreadId={selectedGmailThreadId}
          selectedInstagramConversationId={selectedInstagramConversationId}
          onSelectImessage={(id: number) => { setCameFromDigest(false); handleSelectImessage(id); }}
          onSelectGmailThread={handleSelectGmailThread}
          onSelectInstagramConversation={handleSelectInstagramConversation}
          gmailHasMore={gmailHasMore}
          gmailLoadingMore={gmailLoadingMore}
          onLoadMoreGmail={loadMoreGmailThreads}
          instagramHasMore={instagramHasMore}
          instagramLoadingMore={instagramLoadingMore}
          onLoadMoreInstagram={loadMoreInstagramConversations}
          tags={allTags}
          tagAssignments={tagAssignments}
          selectedTagIds={selectedTagIds}
          onToggleTagFilter={handleToggleTagFilter}
          onClearTagFilters={handleClearTagFilters}
          onTagAssign={handleTagAssign}
          digestSelected={digestSelected}
          onSelectDigest={handleSelectDigest}
          lastDigestTime={currentDigest?.generatedAt || null}
          digestGenerating={digestGenerating}
          dismissedIds={dismissedIdSet}
          onDismissThread={handleDismissThread}
          gmailRepliedThreadIds={digestRepliedThreadIds}
          dashboardSelected={dashboardSelected}
          onSelectDashboard={handleSelectDashboard}
          dashboardClusters={dashboardClusters}
          onPinToDashboard={handlePinToDashboard}
          selectedClusterIds={selectedClusterIds}
          onToggleClusterFilter={handleToggleClusterFilter}
        />
        {digestSelected ? (
          <DigestView
            digest={currentDigest}
            categories={digestCategories}
            generating={digestGenerating}
            claudeConfigured={claudeAvailable}
            onRegenerate={handleGenerateDigest}
            onOpenSettings={() => setSettingsOpen(true)}
            onSelectGmailThread={handleDigestSelectGmail}
            onSelectImessageConversation={handleDigestSelectImessage}
            conversations={conversations}
            repliedThreadIds={digestRepliedThreadIds}
            dismissedThreadIds={dismissedIdSet}
            onDismissThread={handleDismissThread}
            gmailThreads={gmailThreads}
          />
        ) : activeSource === 'gmail' ? (
          <GmailThreadView
            threadId={selectedGmailThreadId}
            onReplySent={() => {
              if (selectedGmailThreadId) {
                setDigestRepliedThreadIds(prev => new Set([...prev, selectedGmailThreadId]));
              }
              // Delay re-fetch so Gmail API indexes the sent message
              setTimeout(() => loadGmailThreads(), 2000);
            }}
            contactTags={selectedGmailTags}
            cameFromDigest={cameFromDigest}
            onBackToDigest={handleSelectDigest}
            onDismissThread={handleDismissThread}
            isDismissed={selectedGmailThreadId ? dismissedIdSet.has(selectedGmailThreadId) : false}
            gmailThreads={gmailThreads}
            claudeAvailable={claudeAvailable}
          />
        ) : activeSource === 'instagram' && selectedInstagramConversation ? (
          <InstagramThreadView
            conversation={selectedInstagramConversation}
            onSendMessage={handleInstagramSend}
            contactTags={selectedInstagramTags}
            claudeAvailable={claudeAvailable}
            onDismissThread={handleDismissThread}
            isDismissed={dismissedIdSet.has(selectedInstagramConversation.id)}
          />
        ) : activeSource === 'imessage' && selectedConversation ? (
          <ThreadView
            conversation={selectedConversation}
            onMessageSent={loadConversations}
            contactTags={selectedImessageTags}
            claudeAvailable={claudeAvailable}
            cameFromDigest={cameFromDigest}
            onBackToDigest={handleSelectDigest}
            onDismissThread={handleDismissThread}
            isDismissed={selectedImessageId ? dismissedIdSet.has(String(selectedImessageId)) : false}
          />
        ) : (
          <PinnedDashboard
            conversations={conversations}
            gmailThreads={gmailThreads}
            instagramConversations={instagramConversations}
            onSelectImessage={(id: number) => { setCameFromDigest(false); handleSelectImessage(id); }}
            onSelectGmailThread={(id: string) => { setCameFromDigest(false); handleSelectGmailThread(id); }}
            onSelectInstagramConversation={(id: string) => { setCameFromDigest(false); handleSelectInstagramConversation(id); }}
            refreshKey={dashboardRefreshKey}
            onDashboardChanged={setDashboardClusters}
          />
        )}
      </div>

      {/* Feature hints tooltip */}
      {featureHints.currentHint && (
        <FeatureTooltip
          targetSelector={featureHints.currentHint.targetSelector}
          fallbackSelector={featureHints.currentHint.fallbackSelector}
          title={featureHints.currentHint.title}
          description={featureHints.currentHint.description}
          position={featureHints.currentHint.position}
          hasNext={featureHints.hasNext}
          onDismiss={featureHints.dismissAll}
          onNext={featureHints.nextHint}
          stepNumber={featureHints.stepNumber}
          totalSteps={featureHints.totalSteps}
        />
      )}

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        gmailAuth={gmailAuth}
        onGmailConnect={handleGmailConnect}
        onGmailDisconnect={handleGmailDisconnect}
        imessageConnected={permissionStatus === 'authorized'}
        onImessageOpenSettings={handleImessageOpenSettings}
        {...(INSTAGRAM_ENABLED ? {
          instagramAuth,
          onInstagramConnect: handleInstagramConnect,
          onInstagramConnect2FA: handleInstagramConnect2FA,
          onInstagramDisconnect: handleInstagramDisconnect,
        } : {})}
        notificationsEnabled={notificationsEnabled}
        onNotificationsChange={handleNotificationsChange}
        customTags={customTags}
        onTagCreate={handleTagCreate}
        onTagUpdate={handleTagUpdate}
        onTagDelete={handleTagDelete}
        claudeAvailable={claudeAvailable}
        digestCategories={digestCategories}
        onDigestCategoryCreate={handleDigestCategoryCreate}
        onDigestCategoryUpdate={handleDigestCategoryUpdate}
        onDigestCategoryDelete={handleDigestCategoryDelete}
        digestAutoEnabled={digestAutoEnabled}
        digestAutoTime={digestAutoTime}
        digestFrequency={digestFrequency}
        digestLookbackDays={digestLookbackDays}
        digestIntervalHours={digestIntervalHours}
        digestWeekday={digestWeekday}
        onDigestAutoSettingsChange={handleDigestAutoSettingsChange}
        appName={appName}
      />
    </div>
  );
}
