import type { InstagramMessage as InstagramMessageType, InstagramAttachment } from '../types';

interface InstagramMessageProps {
  message: InstagramMessageType;
}

export function InstagramMessage({ message }: InstagramMessageProps) {
  const { text, fromUser, attachments, time } = message;

  // Message alignment: user messages on left, our messages on right
  const alignment = fromUser ? 'items-start' : 'items-end';
  const bubbleColor = fromUser ? 'bg-white/10' : 'bg-blue-500/30';

  return (
    <div className={`flex flex-col ${alignment} mb-3`}>
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mb-2 space-y-2 max-w-[80%]">
          {attachments.map((att, idx) => (
            <AttachmentView key={idx} attachment={att} />
          ))}
        </div>
      )}

      {/* Text message */}
      {text && (
        <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${bubbleColor}`}>
          <p className="text-sm text-white whitespace-pre-wrap break-words">{text}</p>
        </div>
      )}

      {/* Timestamp */}
      <span className="text-xs text-white/40 mt-1 px-1">
        {formatTime(time)}
      </span>
    </div>
  );
}

function AttachmentView({ attachment }: { attachment: InstagramAttachment }) {
  const { type, url, thumbnailUrl, title } = attachment;

  // Image/video - display full width
  if (type === 'image' || type === 'video') {
    if (url) {
      return (
        <img
          src={url}
          alt="Attachment"
          className="max-w-full rounded-lg"
          onError={(e) => {
            // Handle expired URLs (7-day expiry)
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      );
    }
  }

  // Shared content (posts/reels/stories) - thumbnail + link
  if (type === 'share' || type === 'story_mention' || type === 'story_reply') {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        {thumbnailUrl && (
          <img src={thumbnailUrl} alt="Shared content" className="w-full rounded mb-2" />
        )}
        <p className="text-xs text-white/60">{title || 'Shared content'}</p>
        <button
          className="text-xs text-blue-400 hover:underline mt-1"
          onClick={() => {
            window.electron.shell.openPath('https://instagram.com');
          }}
        >
          Open in Instagram
        </button>
      </div>
    );
  }

  // Audio - placeholder
  if (type === 'audio') {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <p className="text-xs text-white/60">Voice message</p>
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
