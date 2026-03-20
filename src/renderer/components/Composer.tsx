import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface DraftMessage {
  sender: string;
  text: string;
}

interface ComposerProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  claudeAvailable?: boolean;
  messages?: DraftMessage[];
  contactName?: string;
}

export function Composer({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  claudeAvailable = false,
  messages = [],
  contactName,
}: ComposerProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to calculate new height
      textarea.style.height = 'auto';
      // Set to scrollHeight, but cap at max height (200px = ~6 lines)
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, [message]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setMessage('');
      setHasDraft(false);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (drafting || disabled || messages.length === 0) return;

    setDrafting(true);
    setMessage('');
    const cleanup = window.electron.claude.onDraftChunk((chunk) => {
      setMessage(prev => prev + chunk);
    });
    try {
      await window.electron.claude.generateDraftStream(
        'imessage',
        messages,
        { contactName }
      );
      setMessage(prev => prev.trim());
      setHasDraft(true);
      textareaRef.current?.focus();
    } catch (err) {
      console.error('Failed to generate draft:', err);
    } finally {
      cleanup();
      setDrafting(false);
    }
  };

  const showDraftButton = claudeAvailable && messages.length > 0;

  return (
    <div className="p-4 border-t border-white/10">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={drafting ? 'AI is drafting...' : placeholder}
          disabled={disabled || sending || drafting}
          rows={1}
          className={`flex-1 bg-white/10 border rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-colors resize-none overflow-hidden disabled:opacity-50 ${
            drafting ? 'border-purple-500/50 animate-pulse' : 'border-white/10'
          }`}
          style={{ minHeight: '42px' }}
        />
        {showDraftButton && (
          <button
            onClick={handleGenerateDraft}
            disabled={drafting || disabled || sending}
            title={hasDraft ? 'Regenerate draft' : 'AI Draft'}
            data-hint="ai-draft-button"
            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2.5 rounded-xl transition-colors h-[42px] flex items-center justify-center"
          >
            {drafting ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : hasDraft ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
              </svg>
            )}
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending || disabled}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium transition-colors h-[42px]"
        >
          {sending ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Send'
          )}
        </button>
      </div>
      <p className="text-xs text-white/30 mt-2 text-center">
        Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
