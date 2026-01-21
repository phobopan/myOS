export function ConversationList() {
  // Empty state for now - Phase 2 will populate with real data
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col items-center justify-center h-full text-white/40 p-8">
        <div className="text-4xl mb-4">inbox zero</div>
        <p className="text-sm text-center">
          No messages awaiting reply
        </p>
      </div>
    </div>
  );
}
