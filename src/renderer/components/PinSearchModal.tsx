import { useState, useMemo, useEffect } from 'react';
import type { IMessageConversation, GmailThread, InstagramConversation, Cluster } from '../types';

interface SearchItem {
  source: 'imessage' | 'gmail' | 'instagram';
  id: string;
  name: string;
  preview: string;
}

interface PinSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: IMessageConversation[];
  gmailThreads: GmailThread[];
  instagramConversations: InstagramConversation[];
  clusters: Cluster[];
  pinnedIds: Set<string>; // Already-pinned "source-id" keys
  onPin: (source: 'imessage' | 'gmail' | 'instagram', id: string, clusterId?: string) => void;
  defaultClusterId?: string; // Pre-select a cluster (e.g. when opened from cluster + button)
}

export function PinSearchModal({
  isOpen,
  onClose,
  conversations,
  gmailThreads,
  instagramConversations,
  clusters,
  pinnedIds,
  onPin,
  defaultClusterId,
}: PinSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState<string | ''>(defaultClusterId || '');

  // Sync pre-selected cluster when modal opens for a different cluster
  useEffect(() => {
    if (isOpen) {
      setSelectedClusterId(defaultClusterId || '');
      setQuery('');
    }
  }, [isOpen, defaultClusterId]);

  const allItems = useMemo(() => {
    const items: SearchItem[] = [];

    for (const conv of conversations) {
      const name = conv.contactName || conv.displayName || conv.handleId || 'Unknown';
      items.push({
        source: 'imessage',
        id: String(conv.id),
        name,
        preview: conv.lastMessage || '',
      });
    }

    for (const thread of gmailThreads) {
      const lastMsg = thread.messages[thread.messages.length - 1];
      const fromMatch = lastMsg?.from?.match(/^([^<]+)/);
      const senderName = fromMatch ? fromMatch[1].trim() : lastMsg?.from || 'Unknown';
      items.push({
        source: 'gmail',
        id: thread.id,
        name: thread.messages[0]?.subject || 'No Subject',
        preview: senderName,
      });
    }

    for (const conv of instagramConversations) {
      items.push({
        source: 'instagram',
        id: conv.id,
        name: conv.recipientName || `@${conv.recipientUsername}`,
        preview: conv.lastMessage?.text || '',
      });
    }

    return items;
  }, [conversations, gmailThreads, instagramConversations]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allItems
      .filter(item => {
        // Don't show already pinned
        if (pinnedIds.has(`${item.source}-${item.id}`)) return false;
        if (!q) return true;
        return item.name.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q);
      })
      .slice(0, 30);
  }, [allItems, query, pinnedIds]);

  if (!isOpen) return null;

  const SOURCE_COLORS = { imessage: 'bg-green-500', gmail: 'bg-red-500', instagram: 'bg-purple-500' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="glass-modal relative z-10 w-[420px] max-h-[500px] flex flex-col p-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="p-3 border-b border-white/10">
          <input
            autoFocus
            type="text"
            placeholder="Search conversations to pin..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-1 focus:ring-white/30"
          />
          {/* Cluster selector */}
          {clusters.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-white/40">Pin to:</span>
              <select
                value={selectedClusterId}
                onChange={e => setSelectedClusterId(e.target.value)}
                className="bg-white/10 rounded px-2 py-1 text-xs text-white outline-none border border-white/10"
              >
                <option value="">No cluster</option>
                {clusters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-white/40 text-sm">
              {query ? 'No matches found' : 'All conversations already pinned'}
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={`${item.source}-${item.id}`}
                onClick={() => {
                  onPin(item.source, item.id, selectedClusterId || undefined);
                  // Don't close — allow pinning multiple
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SOURCE_COLORS[item.source]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{item.name}</div>
                  <div className="text-[11px] text-white/40 truncate">{item.preview}</div>
                </div>
                <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
