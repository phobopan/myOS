import { ConversationList } from './ConversationList';

export function Sidebar() {
  return (
    <aside className="w-80 h-full flex flex-col glass-panel border-r border-white/10">
      {/* Filter tabs will go here in Phase 5 */}
      <div className="p-3 border-b border-white/10">
        <span className="text-xs text-white/50 uppercase tracking-wider">
          Messages
        </span>
      </div>

      <ConversationList />
    </aside>
  );
}
