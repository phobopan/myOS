import { useState, useEffect, useRef } from 'react';

interface FeatureTooltipProps {
  targetSelector: string;
  fallbackSelector?: string;
  title: string;
  description: string;
  onDismiss: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  stepNumber?: number;
  totalSteps?: number;
}

function findTarget(primary: string, fallback?: string): Element | null {
  return document.querySelector(primary) ||
    (fallback ? document.querySelector(fallback) : null);
}

export function FeatureTooltip({
  targetSelector,
  fallbackSelector,
  title,
  description,
  onDismiss,
  onNext,
  hasNext = false,
  position = 'bottom',
  stepNumber,
  totalSteps,
}: FeatureTooltipProps) {
  const [tooltipCoords, setTooltipCoords] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const advance = () => {
    if (onNext) {
      onNext();
    } else {
      onDismiss();
    }
  };

  // Poll for the target element and position tooltip
  useEffect(() => {
    setTooltipCoords(null);

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const tryFind = () => {
      if (cancelled) return;
      const target = findTarget(targetSelector, fallbackSelector);
      if (target) {
        const rect = target.getBoundingClientRect();
        const padding = 12;
        let top = 0;
        let left = 0;

        switch (position) {
          case 'bottom':
            top = rect.bottom + padding;
            left = rect.left + rect.width / 2 - 135;
            break;
          case 'top':
            top = rect.top - padding - 100;
            left = rect.left + rect.width / 2 - 135;
            break;
          case 'right':
            top = rect.top + rect.height / 2 - 40;
            left = rect.right + padding;
            break;
          case 'left':
            top = rect.top + rect.height / 2 - 40;
            left = rect.left - padding - 280;
            break;
        }

        left = Math.max(8, Math.min(left, window.innerWidth - 288));
        top = Math.max(8, Math.min(top, window.innerHeight - 120));
        setTooltipCoords({ top, left });
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryFind, 100);
      } else {
        setTooltipCoords({
          top: window.innerHeight / 2 - 50,
          left: window.innerWidth / 2 - 150,
        });
      }
    };

    const initTimer = setTimeout(tryFind, 50);
    return () => { cancelled = true; clearTimeout(initTimer); };
  }, [targetSelector, fallbackSelector, position]);

  if (!tooltipCoords) return null;

  return (
    <>
      {/* Click-anywhere layer (invisible) */}
      <div className="fixed inset-0 z-[9998]" onClick={advance} />

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] w-[270px] rounded-2xl overflow-hidden"
        style={{
          top: tooltipCoords.top,
          left: tooltipCoords.left,
          background: 'rgba(18, 18, 22, 0.92)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            pointerEvents: 'none',
          }}
        />

        <div className="px-4 pt-3.5 pb-3">
          {stepNumber != null && totalSteps != null && (
            <div className="flex gap-1 mb-2.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`h-[2px] rounded-full transition-all ${
                    i + 1 <= stepNumber ? 'w-5 bg-white/50' : 'w-3 bg-white/10'
                  }`}
                />
              ))}
            </div>
          )}

          <h3 className="text-[13px] font-medium text-white mb-1">{title}</h3>
          <p className="text-[11px] leading-relaxed text-white/55 mb-3">{description}</p>

          <div className="flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              Skip tour
            </button>

            <span className="text-[11px] text-white/30">
              {hasNext ? 'Click anywhere to continue' : 'Click to finish'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
