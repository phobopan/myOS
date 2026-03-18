import { useState, memo, useMemo } from 'react';
import type { IMessageConversation, GmailThread, InstagramConversation, Tag, ContactTagAssignment, ContactIdentifier, Cluster } from '../types';
import { CountdownBadge } from './CountdownBadge';
import { TagFilterPills } from './TagFilterPills';
import { TagDots } from './TagBadge';
import { TagAssignmentPopover } from './TagAssignmentPopover';

type SourceFilter = 'all' | 'imessage' | 'gmail' | 'instagram';

interface UnifiedMessage {
  id: string;
  source: 'imessage' | 'gmail' | 'instagram';
  name: string;
  preview: string;
  date: Date;
  // Original data for selection
  imessageId?: number;
  gmailThreadId?: string;
  instagramConversationId?: string;
  // Instagram-specific
  instagramWindowStatus?: InstagramConversation['windowStatus'];
  // Contact identifier for tag lookup
  contactIdentifier?: string;
  // Resolved tags for this contact
  contactTags?: Tag[];
  // Activity key for dismiss tracking
  activityKey?: string;
  // Gmail label IDs for priority scoring
  gmailLabelIds?: string[];
}

type SortMode = 'recent' | 'priority';

interface SidebarProps {
  filter: SourceFilter;
  onFilterChange: (filter: SourceFilter) => void;
  gmailConnected: boolean;
  instagramConnected: boolean;
  conversations: IMessageConversation[];
  gmailThreads: GmailThread[];
  instagramConversations: InstagramConversation[];
  selectedImessageId: number | null;
  selectedGmailThreadId: string | null;
  selectedInstagramConversationId: string | null;
  onSelectImessage: (id: number) => void;
  onSelectGmailThread: (id: string) => void;
  onSelectInstagramConversation: (id: string) => void;
  // Pagination
  gmailHasMore: boolean;
  gmailLoadingMore: boolean;
  onLoadMoreGmail: () => void;
  instagramHasMore: boolean;
  instagramLoadingMore: boolean;
  onLoadMoreInstagram: () => void;
  // Tags
  tags?: Tag[];
  tagAssignments?: ContactTagAssignment[];
  selectedTagIds?: string[];
  onToggleTagFilter?: (tagId: string) => void;
  onClearTagFilters?: () => void;
  onTagAssign?: (contact: ContactIdentifier, tagIds: string[], displayName: string) => Promise<void>;
  // Digest
  digestSelected?: boolean;
  onSelectDigest?: () => void;
  lastDigestTime?: Date | null;
  digestGenerating?: boolean;
  // Dismissed threads
  dismissedIds?: Set<string>;
  onDismissThread?: (id: string, source: 'imessage' | 'gmail' | 'instagram', activityKey: string) => void;
  // Gmail user email for filtering replied threads
  // Threads the user has replied to (for immediate sidebar removal)
  gmailRepliedThreadIds?: Set<string>;
  // Dashboard
  dashboardSelected?: boolean;
  onSelectDashboard?: () => void;
  dashboardClusters?: Cluster[];
  onPinToDashboard?: (source: 'imessage' | 'gmail' | 'instagram', id: string, clusterId?: string) => void;
  // Cluster filters
  selectedClusterIds?: string[];
  onToggleClusterFilter?: (clusterId: string) => void;
}

export const Sidebar = memo(function Sidebar({
  filter,
  onFilterChange,
  gmailConnected,
  instagramConnected,
  conversations,
  gmailThreads,
  instagramConversations,
  selectedImessageId,
  selectedGmailThreadId,
  selectedInstagramConversationId,
  onSelectImessage,
  onSelectGmailThread,
  onSelectInstagramConversation,
  gmailHasMore,
  gmailLoadingMore,
  onLoadMoreGmail,
  instagramHasMore,
  instagramLoadingMore,
  onLoadMoreInstagram,
  tags = [],
  tagAssignments = [],
  selectedTagIds = [],
  onToggleTagFilter,
  onClearTagFilters,
  onTagAssign,
  digestSelected = false,
  onSelectDigest,
  lastDigestTime,
  digestGenerating = false,
  dismissedIds = new Set(),
  onDismissThread,
  gmailRepliedThreadIds = new Set(),
  dashboardSelected = false,
  onSelectDashboard,
  dashboardClusters = [],
  onPinToDashboard,
  selectedClusterIds = [],
  onToggleClusterFilter,
}: SidebarProps) {
  // Sort mode state
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  // Inbox mode: "needs-reply" shows only unanswered, "all" shows everything
  const [inboxMode, setInboxMode] = useState<'needs-reply' | 'all'>('needs-reply');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    message: UnifiedMessage | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    message: null,
  });

  // Tag assignment popover state
  const [tagPopover, setTagPopover] = useState<{
    isOpen: boolean;
    contact: ContactIdentifier | null;
    displayName: string;
    currentTagIds: string[];
    position: { x: number; y: number };
  }>({
    isOpen: false,
    contact: null,
    displayName: '',
    currentTagIds: [],
    position: { x: 0, y: 0 },
  });
  // Handle scroll to load more
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;

    if (nearBottom) {
      // Determine which sources need more data based on current filter
      if ((filter === 'all' || filter === 'gmail') && gmailHasMore && !gmailLoadingMore) {
        onLoadMoreGmail();
      }
      if ((filter === 'all' || filter === 'instagram') && instagramHasMore && !instagramLoadingMore) {
        onLoadMoreInstagram();
      }
    }
  };

  // Helper to get tags for a contact
  const getContactTags = (platform: 'imessage' | 'gmail' | 'instagram', identifier: string): Tag[] => {
    const assignment = tagAssignments.find(
      a => a.contact.platform === platform && a.contact.identifier === identifier
    );
    if (!assignment) return [];
    return assignment.tagIds
      .map(id => tags.find(t => t.id === id))
      .filter((t): t is Tag => t !== undefined);
  };

  // Build unified message list (memoized to avoid recomputation on every render)
  const filteredMessages = useMemo(() => {
  const unifiedMessages: UnifiedMessage[] = [];

  // Add iMessage conversations
  for (const conv of conversations) {
    // In "needs-reply" mode, skip conversations where the last message is from me
    if (inboxMode === 'needs-reply' && conv.isFromMe) continue;

    let name: string;
    if (conv.contactName) {
      // Direct message with resolved contact
      name = conv.contactName;
    } else if (conv.displayName) {
      // Named group chat
      name = conv.displayName;
    } else if (conv.isGroup && conv.participants && conv.participants.length > 0) {
      // Unnamed group chat - show participants
      if (conv.participants.length <= 2) {
        name = conv.participants.join(', ');
      } else {
        const shown = conv.participants.slice(0, 2).join(', ');
        const remaining = conv.participants.length - 2;
        name = `${shown} +${remaining}`;
      }
    } else {
      // Fallback to handleId
      name = conv.handleId || 'Unknown';
    }

    // Use handleId or chatIdentifier as the contact identifier
    const contactId = conv.handleId || conv.chatIdentifier || '';

    // Determine preview: show placeholder for attachment-only messages
    let imessagePreview = conv.lastMessage || '';
    if (!imessagePreview && conv.hasAttachments) {
      imessagePreview = describeAttachment(conv.attachmentType);
    }

    unifiedMessages.push({
      id: `imessage-${conv.id}`,
      source: 'imessage',
      name,
      preview: imessagePreview,
      date: new Date(conv.lastMessageDate),
      imessageId: conv.id,
      contactIdentifier: contactId,
      contactTags: getContactTags('imessage', contactId),
      activityKey: new Date(conv.lastMessageDate).toISOString(),
    });
  }

  // Add Gmail threads
  for (const thread of gmailThreads) {
    const lastMsg = thread.messages[thread.messages.length - 1];

    // In "needs-reply" mode, skip threads where the last message is from me
    if (inboxMode === 'needs-reply' && lastMsg?.labelIds?.includes('SENT')) {
      continue;
    }

    // Skip threads the user just replied to (immediate removal before API catches up)
    if (gmailRepliedThreadIds.has(thread.id)) {
      continue;
    }

    const fromMatch = lastMsg?.from?.match(/^([^<]+)</);
    const senderName = fromMatch ? fromMatch[1].trim() : lastMsg?.from || 'Unknown';

    // Extract email from 'from' field for tag lookup
    const emailMatch = lastMsg?.from?.match(/<([^>]+)>/);
    const email = emailMatch ? emailMatch[1] : lastMsg?.from || '';

    unifiedMessages.push({
      id: `gmail-${thread.id}`,
      source: 'gmail',
      name: thread.messages[0]?.subject || lastMsg?.subject || 'No Subject',
      preview: senderName,
      date: new Date(lastMsg?.date || Date.now()),
      gmailThreadId: thread.id,
      contactIdentifier: email,
      contactTags: getContactTags('gmail', email),
      activityKey: lastMsg?.id || '',
      gmailLabelIds: lastMsg?.labelIds || [],
    });
  }

  // Add Instagram conversations
  for (const conv of instagramConversations) {
    // In "needs-reply" mode, skip if last message was from me
    if (inboxMode === 'needs-reply' && conv.lastMessage && !conv.lastMessage.fromUser) {
      continue;
    }

    // Build name similar to iMessage group handling
    let name: string;
    if (conv.isGroup) {
      // Group chat - use thread title if available, otherwise show participants
      if (conv.threadTitle) {
        name = conv.threadTitle;
      } else if (conv.users && conv.users.length > 0) {
        const otherUsers = conv.users.filter(u => u.id !== conv.recipientId);
        const usernames = otherUsers.map(u => u.fullName || `@${u.username}`);
        if (usernames.length <= 2) {
          name = usernames.join(', ');
        } else {
          const shown = usernames.slice(0, 2).join(', ');
          const remaining = usernames.length - 2;
          name = `${shown} +${remaining}`;
        }
      } else {
        name = 'Group Chat';
      }
    } else {
      // Direct message
      name = conv.recipientName || `@${conv.recipientUsername}`;
    }

    const instagramPreview = conv.lastMessage?.text || '';

    unifiedMessages.push({
      id: `instagram-${conv.id}`,
      source: 'instagram',
      name,
      preview: instagramPreview,
      date: new Date(conv.updatedTime),
      instagramConversationId: conv.id,
      instagramWindowStatus: conv.windowStatus,
      contactIdentifier: conv.recipientId,
      contactTags: getContactTags('instagram', conv.recipientId),
      activityKey: new Date(conv.updatedTime).toISOString(),
    });
  }

  // Sort messages
  if (sortMode === 'priority') {
    unifiedMessages.sort((a, b) => {
      const scoreA = computePriorityScore(a);
      const scoreB = computePriorityScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.date.getTime() - a.date.getTime();
    });
  } else {
    unifiedMessages.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // Filter by source
  let result = filter === 'all'
    ? unifiedMessages
    : unifiedMessages.filter(m => m.source === filter);

  // Filter by tags (OR logic - show if contact has ANY of the selected tags)
  if (selectedTagIds.length > 0) {
    result = result.filter(m => {
      const msgTagIds = m.contactTags?.map(t => t.id) || [];
      return selectedTagIds.some(tagId => msgTagIds.includes(tagId));
    });
  }

  // Filter by cluster membership (OR logic)
  if (selectedClusterIds.length > 0 && dashboardClusters.length > 0) {
    const clusterPinIds = new Set<string>();
    for (const cId of selectedClusterIds) {
      const cluster = dashboardClusters.find(c => c.id === cId);
      if (cluster) {
        for (const pin of cluster.pins) {
          clusterPinIds.add(`${pin.source}-${pin.id}`);
        }
      }
    }
    result = result.filter(m => {
      const msgPinId = m.source === 'imessage' ? `imessage-${m.imessageId}` :
                       m.source === 'gmail' ? `gmail-${m.gmailThreadId}` :
                       `instagram-${m.instagramConversationId}`;
      return clusterPinIds.has(msgPinId);
    });
  }

  // Filter out dismissed threads
  if (dismissedIds.size > 0) {
    result = result.filter(m => {
      const threadId = m.source === 'imessage' ? String(m.imessageId) :
                       m.source === 'gmail' ? m.gmailThreadId :
                       m.instagramConversationId;
      return !threadId || !dismissedIds.has(threadId);
    });
  }

  return result;
  }, [conversations, gmailThreads, instagramConversations, inboxMode, sortMode, filter, selectedTagIds, selectedClusterIds, dashboardClusters, dismissedIds, gmailRepliedThreadIds, tags, tagAssignments]);

  return (
    <aside className="w-80 flex-shrink-0 h-full flex flex-col border-r border-white/10">
      {/* Filter Pills */}
      <div className="p-2 border-b border-white/10" data-hint="source-filter">
        <div className="flex items-center gap-1 flex-wrap">
          <FilterPill label="All" active={filter === 'all'} onClick={() => onFilterChange('all')} />
          <FilterPill label="iMessage" active={filter === 'imessage'} onClick={() => onFilterChange('imessage')} />
          <FilterPill
            label="Gmail"
            active={filter === 'gmail'}
            onClick={() => onFilterChange('gmail')}
            disabled={!gmailConnected}
          />
          {/* Instagram filter hidden — not supported in this version */}
          {/* Tag Filter Dropdown */}
          {(tags.length > 0 || dashboardClusters.length > 0) && onToggleTagFilter && onClearTagFilters && (
            <>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <TagFilterPills
                tags={tags}
                selectedTagIds={selectedTagIds}
                onToggleTag={onToggleTagFilter}
                clusters={dashboardClusters}
                selectedClusterIds={selectedClusterIds}
                onToggleCluster={onToggleClusterFilter}
                onClearAll={onClearTagFilters}
              />
            </>
          )}
        </div>
      </div>

      {/* Sort + Inbox Mode Toggle */}
      <div className="px-2 py-1.5 border-b border-white/10 flex items-center gap-1">
        <button
          onClick={() => setSortMode('recent')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
            sortMode === 'recent'
              ? 'bg-white/20 text-white'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recent
        </button>
        <button
          onClick={() => setSortMode('priority')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
            sortMode === 'priority'
              ? 'bg-white/20 text-white'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Priority
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          onClick={() => setInboxMode('needs-reply')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            inboxMode === 'needs-reply'
              ? 'bg-white/20 text-white'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          }`}
        >
          Unreplied
        </button>
        <button
          onClick={() => setInboxMode('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            inboxMode === 'all'
              ? 'bg-white/20 text-white'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          }`}
        >
          All
        </button>
      </div>

      {/* Dashboard Home Button */}
      {onSelectDashboard && (
        <button
          onClick={onSelectDashboard}
          className={`w-full p-3 text-left border-b border-white/10 transition-colors flex items-center gap-3 ${
            dashboardSelected ? 'bg-white/10' : 'hover:bg-white/5'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
              <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white text-sm">Dashboard</div>
            <div className="text-xs text-white/40">Pinned conversations</div>
          </div>
        </button>
      )}

      {/* Daily Digest Entry */}
      {onSelectDigest && (
        <button
          onClick={onSelectDigest}
          data-hint="digest-button"
          className={`w-full p-3 text-left border-b border-white/10 transition-colors flex items-center gap-3 ${
            digestSelected ? 'bg-white/10' : 'hover:bg-white/5'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white flex-shrink-0">
            {digestGenerating ? (
              <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white text-sm">Daily Digest</div>
            <div className="text-xs text-white/40">
              {digestGenerating
                ? 'Generating...'
                : lastDigestTime
                ? `Updated ${formatDate(new Date(lastDigestTime))}`
                : 'Not generated yet'}
            </div>
          </div>
        </button>
      )}

      {/* Unified Message List */}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-white/40 text-sm">
            No messages
          </div>
        ) : (
          <>
          {filteredMessages.map((msg, msgIndex) => {
            const isSelected =
              (msg.source === 'imessage' && msg.imessageId === selectedImessageId) ||
              (msg.source === 'gmail' && msg.gmailThreadId === selectedGmailThreadId) ||
              (msg.source === 'instagram' && msg.instagramConversationId === selectedInstagramConversationId);

            return (
              <button
                key={msg.id}
                {...(msgIndex === 0 ? { 'data-hint': 'conversation-item' } : {})}
                onClick={() => {
                  if (msg.source === 'imessage' && msg.imessageId) {
                    onSelectImessage(msg.imessageId);
                  } else if (msg.source === 'gmail' && msg.gmailThreadId) {
                    onSelectGmailThread(msg.gmailThreadId);
                  } else if (msg.source === 'instagram' && msg.instagramConversationId) {
                    onSelectInstagramConversation(msg.instagramConversationId);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    isOpen: true,
                    position: { x: e.clientX, y: e.clientY },
                    message: msg,
                  });
                }}
                className={`w-full p-3 text-left border-b border-white/5 transition-colors ${
                  isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  <SourceIcon source={msg.source} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-white truncate">{msg.name}</span>
                        {msg.contactTags && msg.contactTags.length > 0 && (
                          <TagDots tags={msg.contactTags} maxVisible={2} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {msg.source === 'instagram' && msg.instagramWindowStatus && (
                          <CountdownBadge windowStatus={msg.instagramWindowStatus} compact />
                        )}
                        <span className="text-xs text-white/40">
                          {formatDate(msg.date)}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-white/50 truncate mt-0.5">{msg.preview}</div>
                  </div>
                </div>
              </button>
            );
          })}
          {/* Loading indicator */}
          {(gmailLoadingMore || instagramLoadingMore) && (
            <div className="flex items-center justify-center py-3 text-white/40 text-sm">
              Loading more...
            </div>
          )}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.isOpen && contextMenu.message && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(prev => ({ ...prev, isOpen: false }))} />
          <div
            className="fixed z-50 bg-[#2a2a2e] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.position.x, top: contextMenu.position.y }}
          >
            {onDismissThread && contextMenu.message.activityKey && (
              <button
                onClick={() => {
                  const msg = contextMenu.message!;
                  const threadId = msg.source === 'imessage' ? String(msg.imessageId) :
                                   msg.source === 'gmail' ? msg.gmailThreadId :
                                   msg.instagramConversationId;
                  if (threadId && msg.activityKey) {
                    onDismissThread(threadId, msg.source, msg.activityKey);
                  }
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Mark as Done
              </button>
            )}
            {contextMenu.message.contactIdentifier && onTagAssign && (
              <button
                onClick={() => {
                  const msg = contextMenu.message!;
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                  setTagPopover({
                    isOpen: true,
                    contact: { platform: msg.source, identifier: msg.contactIdentifier! },
                    displayName: msg.name,
                    currentTagIds: msg.contactTags?.map(t => t.id) || [],
                    position: contextMenu.position,
                  });
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Assign Tag...
              </button>
            )}
            {onPinToDashboard && (
              <>
                <div className="border-t border-white/10 my-0.5" />
                <button
                  onClick={() => {
                    const msg = contextMenu.message!;
                    const id = msg.source === 'imessage' ? String(msg.imessageId) :
                               msg.source === 'gmail' ? msg.gmailThreadId! :
                               msg.instagramConversationId!;
                    onPinToDashboard(msg.source, id);
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Pin to Dashboard
                </button>
                {dashboardClusters.length > 0 && (
                  <>
                    {dashboardClusters.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          const msg = contextMenu.message!;
                          const id = msg.source === 'imessage' ? String(msg.imessageId) :
                                     msg.source === 'gmail' ? msg.gmailThreadId! :
                                     msg.instagramConversationId!;
                          onPinToDashboard(msg.source, id, c.id);
                          setContextMenu(prev => ({ ...prev, isOpen: false }));
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2 pl-6"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Tag Assignment Popover */}
      {tagPopover.contact && onTagAssign && (
        <TagAssignmentPopover
          isOpen={tagPopover.isOpen}
          onClose={() => setTagPopover(prev => ({ ...prev, isOpen: false }))}
          tags={tags}
          contact={tagPopover.contact}
          displayName={tagPopover.displayName}
          currentTagIds={tagPopover.currentTagIds}
          onSave={onTagAssign}
          anchorPosition={tagPopover.position}
        />
      )}
    </aside>
  );
});

function FilterPill({
  label,
  active,
  onClick,
  disabled = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-white/20 text-white'
          : disabled
          ? 'text-white/20 cursor-not-allowed'
          : 'text-white/50 hover:text-white/70 hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );
}

function SourceIcon({ source }: { source: 'imessage' | 'gmail' | 'instagram' }) {
  const colors = {
    imessage: 'bg-green-500',
    gmail: 'bg-red-500',
    instagram: 'bg-gradient-to-br from-purple-500 to-pink-500',
  };

  const icons = {
    imessage: (
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    ),
    gmail: (
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
      </svg>
    ),
    instagram: (
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z"/>
      </svg>
    ),
  };

  return (
    <div className={`w-5 h-5 rounded-full ${colors[source]} flex items-center justify-center text-white flex-shrink-0`}>
      {icons[source]}
    </div>
  );
}

const URGENCY_KEYWORDS = /\b(urgent|asap|deadline|help|emergency|important|tomorrow|today)\b|[!?]/gi;

function computePriorityScore(msg: UnifiedMessage): number {
  // Tag importance: 0-10, weight 3x
  const tagScore = msg.contactTags && msg.contactTags.length > 0
    ? Math.max(...msg.contactTags.map(t => t.importance ?? 0))
    : 0;

  // Wait time: hours since message, mapped to 0-10, weight 2x
  const hoursOld = (Date.now() - msg.date.getTime()) / (1000 * 60 * 60);
  let waitScore: number;
  if (hoursOld <= 6) waitScore = hoursOld / 6;         // 0-1
  else if (hoursOld <= 24) waitScore = 1 + (hoursOld - 6) / 6;  // 1-4
  else if (hoursOld <= 48) waitScore = 4 + (hoursOld - 24) / 6; // 4-8
  else if (hoursOld <= 72) waitScore = 8 + (hoursOld - 48) / 12; // 8-10
  else waitScore = 10;
  waitScore = Math.min(waitScore, 10);

  // Keyword urgency: 0-5, weight 1.5x
  const keywordMatches = msg.preview.match(URGENCY_KEYWORDS);
  const keywordScore = keywordMatches ? Math.min(keywordMatches.length, 5) : 0;

  // Instagram window pressure: 0-3, weight 1x
  let instagramScore = 0;
  if (msg.source === 'instagram' && msg.instagramWindowStatus) {
    const urgency = msg.instagramWindowStatus.urgency;
    if (urgency === 'warning') instagramScore = 3;
    else if (urgency === 'normal') instagramScore = 1;
  }

  // Gmail labels: 0-3, weight 1x
  let gmailScore = 0;
  if (msg.source === 'gmail' && msg.gmailLabelIds) {
    if (msg.gmailLabelIds.includes('IMPORTANT')) gmailScore += 2;
    if (msg.gmailLabelIds.includes('STARRED')) gmailScore += 1;
  }

  return tagScore * 3 + waitScore * 2 + keywordScore * 1.5 + instagramScore + gmailScore;
}

function describeAttachment(mimeType?: string | null): string {
  if (!mimeType) return 'Sent an attachment';
  if (mimeType.startsWith('image/')) return 'Sent a photo';
  if (mimeType.startsWith('video/')) return 'Sent a video';
  if (mimeType.startsWith('audio/')) return 'Sent an audio message';
  if (mimeType === 'application/pdf') return 'Sent a PDF';
  if (mimeType.startsWith('text/')) return 'Sent a file';
  return 'Sent an attachment';
}

function formatDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today: show exact time
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    // Yesterday
    return 'Yesterday';
  } else if (diffDays < 7) {
    // This week: show day name
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    // Older than a week: show date like 1/17/26
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  }
}
