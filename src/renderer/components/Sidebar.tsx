import { ConversationList } from './ConversationList';
import { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Sidebar({ conversations, selectedId, onSelect }: SidebarProps) {
  return (
    <aside className="w-80 h-full flex flex-col border-r border-white/5">
      {/* Header */}
      <div className="p-4">
        <span className="text-xs text-white/40 uppercase tracking-wider font-medium">
          Awaiting Reply
        </span>
        <span className="ml-2 text-xs text-white/30">
          {conversations.length}
        </span>
      </div>

      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </aside>
  );
}
