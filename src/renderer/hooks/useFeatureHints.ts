import { useState, useEffect, useCallback } from 'react';

interface FeatureHint {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const FEATURE_HINTS: FeatureHint[] = [
  {
    id: 'filter-pills',
    targetSelector: '[data-hint="source-filter"]',
    title: 'Filter messages by source',
    description: 'Click these pills to show only iMessage, Gmail, or all conversations at once.',
    position: 'bottom',
  },
  {
    id: 'pin-conversation',
    targetSelector: '[data-hint="conversation-item"]',
    title: 'Pin conversations to your dashboard',
    description: 'Right-click any conversation to pin it, mark as done, assign tags, or add to a cluster.',
    position: 'right',
  },
  {
    id: 'settings-tags',
    targetSelector: '[data-hint="settings-button"]',
    title: 'Set up tags to organize contacts',
    description: 'Open Settings to create custom tags, manage AI providers, and configure your digest.',
    position: 'bottom',
  },
  {
    id: 'digest-button',
    targetSelector: '[data-hint="digest-button"]',
    title: 'Generate your Daily Digest',
    description: 'Click here to get an AI-powered summary of your unread messages and emails.',
    position: 'right',
  },
];

const STORAGE_KEY = 'featureHintsSeen';

export function useFeatureHints() {
  const [seenHints, setSeenHints] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [active, setActive] = useState(false);

  // Load seen hints from electron-store on mount
  useEffect(() => {
    window.electron.app.getOnboardingComplete().then(complete => {
      if (!complete) return; // Don't show hints during onboarding

      // Load from localStorage (simpler than adding more IPC for this)
      try {
        const seen = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        setSeenHints(seen);

        // Find the first unseen hint
        const firstUnseen = FEATURE_HINTS.findIndex(h => !seen.includes(h.id));
        if (firstUnseen >= 0) {
          setCurrentIndex(firstUnseen);
          // Small delay so the main UI renders first
          setTimeout(() => setActive(true), 1500);
        }
      } catch {
        setActive(true);
      }
    });
  }, []);

  const currentHint = active ? FEATURE_HINTS[currentIndex] : null;
  const hasNext = currentIndex < FEATURE_HINTS.length - 1 &&
    !seenHints.includes(FEATURE_HINTS[currentIndex + 1]?.id);

  const markSeen = useCallback((hintId: string) => {
    setSeenHints(prev => {
      const next = [...prev, hintId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const dismissCurrent = useCallback(() => {
    if (currentHint) {
      markSeen(currentHint.id);
    }
    setActive(false);
  }, [currentHint, markSeen]);

  const nextHint = useCallback(() => {
    if (currentHint) {
      markSeen(currentHint.id);
    }

    // Find next unseen hint
    let nextIdx = currentIndex + 1;
    while (nextIdx < FEATURE_HINTS.length && seenHints.includes(FEATURE_HINTS[nextIdx].id)) {
      nextIdx++;
    }

    if (nextIdx < FEATURE_HINTS.length) {
      setCurrentIndex(nextIdx);
    } else {
      setActive(false);
    }
  }, [currentHint, currentIndex, seenHints, markSeen]);

  const dismissAll = useCallback(() => {
    const allIds = FEATURE_HINTS.map(h => h.id);
    setSeenHints(allIds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
    setActive(false);
  }, []);

  return {
    currentHint,
    hasNext,
    dismissCurrent,
    nextHint,
    dismissAll,
    active,
  };
}
