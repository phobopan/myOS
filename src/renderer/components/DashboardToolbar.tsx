interface DashboardToolbarProps {
  onAddCluster: () => void;
  onAddPin: () => void;
}

export function DashboardToolbar({ onAddCluster, onAddPin }: DashboardToolbarProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onAddCluster}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-200"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
        </svg>
        Cluster
      </button>
      <button
        onClick={onAddPin}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-200"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Pin
      </button>
    </div>
  );
}
