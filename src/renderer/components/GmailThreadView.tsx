import { memo, useState, useEffect } from 'react';
import type { GmailThread, Tag } from '../types';
import { EmailMessage } from './EmailMessage';
import { GmailComposer } from './GmailComposer';
import { TagDots } from './TagBadge';

function GmailIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
      </svg>
    </div>
  );
}

interface GmailThreadViewProps {
  threadId: string | null;
  onReplySent?: () => void;
  contactTags?: Tag[];
  cameFromDigest?: boolean;
  onBackToDigest?: () => void;
  onDismissThread?: (id: string, source: 'imessage' | 'gmail' | 'instagram', activityKey: string) => void;
  isDismissed?: boolean;
  gmailThreads?: GmailThread[];
  claudeAvailable?: boolean;
}

export const GmailThreadView = memo(function GmailThreadView({ threadId, onReplySent, contactTags = [], cameFromDigest, onBackToDigest, onDismissThread, isDismissed = false, gmailThreads = [], claudeAvailable = false }: GmailThreadViewProps) {
  const [thread, setThread] = useState<GmailThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!threadId) {
      setThread(null);
      setExpandedMessageIds(new Set());
      return;
    }

    setLoading(true);
    setError(null);

    window.electron.gmail.getThread(threadId)
      .then(t => {
        setThread(t);
        // Expand last (most recent) message by default
        if (t.messages.length > 0) {
          setExpandedMessageIds(new Set([t.messages[t.messages.length - 1].id]));
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to load thread');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [threadId]);

  const toggleExpand = (messageId: string) => {
    setExpandedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const reloadThread = async () => {
    if (!threadId) return;
    try {
      const t = await window.electron.gmail.getThread(threadId);
      setThread(t);
      // Keep last message expanded
      if (t.messages.length > 0) {
        setExpandedMessageIds(prev => {
          const next = new Set(prev);
          next.add(t.messages[t.messages.length - 1].id);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to reload thread:', err);
    }
  };

  if (!threadId) {
    return (
      <main className="flex-1 h-full flex flex-col p-4">
        <div className="widget-bubble-large flex-1 flex items-center justify-center text-white/30">
          <div className="text-center">
            <div className="text-4xl mb-3">Select an email</div>
            <p className="text-sm text-white/40">
              Choose a thread from the sidebar to view the conversation
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 h-full flex flex-col p-4 overflow-hidden">
      <div className="widget-bubble-large flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Back to digest + Header */}
        {cameFromDigest && onBackToDigest && (
          <button
            onClick={onBackToDigest}
            className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Digest
          </button>
        )}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <GmailIcon />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white truncate">
                {thread?.messages[0]?.subject || 'No Subject'}
              </h2>
              {contactTags.length > 0 && (
                <TagDots tags={contactTags} maxVisible={4} />
              )}
            </div>
            <p className="text-sm text-white/50">
              {thread?.messages.length} message{thread?.messages.length !== 1 ? 's' : ''}
            </p>
          </div>
          {onDismissThread && threadId && (
            <button
              onClick={() => {
                const t = gmailThreads.find(gt => gt.id === threadId);
                const lastMsg = t?.messages[t.messages.length - 1];
                const activityKey = lastMsg?.id || '';
                onDismissThread(threadId, 'gmail', activityKey);
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
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center text-white/40">Loading thread...</div>
          ) : error ? (
            <div className="text-center text-red-400">{error}</div>
          ) : thread ? (
            thread.messages.map((message, index) => (
              <EmailMessage
                key={message.id}
                message={message}
                isExpanded={expandedMessageIds.has(message.id)}
                onToggleExpand={() => toggleExpand(message.id)}
                isLast={index === thread.messages.length - 1}
              />
            ))
          ) : null}
        </div>

        {/* Composer */}
        {thread && thread.messages.length > 0 && (
          <GmailComposer
            thread={thread}
            lastMessage={thread.messages[thread.messages.length - 1]}
            onSent={() => {
              // Refresh thread to show sent message
              reloadThread();
              onReplySent?.();
            }}
            claudeAvailable={claudeAvailable}
          />
        )}
      </div>
    </main>
  );
});
