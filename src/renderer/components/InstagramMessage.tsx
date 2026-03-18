import { useState } from 'react';
import type { InstagramMessage as InstagramMessageType, InstagramAttachment } from '../types';

interface InstagramMessageProps {
  message: InstagramMessageType;
  threadId?: string;
  isGroup?: boolean;
}

export function InstagramMessage({ message, threadId, isGroup }: InstagramMessageProps) {
  const { text, fromUser, attachments, time, reactions, itemType, from } = message;

  // Get sender name for group chats
  const senderName = isGroup && fromUser ? (from?.name || from?.username || 'Unknown') : null;

  // Completely skip action_log/like/reaction messages - they should only appear as reactions on other messages
  const isLikeAction = itemType === 'like' || itemType === 'reaction' || itemType === 'action_log';
  if (isLikeAction) {
    return null;
  }

  // Check if message only has [Media] placeholder and has attachments
  const hasOnlyMediaPlaceholder = text === '[Media]' && attachments.length > 0;

  // Get display text - hide placeholders when we have attachments
  const displayText = hasOnlyMediaPlaceholder ? null : text;

  const hasContent = displayText && displayText.trim().length > 0;
  const hasAttachments = attachments.length > 0;
  const hasReactions = reactions && reactions.length > 0;

  // Group reactions by emoji for display (like iMessage)
  // Convert text hearts to emoji hearts with variation selector
  const reactionGroups = (reactions || []).reduce((acc, r) => {
    let emoji = r.emoji;
    // Normalize heart variations to red heart emoji
    if (emoji === 'likes' || emoji === '❤' || emoji === '\u2764') {
      emoji = '\u2764\uFE0F'; // Red heart with variation selector
    }
    acc[emoji] = (acc[emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={`flex ${fromUser ? 'justify-start' : 'justify-end'} mb-3`}>
      <div className="relative max-w-[70%] min-w-0">
        {/* Sender name for group chats */}
        {senderName && (
          <p className="text-xs text-white/50 mb-1">{senderName}</p>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2 overflow-hidden ${
            fromUser
              ? 'bg-white/10 text-white'
              : 'bg-blue-500/80 text-white'
          }`}
          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
        >
          {/* Attachments */}
          {hasAttachments && (
            <div className="space-y-2 mb-2">
              {attachments.map((att, idx) => (
                <AttachmentView key={idx} attachment={att} threadId={threadId} />
              ))}
            </div>
          )}

          {/* Text content */}
          {hasContent && (
            <p className="text-sm whitespace-pre-wrap">{displayText}</p>
          )}

          {/* Timestamp */}
          <p className={`text-xs mt-1 ${fromUser ? 'text-white/40' : 'text-white/60'}`}>
            {formatTime(time)}
          </p>
        </div>

        {/* Reactions badge (like iMessage) */}
        {hasReactions && (
          <div className={`absolute -bottom-2 ${fromUser ? 'right-2' : 'left-2'} flex gap-0.5`}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span
                key={emoji}
                className="bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-xs"
                title={(reactions || []).filter(r => (r.emoji === 'likes' ? '❤️' : r.emoji) === emoji).map(r => r.username).filter(Boolean).join(', ')}
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

function AttachmentView({ attachment, threadId }: { attachment: InstagramAttachment; threadId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const { type, url, thumbnailUrl, title, caption, mediaType, username } = attachment;

  const openInstagram = () => {
    // Try to open specific thread - Instagram web URL format
    // Note: Instagram may redirect to inbox if not logged in
    if (threadId) {
      // Try the web URL with thread ID
      window.electron.shell.openExternal(`https://www.instagram.com/direct/t/${threadId}/`);
    } else {
      window.electron.shell.openExternal('https://www.instagram.com/direct/inbox/');
    }
  };

  const displayUrl = url || thumbnailUrl;

  // Image - display inline with click to expand (like iMessage)
  // Only for direct images (no mediaType), not for shared posts
  const isDirectMedia = !mediaType || mediaType === 'gif' || mediaType === 'voice_message';
  if (type === 'image' && displayUrl && !error && isDirectMedia) {
    if (expanded) {
      return (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setExpanded(false)}
        >
          <img
            src={displayUrl}
            alt="Photo"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onError={() => setError(true)}
          />
        </div>
      );
    }

    return (
      <img
        src={displayUrl}
        alt="Photo"
        className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
        onClick={() => setExpanded(true)}
        onError={() => setError(true)}
      />
    );
  }

  // Video - show thumbnail with play button
  if (type === 'video') {
    const thumbUrl = thumbnailUrl || url;
    if (thumbUrl && !error) {
      return (
        <div className="relative max-w-[200px] cursor-pointer" onClick={openInstagram}>
          <img
            src={thumbUrl}
            alt="Video"
            className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
            onError={() => setError(true)}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg hover:bg-black/40 transition-colors">
            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white/10 rounded-lg p-3" onClick={openInstagram}>
        <p className="text-sm text-white/60">🎬 Video</p>
      </div>
    );
  }

  // GIF - display inline
  if (type === 'gif' && url && !error) {
    return (
      <img
        src={url}
        alt="GIF"
        className="max-w-[200px] max-h-[200px] rounded-lg"
        onError={() => setError(true)}
      />
    );
  }

  // Shared post/reel - show thumbnail with label, link to actual post
  if (mediaType === 'shared_post' || mediaType === 'reel' || mediaType === 'reel_share' || type === 'xma') {
    const isReel = mediaType === 'reel' || mediaType === 'reel_share';
    // Use post URL if available, otherwise fall back to thread
    const openPost = () => {
      if (url && (url.includes('instagram.com') || url.startsWith('http'))) {
        window.electron.shell.openExternal(url);
      } else {
        openInstagram();
      }
    };
    return (
      <div className="bg-white/10 rounded-lg overflow-hidden max-w-[200px] cursor-pointer" onClick={openPost}>
        {(thumbnailUrl || displayUrl) && !error && (
          <img
            src={thumbnailUrl || displayUrl}
            alt={isReel ? 'Reel' : 'Post'}
            className="w-full max-h-[150px] object-cover"
            onError={() => setError(true)}
          />
        )}
        <div className="p-2">
          <p className="text-xs text-white/60">
            {isReel ? '🎬 Reel' : '📱 Post'}
            {username && <span className="text-white/40"> @{username}</span>}
          </p>
          {caption && <p className="text-xs text-white/40 mt-1 truncate">{caption}</p>}
        </div>
      </div>
    );
  }

  // Story
  if (mediaType === 'story') {
    return (
      <div className="bg-white/10 rounded-lg overflow-hidden max-w-[200px] cursor-pointer" onClick={openInstagram}>
        {thumbnailUrl && !error && (
          <img
            src={thumbnailUrl}
            alt="Story"
            className="w-full max-h-[150px] object-cover"
            onError={() => setError(true)}
          />
        )}
        <div className="p-2">
          <p className="text-xs text-white/60">
            📖 Story
            {username && <span className="text-white/40"> @{username}</span>}
          </p>
        </div>
      </div>
    );
  }

  // Link
  if (type === 'link') {
    return (
      <div
        className="bg-white/10 rounded-lg p-3 max-w-[200px] cursor-pointer hover:bg-white/15 transition-colors"
        onClick={() => url && window.electron.shell.openExternal(url)}
      >
        <p className="text-sm text-white/60">🔗 {title || 'Link'}</p>
        {url && <p className="text-xs text-blue-400 mt-1 truncate">{url}</p>}
      </div>
    );
  }

  // Voice message
  if (type === 'audio' || mediaType === 'voice_message') {
    return (
      <div className="bg-white/10 rounded-lg p-3 flex items-center gap-2">
        <span className="text-lg">🎤</span>
        <p className="text-sm text-white/60">Voice message</p>
      </div>
    );
  }

  // Generic fallback
  if (displayUrl && !error) {
    return (
      <div className="bg-white/10 rounded-lg overflow-hidden max-w-[200px] cursor-pointer" onClick={openInstagram}>
        <img
          src={displayUrl}
          alt="Media"
          className="w-full max-h-[150px] object-cover"
          onError={() => setError(true)}
        />
        <div className="p-2">
          <p className="text-xs text-white/60">{title || 'Shared content'}</p>
        </div>
      </div>
    );
  }

  return null;
}

function formatTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
