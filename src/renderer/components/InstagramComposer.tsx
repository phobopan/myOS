import { useState, useRef, useEffect } from 'react';
import type { InstagramWindowStatus } from '../types';

interface InstagramComposerProps {
  recipientId: string;
  windowStatus: InstagramWindowStatus;
  onSend: (recipientId: string, text: string) => Promise<void>;
}

const CHAR_LIMIT = 1000;

export function InstagramComposer({ recipientId, windowStatus, onSend }: InstagramComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isExpired = !windowStatus.isOpen || windowStatus.urgency === 'expired';
  const remaining = CHAR_LIMIT - text.length;
  const isOverLimit = remaining < 0;
  const canSend = text.trim().length > 0 && !isOverLimit && !sending && !isExpired;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  async function handleSend() {
    if (!canSend) return;

    setSending(true);
    setError(null);

    try {
      await onSend(recipientId, text.trim());
      setText('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Cmd/Ctrl + Enter to send
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  // Show "Open in Instagram" for expired windows
  if (isExpired) {
    return (
      <div className="px-4 py-3 border-t border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">24-hour messaging window has expired</p>
            <p className="text-xs text-white/30 mt-1">You can only reply within 24 hours of their last message</p>
          </div>
          <button
            onClick={() => window.electron.shell.openPath('https://instagram.com/direct/inbox')}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
            </svg>
            Open in Instagram
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-white/10">
      {error && (
        <div className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sending}
            className="w-full bg-white/10 rounded-lg px-3 py-2 pr-16 text-white placeholder-white/40 resize-none min-h-[40px] max-h-[120px] focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50"
            rows={1}
          />
          {/* Character counter */}
          <span
            className={`absolute bottom-2 right-3 text-xs ${
              isOverLimit
                ? 'text-red-400'
                : remaining < 100
                ? 'text-orange-400'
                : 'text-white/40'
            }`}
          >
            {remaining}
          </span>
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </span>
          ) : (
            'Send'
          )}
        </button>
      </div>

      <p className="text-xs text-white/30 mt-2">
        Press Cmd+Enter to send
      </p>
    </div>
  );
}
