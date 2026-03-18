import { useState, useEffect, KeyboardEvent, useRef } from 'react';
import type { GmailThread, GmailMessage } from '../types';

type ComposerMode = 'reply' | 'replyAll' | 'forward';

interface EmailChipInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  editable?: boolean;
}

function EmailChipInput({ value, onChange, placeholder, disabled, editable = true }: EmailChipInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && inputValue.trim()) {
      e.preventDefault();
      const email = inputValue.trim().replace(/,/g, '');
      if (email && !value.includes(email)) {
        onChange([...value, email]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      const email = inputValue.trim().replace(/,/g, '');
      if (email && !value.includes(email)) {
        onChange([...value, email]);
      }
      setInputValue('');
    }
  };

  const removeEmail = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  if (!editable) {
    return (
      <div className="flex flex-wrap gap-1 flex-1 min-h-[28px] items-center">
        {value.map((email, index) => (
          <span
            key={index}
            className="bg-white/10 text-white/90 text-sm px-2 py-0.5 rounded"
          >
            {email}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap gap-1 flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 min-h-[28px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((email, index) => (
        <span
          key={index}
          className="bg-white/20 text-white/90 text-sm px-2 py-0.5 rounded flex items-center gap-1"
        >
          {email}
          {!disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(index);
              }}
              className="text-white/50 hover:text-white"
            >
              ×
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
      />
    </div>
  );
}

interface GmailComposerProps {
  thread: GmailThread;
  lastMessage: GmailMessage;
  onSent?: () => void;
  disabled?: boolean;
  claudeAvailable?: boolean;
}

export function GmailComposer({ thread, lastMessage, onSent, disabled = false, claudeAvailable = false }: GmailComposerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ComposerMode>('reply');
  const [body, setBody] = useState('');
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Fetch user email on mount
  useEffect(() => {
    window.electron.gmail.getUserEmail().then(email => setUserEmail(email)).catch(() => setUserEmail(null));
  }, []);

  // Reset when message changes
  useEffect(() => {
    setIsOpen(false);
    setBody('');
    setError(null);
    setSubject(lastMessage.subject);
  }, [lastMessage.id]);

  const parseEmailList = (emailString: string): string[] => {
    if (!emailString) return [];
    return emailString.split(',').map(e => e.trim()).filter(Boolean);
  };

  const computeReplyRecipients = (): string[] => {
    return [lastMessage.from];
  };

  const computeReplyAllRecipients = (): { to: string[]; cc: string[] } => {
    const myEmail = userEmail?.toLowerCase() || '';

    const allRecipients = [
      lastMessage.from,
      ...parseEmailList(lastMessage.to),
      ...parseEmailList(lastMessage.cc),
    ].filter(r => r && !r.toLowerCase().includes(myEmail));

    const uniqueRecipients = Array.from(new Set(allRecipients));

    return {
      to: [lastMessage.from],
      cc: uniqueRecipients.slice(1),
    };
  };

  const openComposer = (newMode: ComposerMode) => {
    setMode(newMode);
    setIsOpen(true);
    setBody('');
    setError(null);
    setSubject(lastMessage.subject);

    if (newMode === 'forward') {
      setToEmails([]);
      setCcEmails([]);
      setShowCc(false);
    } else if (newMode === 'reply') {
      setToEmails(computeReplyRecipients());
      setCcEmails([]);
      setShowCc(false);
    } else if (newMode === 'replyAll') {
      const { to, cc } = computeReplyAllRecipients();
      setToEmails(to);
      setCcEmails(cc);
      setShowCc(cc.length > 0);
    }
    setShowBcc(false);
    setBccEmails([]);
  };

  const handleSend = async () => {
    if (!body.trim() || sending || (mode === 'forward' && toEmails.length === 0)) return;

    setSending(true);
    setError(null);

    try {
      const toStr = toEmails.join(', ');
      const ccStr = ccEmails.join(', ');
      const bccStr = bccEmails.join(', ');

      if (mode === 'forward') {
        await window.electron.gmail.forward(lastMessage, toStr, body);
      } else if (mode === 'replyAll') {
        await window.electron.gmail.sendReplyAll(
          thread.id,
          lastMessage,
          body,
          subject !== lastMessage.subject ? { subject } : undefined
        );
      } else {
        await window.electron.gmail.sendReply(
          thread.id,
          lastMessage.messageId,
          toStr,
          subject,
          body,
          {
            cc: showCc && ccStr ? ccStr : undefined,
            bcc: showBcc && bccStr ? bccStr : undefined,
          }
        );
      }
      setBody('');
      setIsOpen(false);
      setHasDraft(false);
      onSent?.();
    } catch (err: any) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerateDraft = async () => {
    if (drafting || disabled || sending) return;

    setDrafting(true);
    setBody('');
    const cleanup = window.electron.claude.onDraftChunk((chunk) => {
      setBody(prev => prev + chunk);
    });
    try {
      const draftMessages = thread.messages.slice(-10).map(m => ({
        sender: m.from || 'Unknown',
        text: m.body.text || m.snippet || '',
      }));

      await window.electron.claude.generateDraftStream(
        'gmail',
        draftMessages,
        { subject: lastMessage.subject }
      );
      setBody(prev => prev.trim());
      setHasDraft(true);
    } catch (err) {
      console.error('Failed to generate draft:', err);
    } finally {
      cleanup();
      setDrafting(false);
    }
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'reply': return 'Reply';
      case 'replyAll': return 'Reply All';
      case 'forward': return 'Forward';
    }
  };

  // Collapsed state - just show action buttons
  if (!isOpen) {
    return (
      <div className="border-t border-white/10 p-3 flex gap-2">
        <button
          onClick={() => openComposer('reply')}
          className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          Reply
        </button>
        <button
          onClick={() => openComposer('replyAll')}
          className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          Reply All
        </button>
        <button
          onClick={() => openComposer('forward')}
          className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          Forward
        </button>
      </div>
    );
  }

  // Expanded composer
  return (
    <div className="border-t border-white/10 p-4">
      {/* Header with mode and close button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">{getModeLabel()}</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white/50 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Recipient fields */}
      <div className="space-y-2 mb-3">
        {/* To field */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50 w-12 shrink-0">To:</label>
          <EmailChipInput
            value={toEmails}
            onChange={setToEmails}
            placeholder="recipient@example.com"
            disabled={disabled || sending}
            editable={mode === 'forward'}
          />
        </div>

        {/* CC field */}
        {showCc && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/50 w-12 shrink-0">CC:</label>
            <EmailChipInput
              value={ccEmails}
              onChange={setCcEmails}
              placeholder="cc@example.com"
              disabled={disabled || sending}
            />
          </div>
        )}

        {/* BCC field */}
        {showBcc && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/50 w-12 shrink-0">BCC:</label>
            <EmailChipInput
              value={bccEmails}
              onChange={setBccEmails}
              placeholder="bcc@example.com"
              disabled={disabled || sending}
            />
          </div>
        )}

        {/* Add CC/BCC links */}
        {(!showCc || !showBcc) && (
          <div className="flex gap-2 text-xs ml-14">
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Add CC
              </button>
            )}
            {!showBcc && (
              <button
                onClick={() => setShowBcc(true)}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Add BCC
              </button>
            )}
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50 w-12 shrink-0">Subject:</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* Body textarea */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={drafting ? 'AI is drafting...' : 'Write your message...'}
        rows={4}
        disabled={disabled || sending || drafting}
        className={`w-full bg-white/10 border rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-white/30 resize-none disabled:opacity-50 ${
          drafting ? 'border-purple-500/50 animate-pulse' : 'border-white/10'
        }`}
        autoFocus
      />

      {/* Error display */}
      {error && (
        <div className="text-red-400 text-sm mt-2">{error}</div>
      )}

      {/* Send button and hint */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-white/30">Cmd+Enter to send</span>
        <div className="flex items-center gap-2">
          {claudeAvailable && (
            <button
              onClick={handleGenerateDraft}
              disabled={drafting || disabled || sending}
              title={hasDraft ? 'Regenerate draft' : 'AI Draft'}
              className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center"
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
            disabled={!body.trim() || sending || disabled || (mode === 'forward' && toEmails.length === 0)}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
