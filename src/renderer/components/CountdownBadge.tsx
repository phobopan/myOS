import type { InstagramWindowStatus } from '../types';

interface CountdownBadgeProps {
  windowStatus: InstagramWindowStatus;
  className?: string;
}

export function CountdownBadge({ windowStatus, className = '' }: CountdownBadgeProps) {
  const { isOpen, hoursRemaining, minutesRemaining, urgency } = windowStatus;

  if (!isOpen || urgency === 'expired') {
    return (
      <span className={`text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 ${className}`}>
        Expired
      </span>
    );
  }

  // Color based on urgency
  const bgColor = urgency === 'warning' ? 'bg-orange-500/20' : 'bg-green-500/20';
  const textColor = urgency === 'warning' ? 'text-orange-400' : 'text-green-400';

  // Format time remaining
  const timeText = hoursRemaining > 0
    ? `${hoursRemaining}h ${minutesRemaining}m left`
    : `${minutesRemaining}m left`;

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${bgColor} ${textColor} ${className}`}>
      {timeText}
    </span>
  );
}
