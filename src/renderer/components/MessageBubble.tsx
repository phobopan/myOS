import { type ReactNode } from 'react';
import type { Reaction, Attachment } from '../types';
import { AttachmentView } from './AttachmentView';

// URL regex: matches http(s) URLs and common bare domains
const URL_REGEX = /(?:https?:\/\/[^\s<>]+|(?:www\.)[^\s<>]+\.[^\s<>]+)/gi;

/**
 * Parse text content and turn URLs into clickable links that open in the default browser.
 * Preserves whitespace/newlines via the parent's whitespace-pre-wrap.
 */
function renderTextWithLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Text before the URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    let url = match[0];
    // Strip trailing punctuation that's likely not part of the URL
    const trailingPunct = /[).,;:!?\]}>]+$/.exec(url);
    if (trailingPunct) {
      url = url.slice(0, -trailingPunct[0].length);
    }

    // Ensure href has a protocol
    const href = url.startsWith('http') ? url : `https://${url}`;

    parts.push(
      <a
        key={`link-${match.index}`}
        href={href}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.electron.shell.openExternal(href);
        }}
        className="underline underline-offset-2 hover:opacity-80 transition-opacity break-all"
        title={href}
      >
        {url}
      </a>
    );

    // Adjust lastIndex for any stripped trailing punctuation
    lastIndex = match.index + url.length;
    // Also reset regex lastIndex to continue after the url (not the original match)
    URL_REGEX.lastIndex = lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface MessageBubbleProps {
  content: string | null;
  isFromMe: boolean;
  senderName?: string | null;
  senderHandle?: string | null;  // Fallback when senderName is unavailable
  timestamp: Date;
  attachments?: Attachment[];
  reactions?: Reaction[];
  showSender?: boolean;  // For group chats
  messageGuid?: string;
  replyToMessage?: { text: string | null; senderName: string | null };
  onReplyClick?: () => void;
}

export function MessageBubble({
  content,
  isFromMe,
  senderName,
  senderHandle,
  timestamp,
  attachments = [],
  reactions = [],
  showSender = false,
  replyToMessage,
  onReplyClick,
}: MessageBubbleProps) {
  // Display sender: prefer name, fall back to handle (phone/email)
  const displaySender = senderName || senderHandle;
  const hasContent = content && content.trim().length > 0;
  const hasAttachments = attachments.length > 0;
  const hasReactions = reactions.length > 0;

  // Group reactions by emoji for display
  const reactionGroups = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const replySnippet = replyToMessage?.text
    ? (replyToMessage.text.length > 60 ? replyToMessage.text.slice(0, 60) + '...' : replyToMessage.text)
    : 'Attachment';
  const replySender = replyToMessage?.senderName || 'Unknown';

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[70%] min-w-0">
        {/* Reply preview bar — shows what this message is replying to */}
        {replyToMessage && (
          <button
            onClick={onReplyClick}
            className={`flex items-center gap-1.5 text-xs mb-1 px-3 py-1 rounded-lg transition-colors max-w-full truncate ${
              isFromMe
                ? 'bg-blue-600/40 text-blue-200 hover:bg-blue-600/60'
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="truncate">
              <span className="font-medium">{replySender}:</span> {replySnippet}
            </span>
          </button>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2 overflow-hidden ${
            isFromMe
              ? 'bg-blue-500/80 text-white'
              : 'bg-white/10 text-white'
          }`}
          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
        >
          {/* Sender name for group chats */}
          {showSender && !isFromMe && displaySender && (
            <p className="text-xs text-white/60 mb-1 font-medium">
              {displaySender}
            </p>
          )}

          {/* Attachments */}
          {hasAttachments && (
            <div className="space-y-2 mb-2">
              {attachments.map((att) => (
                <AttachmentView key={att.id} attachment={att} />
              ))}
            </div>
          )}

          {/* Text content — URLs rendered as clickable links */}
          {hasContent && (
            <p className="text-sm whitespace-pre-wrap">{renderTextWithLinks(content!)}</p>
          )}

          {/* Timestamp */}
          <p className={`text-xs mt-1 ${
            isFromMe ? 'text-white/60' : 'text-white/40'
          }`}>
            {formatTime(timestamp)}
          </p>
        </div>

        {/* Reactions badge — displays existing reactions from the DB (read-only) */}
        {hasReactions && (
          <div className={`absolute -bottom-2 ${isFromMe ? 'left-2' : 'right-2'} flex gap-0.5`}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span
                key={emoji}
                className="bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-xs"
                title={reactions.filter(r => r.emoji === emoji).map(r => r.senderName).filter(Boolean).join(', ')}
              >
                {emoji}{count > 1 ? count : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
