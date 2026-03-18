import { useState, useEffect, useRef } from 'react';

interface FeatureTooltipProps {
  targetSelector: string;
  title: string;
  description: string;
  onDismiss: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function FeatureTooltip({
  targetSelector,
  title,
  description,
  onDismiss,
  onNext,
  hasNext = false,
  position = 'bottom',
}: FeatureTooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.querySelector(targetSelector);
    if (!target) {
      // If target doesn't exist, show centered
      setCoords({ top: window.innerHeight / 2 - 50, left: window.innerWidth / 2 - 150 });
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 12;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'bottom':
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - 150;
        break;
      case 'top':
        top = rect.top - padding - 120;
        left = rect.left + rect.width / 2 - 150;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - 50;
        left = rect.right + padding;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - 50;
        left = rect.left - padding - 300;
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - 308));
    top = Math.max(8, Math.min(top, window.innerHeight - 140));

    setCoords({ top, left });

    // Highlight the target element
    target.classList.add('feature-hint-highlight');
    return () => {
      target.classList.remove('feature-hint-highlight');
    };
  }, [targetSelector, position]);

  if (!coords) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onDismiss}
      />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] w-[300px] p-4 rounded-xl shadow-xl"
        style={{
          top: coords.top,
          left: coords.left,
          background: 'rgba(30, 30, 40, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
        <p className="text-xs text-white/60 mb-3">{description}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            {hasNext ? 'Skip all' : 'Got it'}
          </button>
          {hasNext && onNext && (
            <button
              onClick={onNext}
              className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Next
            </button>
          )}
          {!hasNext && (
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </>
  );
}
