import { Conversation } from '../types';

// Source icons as simple components
function IMessageIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    </div>
  );
}

function GmailIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
      </svg>
    </div>
  );
}

function InstagramIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    </div>
  );
}

function SourceIcon({ source }: { source: Conversation['source'] }) {
  switch (source) {
    case 'imessage':
      return <IMessageIcon />;
    case 'gmail':
      return <GmailIcon />;
    case 'instagram':
      return <InstagramIcon />;
  }
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return 'now';
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <div
          className="flex flex-col items-center justify-center h-48 text-white/40 p-6 rounded-2xl border border-white/20"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(60px)',
            WebkitBackdropFilter: 'blur(60px)',
          }}
        >
          <div className="text-2xl mb-2">inbox zero</div>
          <p className="text-sm text-center">
            No messages awaiting reply
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          className="w-full p-3 text-left rounded-2xl border border-white/20 transition-all"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(60px)',
            WebkitBackdropFilter: 'blur(60px)',
            ...(selectedId === conversation.id && {
              background: 'rgba(255, 255, 255, 0.15)',
              borderColor: 'rgba(255, 255, 255, 0.3)',
            }),
          }}
        >
          <div className="flex items-start gap-3">
            <SourceIcon source={conversation.source} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-white truncate">
                  {conversation.name}
                </span>
                <span className="text-xs text-white/40 flex-shrink-0">
                  {formatTime(conversation.lastMessageTime)}
                </span>
              </div>

              <p className="text-sm text-white/60 truncate mt-0.5">
                {conversation.preview}
              </p>

              {conversation.waitingDays && conversation.waitingDays >= 2 && (
                <div className="mt-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    conversation.waitingDays >= 3
                      ? 'bg-red-500/30 text-red-300'
                      : 'bg-yellow-500/30 text-yellow-300'
                  }`}>
                    waiting {conversation.waitingDays}d
                  </span>
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
