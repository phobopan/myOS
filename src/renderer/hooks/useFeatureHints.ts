import { useState, useEffect, useCallback } from 'react';

export interface FeatureHint {
  id: string;
  targetSelector: string;
  /** Fallback selector if primary target isn't found */
  fallbackSelector?: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const FEATURE_HINTS: FeatureHint[] = [
  {
    id: 'filter-pills',
    targetSelector: '[data-hint="filters-area"]',
    title: 'Filter & sort your inbox',
    description: 'Filter by source, tags, or clusters. Sort by recent or priority, and toggle between unreplied and all messages.',
    position: 'bottom',
  },
  {
    id: 'conversation-item',
    targetSelector: '[data-hint="conversation-list"]',
    title: 'Manage conversations',
    description: 'Click to open a conversation. Right-click for actions like pin, tag, or mark as done.',
    position: 'right',
  },
  {
    id: 'dashboard-button',
    targetSelector: '[data-hint="dashboard-button"]',
    title: 'Your pinned dashboard',
    description: 'Open your dashboard — a spatial canvas for pinned conversations and clusters.',
    position: 'right',
  },
  {
    id: 'digest-button',
    targetSelector: '[data-hint="digest-button"]',
    title: 'Generate your Daily Digest',
    description: 'Get an AI-powered summary of what needs your attention.',
    position: 'right',
  },
  {
    id: 'settings-tags',
    targetSelector: '[data-hint="settings-button"]',
    title: 'Settings & customization',
    description: 'Manage tags, AI providers, digest preferences, and connected accounts.',
    position: 'bottom',
  },
];

const STORAGE_KEY = 'featureHintsSeen';

const DEV_FORCE_TOUR = false;

export function useFeatureHints(onboardingComplete: boolean) {
  const [seenHints, setSeenHints] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [active, setActive] = useState(false);

  // Activate hints when onboarding completes
  useEffect(() => {
    if (!onboardingComplete) return;

    if (DEV_FORCE_TOUR) {
      localStorage.removeItem(STORAGE_KEY);
    }

    try {
      const seen = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setSeenHints(seen);

      const firstUnseen = FEATURE_HINTS.findIndex(h => !seen.includes(h.id));
      if (firstUnseen >= 0) {
        setCurrentIndex(firstUnseen);
        setTimeout(() => setActive(true), 1500);
      }
    } catch {
      setActive(true);
    }
  }, [onboardingComplete]);

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
    stepNumber: currentIndex + 1,
    totalSteps: FEATURE_HINTS.length,
  };
}
