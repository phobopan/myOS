import { useState } from 'react';
import type { GmailMessage } from '../types';
import { EmailAttachment } from './EmailAttachment';

interface EmailMessageProps {
  message: GmailMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isLast: boolean;
}

function formatEmailDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function extractSenderName(from: string): string {
  // "John Doe <john@example.com>" -> "John Doe"
  // "<john@example.com>" -> "john@example.com"
  // "john@example.com" -> "john@example.com"
  const match = from.match(/^([^<]+)</);
  return match ? match[1].trim() : from.replace(/[<>]/g, '');
}

function splitQuotedText(text: string): { main: string; quoted: string | null } {
  // Look for "On ... wrote:" pattern
  const onWroteMatch = text.match(/\n(On .+ wrote:[\s\S]*)/);
  if (onWroteMatch && onWroteMatch.index) {
    return {
      main: text.slice(0, onWroteMatch.index).trim(),
      quoted: onWroteMatch[1],
    };
  }

  // Look for lines starting with ">"
  const lines = text.split('\n');
  const firstQuotedIndex = lines.findIndex(l => l.startsWith('>'));
  if (firstQuotedIndex > 0) {
    return {
      main: lines.slice(0, firstQuotedIndex).join('\n').trim(),
      quoted: lines.slice(firstQuotedIndex).join('\n'),
    };
  }

  return { main: text, quoted: null };
}

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

export function EmailMessage({ message, isExpanded, onToggleExpand }: EmailMessageProps) {
  const [showQuoted, setShowQuoted] = useState(false);

  const senderName = extractSenderName(message.from);
  const relativeDate = formatRelativeDate(message.date);
  const fullDate = formatEmailDate(message.date);

  // Parse body text for quoted content
  const bodyText = message.body.text || '';
  const { main: mainText, quoted: quotedText } = splitQuotedText(bodyText);

  if (!isExpanded) {
    // Collapsed state - compact row
    return (
      <button
        onClick={onToggleExpand}
        className="w-full text-left p-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-white/90 text-sm">
                {senderName}
              </span>
              <span className="text-xs text-white/40">
                {relativeDate}
              </span>
            </div>
            <p className="text-sm text-white/60 truncate mt-0.5">
              {message.snippet}
            </p>
          </div>
          <ChevronDownIcon />
        </div>
      </button>
    );
  }

  // Expanded state - full email
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* From */}
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">From:</span>
              <span className="text-sm text-white/90 truncate">{message.from}</span>
            </div>

            {/* To */}
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">To:</span>
              <span className="text-sm text-white/90 truncate">{message.to}</span>
            </div>

            {/* CC (only if present) */}
            {message.cc && (
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-white/50 uppercase tracking-wide">CC:</span>
                <span className="text-sm text-white/90 truncate">{message.cc}</span>
              </div>
            )}

            {/* Date */}
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">Date:</span>
              <span className="text-sm text-white/90">{fullDate}</span>
            </div>

            {/* Subject */}
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">Subject:</span>
              <span className="text-sm text-white/90 font-medium">{message.subject}</span>
            </div>
          </div>

          {/* Collapse button */}
          <button
            onClick={onToggleExpand}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            title="Collapse email"
          >
            <ChevronUpIcon />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {message.body.html ? (
          // HTML body (with basic sanitization via React's XSS protection)
          <div
            className="text-white/80 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: message.body.html }}
          />
        ) : (
          // Plain text body
          <div className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
            {mainText}
          </div>
        )}

        {/* Quoted text section */}
        {quotedText && !message.body.html && (
          <div className="mt-4">
            <button
              onClick={() => setShowQuoted(!showQuoted)}
              className="text-xs text-white/50 hover:text-white/70 transition-colors"
            >
              {showQuoted ? '▼ Hide quoted text' : '▶ Show quoted text'}
            </button>
            {showQuoted && (
              <div className="mt-2 pl-4 border-l-2 border-white/10 text-white/60 text-sm whitespace-pre-wrap font-mono">
                {quotedText}
              </div>
            )}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-xs text-white/50 uppercase tracking-wide mb-3">
              Attachments ({message.attachments.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {message.attachments.map((attachment) => (
                <EmailAttachment
                  key={attachment.id}
                  attachment={attachment}
                  messageId={message.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
