import type { IMessageConversation } from '../types';
import { ConversationList } from './ConversationList';

interface SidebarProps {
  conversations: IMessageConversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function Sidebar({ conversations, selectedId, onSelect }: SidebarProps) {
  return (
    <aside className="w-80 h-full flex flex-col border-r border-white/10">
      <div className="p-4 border-b border-white/10">
        <h1 className="text-lg font-semibold text-white">Messages</h1>
      </div>
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </aside>
  );
}
