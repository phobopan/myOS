import { useState, useEffect } from 'react';

const STORAGE_KEY = 'draftingHintSeen_v2';

export function useDraftingHint() {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setSeen(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  return { showDraftingHint: !seen, dismissDraftingHint: dismiss };
}

interface DraftingHintProps {
  onDismiss: () => void;
}

export function DraftingHint({ onDismiss }: DraftingHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="rounded-xl px-3.5 py-2.5 mb-2 mx-1 cursor-pointer"
      onClick={onDismiss}
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <svg className="w-4 h-4 mt-0.5 text-white/40 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] leading-relaxed text-white/50">
            Tip: Hit the <span className="text-white/70">star button</span> to generate an AI-powered reply draft.
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0 mt-0.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
