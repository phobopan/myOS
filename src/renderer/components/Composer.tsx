import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ComposerProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function Composer({ onSend, disabled = false, placeholder = 'Type a message...' }: ComposerProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
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
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 border-t border-white/10">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-colors resize-none overflow-hidden disabled:opacity-50"
          style={{ minHeight: '42px' }}
        />
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
