import type { IMessageConversation, GmailThread, InstagramConversation } from '../types';
import { CountdownBadge } from './CountdownBadge';

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
}

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
}

export function Sidebar({
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
}: SidebarProps) {
  // Build unified message list
  const unifiedMessages: UnifiedMessage[] = [];

  // Add iMessage conversations
  for (const conv of conversations) {
    // Priority: contactName > displayName > first participant > handleId > 'Unknown'
    const name = conv.contactName || conv.displayName || conv.participants?.[0] || conv.handleId || 'Unknown';
    unifiedMessages.push({
      id: `imessage-${conv.id}`,
      source: 'imessage',
      name,
      preview: conv.lastMessage || '',
      date: new Date(conv.lastMessageDate),
      imessageId: conv.id,
    });
  }

  // Add Gmail threads
  for (const thread of gmailThreads) {
    const lastMsg = thread.messages[thread.messages.length - 1];
    const fromMatch = lastMsg?.from?.match(/^([^<]+)</);
    const senderName = fromMatch ? fromMatch[1].trim() : lastMsg?.from || 'Unknown';

    unifiedMessages.push({
      id: `gmail-${thread.id}`,
      source: 'gmail',
      name: senderName,
      preview: lastMsg?.snippet || thread.messages[0]?.subject || '',
      date: new Date(lastMsg?.date || Date.now()),
      gmailThreadId: thread.id,
    });
  }

  // Add Instagram conversations
  for (const conv of instagramConversations) {
    const name = conv.recipientName || `@${conv.recipientUsername}`;
    unifiedMessages.push({
      id: `instagram-${conv.id}`,
      source: 'instagram',
      name,
      preview: conv.lastMessage?.text || '',
      date: new Date(conv.updatedTime),
      instagramConversationId: conv.id,
      instagramWindowStatus: conv.windowStatus,
    });
  }

  // Sort by date (most recent first)
  unifiedMessages.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Filter by source
  const filteredMessages = filter === 'all'
    ? unifiedMessages
    : unifiedMessages.filter(m => m.source === filter);

  return (
    <aside className="w-80 flex-shrink-0 h-full flex flex-col border-r border-white/10">
      {/* Filter Pills */}
      <div className="p-2 border-b border-white/10">
        <div className="flex gap-1 flex-wrap">
          <FilterPill label="All" active={filter === 'all'} onClick={() => onFilterChange('all')} />
          <FilterPill label="iMessage" active={filter === 'imessage'} onClick={() => onFilterChange('imessage')} />
          <FilterPill
            label="Gmail"
            active={filter === 'gmail'}
            onClick={() => onFilterChange('gmail')}
            disabled={!gmailConnected}
          />
          <FilterPill
            label="Instagram"
            active={filter === 'instagram'}
            onClick={() => onFilterChange('instagram')}
            disabled={!instagramConnected}
          />
        </div>
      </div>

      {/* Unified Message List */}
      <div className="flex-1 overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-white/40 text-sm">
            No messages
          </div>
        ) : (
          filteredMessages.map(msg => {
            const isSelected =
              (msg.source === 'imessage' && msg.imessageId === selectedImessageId) ||
              (msg.source === 'gmail' && msg.gmailThreadId === selectedGmailThreadId) ||
              (msg.source === 'instagram' && msg.instagramConversationId === selectedInstagramConversationId);

            const isExpired = msg.source === 'instagram' && msg.instagramWindowStatus?.urgency === 'expired';

            return (
              <button
                key={msg.id}
                onClick={() => {
                  if (msg.source === 'imessage' && msg.imessageId) {
                    onSelectImessage(msg.imessageId);
                  } else if (msg.source === 'gmail' && msg.gmailThreadId) {
                    onSelectGmailThread(msg.gmailThreadId);
                  } else if (msg.source === 'instagram' && msg.instagramConversationId) {
                    onSelectInstagramConversation(msg.instagramConversationId);
                  }
                }}
                className={`w-full p-3 text-left border-b border-white/5 transition-colors ${
                  isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                } ${isExpired ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <SourceIcon source={msg.source} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white truncate">{msg.name}</span>
                      {msg.source === 'instagram' && msg.instagramWindowStatus ? (
                        <CountdownBadge windowStatus={msg.instagramWindowStatus} compact />
                      ) : (
                        <span className="text-xs text-white/40 flex-shrink-0">
                          {formatDate(msg.date)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-white/50 truncate mt-0.5">{msg.preview}</div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

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

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
