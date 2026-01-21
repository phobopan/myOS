import type { IMessageConversation } from '../types';

// iMessage icon (green bubble)
function IMessageIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes > 0) return `${minutes}m`;
  return 'now';
}

function getDisplayName(conv: IMessageConversation): string {
  // Priority: contactName > displayName > chat participants > handleId
  if (conv.contactName) return conv.contactName;
  if (conv.displayName) return conv.displayName;
  if (conv.isGroup && conv.participants && conv.participants.length > 0) {
    if (conv.participants.length <= 3) {
      return conv.participants.join(', ');
    }
    return `${conv.participants.slice(0, 2).join(', ')} +${conv.participants.length - 2}`;
  }
  return conv.handleId || 'Unknown';
}

interface ConversationListProps {
  conversations: IMessageConversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <div className="widget-bubble-large flex flex-col items-center justify-center h-48 text-white/40 p-6">
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
      {conversations.map((conversation) => {
        const displayName = getDisplayName(conversation);
        // Calculate waiting days for non-from-me messages
        const waitingDays = !conversation.isFromMe
          ? Math.floor((Date.now() - conversation.lastMessageDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={`widget-bubble w-full p-3 text-left ${selectedId === conversation.id ? 'selected' : ''}`}
          >
            <div className="flex items-start gap-3">
              <IMessageIcon />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-white/40 flex-shrink-0">
                    {formatTime(conversation.lastMessageDate)}
                  </span>
                </div>

                <p className="text-sm text-white/60 truncate mt-0.5">
                  {conversation.isFromMe && (
                    <span className="text-white/40">You: </span>
                  )}
                  {conversation.lastMessage || 'Attachment'}
                </p>

                {waitingDays >= 2 && (
                  <div className="mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      waitingDays >= 3
                        ? 'bg-red-500/30 text-red-300'
                        : 'bg-yellow-500/30 text-yellow-300'
                    }`}>
                      waiting {waitingDays}d
                    </span>
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
