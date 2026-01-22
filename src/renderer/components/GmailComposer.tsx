import { useState, useEffect, KeyboardEvent } from 'react';
import type { GmailThread, GmailMessage } from '../types';

type ComposerMode = 'reply' | 'replyAll' | 'forward';

interface GmailComposerProps {
  thread: GmailThread;
  lastMessage: GmailMessage;
  onSent?: () => void;
  disabled?: boolean;
}

export function GmailComposer({ thread, lastMessage, onSent, disabled = false }: GmailComposerProps) {
  const [mode, setMode] = useState<ComposerMode>('reply');
  const [body, setBody] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch user email on mount
  useEffect(() => {
    window.electron.gmail.getUserEmail().then(email => setUserEmail(email)).catch(() => setUserEmail(null));
  }, []);

  // Derive initial values when message changes
  useEffect(() => {
    setBody('');
    setMode('reply');
    setError(null);
    setDropdownOpen(false);

    // Subject: keep original
    setSubject(lastMessage.subject);

    // Smart CC visibility: show if original had CC
    setShowCc(!!lastMessage.cc);
    setCc(lastMessage.cc || '');
    setShowBcc(false);
    setBcc('');

    // Set recipients
    updateRecipients('reply');
  }, [lastMessage.id]);

  const computeReplyRecipients = (): string => {
    // Reply goes to original sender
    return lastMessage.from;
  };

  const computeReplyAllRecipients = (): { to: string; cc: string } => {
    // Reply All goes to sender, CC includes all others (except self)
    const myEmail = userEmail?.toLowerCase() || '';

    const allRecipients = [
      lastMessage.from,
      ...lastMessage.to.split(',').map(s => s.trim()),
      ...(lastMessage.cc ? lastMessage.cc.split(',').map(s => s.trim()) : []),
    ].filter(r => r && !r.toLowerCase().includes(myEmail));

    // Remove duplicates
    const uniqueRecipients = Array.from(new Set(allRecipients));

    return {
      to: lastMessage.from,
      cc: uniqueRecipients.slice(1).join(', '),
    };
  };

  const updateRecipients = (newMode: ComposerMode) => {
    if (newMode === 'forward') {
      setTo('');
      setCc('');
      setShowCc(false);
    } else if (newMode === 'reply') {
      setTo(computeReplyRecipients());
      setCc('');
      setShowCc(!!lastMessage.cc);
    } else if (newMode === 'replyAll') {
      const { to: replyTo, cc: replyCc } = computeReplyAllRecipients();
      setTo(replyTo);
      setCc(replyCc);
      setShowCc(!!replyCc);
    }
  };

  const handleModeChange = (newMode: ComposerMode) => {
    setMode(newMode);
    updateRecipients(newMode);
    setDropdownOpen(false);
  };

  const handleSend = async () => {
    if (!body.trim() || sending || (mode === 'forward' && !to.trim())) return;

    setSending(true);
    setError(null);

    try {
      if (mode === 'forward') {
        await window.electron.gmail.forward(lastMessage, to, body);
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
          to,
          subject,
          body,
          {
            cc: showCc && cc ? cc : undefined,
            bcc: showBcc && bcc ? bcc : undefined,
          }
        );
      }
      setBody('');
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

  const getModeLabel = () => {
    switch (mode) {
      case 'reply': return 'Reply';
      case 'replyAll': return 'Reply All';
      case 'forward': return 'Forward';
    }
  };

  return (
    <div className="border-t border-white/10 p-4">
      {/* Mode selector dropdown */}
      <div className="relative mb-3">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
        >
          {getModeLabel()}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-0 top-full mt-1 bg-black/90 backdrop-blur rounded-lg border border-white/10 py-1 shadow-xl z-20 min-w-[120px]">
              <button
                onClick={() => handleModeChange('reply')}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                Reply
              </button>
              <button
                onClick={() => handleModeChange('replyAll')}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                Reply All
              </button>
              <button
                onClick={() => handleModeChange('forward')}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                Forward
              </button>
            </div>
          </>
        )}
      </div>

      {/* Recipient fields */}
      <div className="space-y-2 mb-3">
        {/* To field */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50 w-12 shrink-0">To:</label>
          {mode === 'forward' ? (
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30"
            />
          ) : (
            <span className="text-sm text-white/80 truncate">{to}</span>
          )}
        </div>

        {/* CC field - smart visibility */}
        {showCc && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/50 w-12 shrink-0">CC:</label>
            <input
              value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30"
            />
          </div>
        )}

        {/* BCC field - hidden until added */}
        {showBcc && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/50 w-12 shrink-0">BCC:</label>
            <input
              value={bcc}
              onChange={e => setBcc(e.target.value)}
              placeholder="bcc@example.com"
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30"
            />
          </div>
        )}

        {/* Add CC/BCC links */}
        {(!showCc || !showBcc) && (
          <div className="flex gap-2 text-xs">
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

        {/* Subject (editable) */}
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
        placeholder="Write your reply..."
        rows={4}
        disabled={disabled || sending}
        className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-white/30 resize-none disabled:opacity-50"
      />

      {/* Error display */}
      {error && (
        <div className="text-red-400 text-sm mt-2">{error}</div>
      )}

      {/* Send button and hint */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-white/30">Cmd+Enter to send</span>
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending || disabled || (mode === 'forward' && !to.trim())}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
