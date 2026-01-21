export function ThreadView() {
  // Empty state - no conversation selected
  return (
    <main className="flex-1 h-full flex flex-col glass-panel">
      <div className="flex-1 flex items-center justify-center text-white/30">
        <div className="text-center">
          <div className="text-6xl mb-4">Select a conversation</div>
          <p className="text-sm">
            Choose a message from the sidebar to view the thread
          </p>
        </div>
      </div>
    </main>
  );
}
