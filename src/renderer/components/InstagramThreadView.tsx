import { useState, useEffect, useRef } from 'react';
import type { InstagramConversation, InstagramMessage as InstagramMessageType } from '../types';
import { InstagramMessage } from './InstagramMessage';
import { CountdownBadge } from './CountdownBadge';

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
}

export function InstagramThreadView({ conversation, onSendMessage }: InstagramThreadViewProps) {
  const [messages, setMessages] = useState<InstagramMessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { id, recipientId, recipientUsername, recipientName, windowStatus } = conversation;
  const isExpired = !windowStatus.isOpen || windowStatus.urgency === 'expired';

  useEffect(() => {
    loadMessages();
  }, [id]);

  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    setLoading(true);
    setError(null);
    try {
      const msgs = await window.electron.instagram.getMessages(id);
      // Messages come newest first, reverse for display (oldest at top)
      setMessages(msgs.reverse());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load messages';
      setError(message);
    } finally {
      setLoading(false);
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
              <span className="text-white font-medium">@{recipientUsername}</span>
              {recipientName && (
                <span className="text-white/50 text-sm ml-2">{recipientName}</span>
              )}
            </div>
          </div>
          <CountdownBadge windowStatus={windowStatus} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
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
              {messages.map((msg) => (
                <InstagramMessage key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Footer: Composer or Expired notice */}
        {isExpired ? (
          <div className="px-4 py-3 border-t border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/50">
                24-hour messaging window has expired
              </p>
              <button
                onClick={() => window.electron.shell.openPath('https://instagram.com/direct/inbox')}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Open in Instagram
              </button>
            </div>
          </div>
        ) : (
          <InstagramComposerPlaceholder
            recipientId={recipientId}
            onSend={onSendMessage}
          />
        )}
      </div>
    </main>
  );
}

// Placeholder composer - will be replaced by full InstagramComposer in Plan 04-04
function InstagramComposerPlaceholder({
  recipientId,
  onSend
}: {
  recipientId: string;
  onSend?: (recipientId: string, text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const charLimit = 1000;
  const remaining = charLimit - text.length;

  async function handleSend() {
    if (!text.trim() || !onSend) return;
    setSending(true);
    try {
      await onSend(recipientId, text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-4 py-3 border-t border-white/10">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, charLimit))}
          placeholder="Type a message..."
          className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 resize-none min-h-[40px] max-h-[120px] focus:outline-none focus:ring-1 focus:ring-white/30"
          rows={1}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs ${remaining < 100 ? 'text-orange-400' : 'text-white/40'}`}>
            {remaining}
          </span>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
