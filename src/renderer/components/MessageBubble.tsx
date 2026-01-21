import type { Reaction, Attachment } from '../types';
import { AttachmentView } from './AttachmentView';

interface MessageBubbleProps {
  content: string | null;
  isFromMe: boolean;
  senderName?: string | null;
  timestamp: Date;
  attachments?: Attachment[];
  reactions?: Reaction[];
  showSender?: boolean;  // For group chats
}

export function MessageBubble({
  content,
  isFromMe,
  senderName,
  timestamp,
  attachments = [],
  reactions = [],
  showSender = false,
}: MessageBubbleProps) {
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

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[70%]">
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2 ${
            isFromMe
              ? 'bg-blue-500/80 text-white'
              : 'bg-white/10 text-white'
          }`}
        >
          {/* Sender name for group chats */}
          {showSender && !isFromMe && senderName && (
            <p className="text-xs text-white/60 mb-1 font-medium">
              {senderName}
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

          {/* Text content */}
          {hasContent && (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          )}

          {/* Timestamp */}
          <p className={`text-xs mt-1 ${
            isFromMe ? 'text-white/60' : 'text-white/40'
          }`}>
            {formatTime(timestamp)}
          </p>
        </div>

        {/* Reactions badge */}
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
