import type { InstagramWindowStatus } from '../types';

interface CountdownBadgeProps {
  windowStatus: InstagramWindowStatus;
  className?: string;
  compact?: boolean;
}

export function CountdownBadge({ windowStatus, className = '', compact = false }: CountdownBadgeProps) {
  // hoursRemaining and minutesRemaining now represent time LEFT to respond
  const { hoursRemaining, minutesRemaining, isOpen } = windowStatus;

  // Color based on how much time is left
  let bgColor: string;
  let textColor: string;

  if (!isOpen) {
    // Window expired
    bgColor = 'bg-red-500/20';
    textColor = 'text-red-400';
  } else if (hoursRemaining < 4) {
    // Less than 4 hours - urgent
    bgColor = 'bg-orange-500/20';
    textColor = 'text-orange-400';
  } else if (hoursRemaining < 12) {
    // Less than 12 hours - warning
    bgColor = 'bg-yellow-500/20';
    textColor = 'text-yellow-400';
  } else {
    // Plenty of time
    bgColor = 'bg-green-500/20';
    textColor = 'text-green-400';
  }

  // Format time left
  let timeText: string;
  if (!isOpen) {
    timeText = 'expired';
  } else if (compact) {
    // Sidebar: just show hours (underestimate - floor)
    timeText = `${hoursRemaining}h`;
  } else {
    // Thread view: show hours and minutes
    if (hoursRemaining === 0) {
      timeText = `${minutesRemaining} min left`;
    } else if (minutesRemaining === 0) {
      timeText = `${hoursRemaining} hr${hoursRemaining !== 1 ? 's' : ''} left`;
    } else {
      timeText = `${hoursRemaining} hr${hoursRemaining !== 1 ? 's' : ''} ${minutesRemaining} min left`;
    }
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${bgColor} ${textColor} flex-shrink-0 ${className}`}>
      {timeText}
    </span>
  );
}
