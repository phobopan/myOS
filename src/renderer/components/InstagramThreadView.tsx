import { memo, useState, useEffect, useRef } from 'react';
import type { InstagramConversation, InstagramMessage as InstagramMessageType, Tag } from '../types';
import { InstagramMessage } from './InstagramMessage';
import { CountdownBadge } from './CountdownBadge';
import { InstagramComposer } from './InstagramComposer';
import { TagDots } from './TagBadge';

function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) {
    const millions = count / 1_000_000;
    return millions >= 10 ? `${Math.floor(millions)}M` : `${millions.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    const thousands = count / 1_000;
    return thousands >= 10 ? `${Math.floor(thousands)}K` : `${thousands.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toString();
}

function InstagramIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    </div>
  );
}

interface InstagramThreadViewProps {
  conversation: InstagramConversation;
  onSendMessage?: (recipientId: string, text: string) => Promise<void>;
  contactTags?: Tag[];
  claudeAvailable?: boolean;
  onDismissThread?: (id: string, source: 'imessage' | 'gmail' | 'instagram', activityKey: string) => void;
  isDismissed?: boolean;
}

export const InstagramThreadView = memo(function InstagramThreadView({ conversation, onSendMessage, contactTags = [], claudeAvailable = false, onDismissThread, isDismissed = false }: InstagramThreadViewProps) {
  const [messages, setMessages] = useState<InstagramMessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(true);

  const { id, recipientUsername, recipientName, windowStatus, isGroup, threadTitle, users } = conversation;

  // Build display name - similar to sidebar logic
  let displayName: string;
  if (isGroup) {
    if (threadTitle) {
      displayName = threadTitle;
    } else if (users && users.length > 0) {
      const usernames = users.map(u => u.fullName || `@${u.username}`);
      if (usernames.length <= 3) {
        displayName = usernames.join(', ');
      } else {
        const shown = usernames.slice(0, 2).join(', ');
        const remaining = usernames.length - 2;
        displayName = `${shown} +${remaining}`;
      }
    } else {
      displayName = 'Group Chat';
    }
  } else {
    displayName = recipientName || `@${recipientUsername}`;
  }

  useEffect(() => {
    initialLoadRef.current = true;
    setMessages([]);
    setHasMore(true);
    setFollowerCount(null);
    loadMessages();
  }, [id]);

  useEffect(() => {
    // Only scroll to bottom on initial load
    if (initialLoadRef.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      initialLoadRef.current = false;
    }
  }, [messages]);

  async function loadMessages() {
    setLoading(true);
    setError(null);
    try {
      const thread = await window.electron.instagram.getThread(id, 30);
      // Messages come newest first, reverse for display (oldest at top)
      setMessages(thread.messages.reverse());
      setHasMore(thread.messages.length >= 30);
      // Set follower count from thread info (only fetched for direct DMs)
      if (thread.participant?.followerCount != null) {
        setFollowerCount(thread.participant.followerCount);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load messages';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreMessages() {
    if (loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    try {
      // Load more messages (older ones)
      const moreCount = messages.length + 30;
      const allMsgs = await window.electron.instagram.getMessages(id, moreCount);

      // If we got the same number or fewer, no more messages
      if (allMsgs.length <= messages.length) {
        setHasMore(false);
      } else {
        // Preserve scroll position
        const container = messagesContainerRef.current;
        const scrollHeightBefore = container?.scrollHeight || 0;

        setMessages(allMsgs.reverse());

        // After state update, restore scroll position
        setTimeout(() => {
          if (container) {
            const scrollHeightAfter = container.scrollHeight;
            container.scrollTop = scrollHeightAfter - scrollHeightBefore;
          }
        }, 0);
      }
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const target = e.target as HTMLDivElement;
    // Load more when scrolled near top
    if (target.scrollTop < 100 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  }

  return (
    <main className="flex-1 min-w-0 h-full flex flex-col p-4 overflow-hidden">
      <div className="widget-bubble-large flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <InstagramIcon />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{displayName}</span>
                {contactTags.length > 0 && (
                  <TagDots tags={contactTags} maxVisible={4} />
                )}
                {isGroup && (
                  <span className="text-white/40 text-xs">Group</span>
                )}
              </div>
              {!isGroup && followerCount != null && (
                <span className="text-white/40 text-xs">
                  {formatFollowerCount(followerCount)} followers
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CountdownBadge windowStatus={windowStatus} />
            {onDismissThread && (
              <button
                onClick={() => {
                  const activityKey = new Date(conversation.updatedTime).toISOString();
                  onDismissThread(conversation.id, 'instagram', activityKey);
                }}
                className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isDismissed
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/10 text-white/60 hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isDismissed ? 'Done' : 'Mark as Done'}
              </button>
            )}
            <button
              onClick={() => window.electron.shell.openExternal(`https://www.instagram.com/direct/t/${id}/`)}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
              title="Open in Instagram"
            >
              Open ↗
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/50">Loading messages...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-400">{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/50">No messages</p>
            </div>
          ) : (
            <>
              {/* Load more indicator */}
              {loadingMore && (
                <div className="flex items-center justify-center py-2">
                  <p className="text-white/50 text-sm">Loading more...</p>
                </div>
              )}
              {!hasMore && messages.length > 30 && (
                <div className="flex items-center justify-center py-2">
                  <p className="text-white/30 text-xs">Beginning of conversation</p>
                </div>
              )}
              {messages.map((msg) => (
                <InstagramMessage key={msg.id} message={msg} threadId={id} isGroup={isGroup} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Footer: Composer handles both active and expired states */}
        <InstagramComposer
          threadId={id}
          windowStatus={windowStatus}
          onSend={async (threadId, text) => {
            if (onSendMessage) {
              await onSendMessage(threadId, text);
              // Refresh messages after send
              loadMessages();
            }
          }}
          claudeAvailable={claudeAvailable}
          messages={messages.slice(-20).map(m => ({
            sender: m.fromUser ? (m.from?.name || m.from?.username || 'Them') : 'Me',
            text: m.text || '',
          })).filter(m => m.text)}
          contactName={displayName}
        />
      </div>
    </main>
  );
});
