import type { Tag } from '../types';

interface TagBadgeProps {
  tag: Tag;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  onClick?: () => void;
}

export function TagBadge({ tag, size = 'sm', showLabel = false, onClick }: TagBadgeProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
  };

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      title={tag.name}
    >
      <div
        className={`${sizeClasses[size]} rounded-full flex-shrink-0`}
        style={{ backgroundColor: tag.color }}
      />
      {showLabel && (
        <span className="text-xs text-white/70">{tag.name}</span>
      )}
    </Wrapper>
  );
}

interface TagDotsProps {
  tags: Tag[];
  maxVisible?: number;
}

export function TagDots({ tags, maxVisible = 2 }: TagDotsProps) {
  if (tags.length === 0) return null;

  const visible = tags.slice(0, maxVisible);
  const remaining = tags.length - maxVisible;

  return (
    <div className="flex items-center gap-0.5" title={tags.map(t => t.name).join(', ')}>
      {visible.map((tag) => (
        <div
          key={tag.id}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: tag.color }}
        />
      ))}
      {remaining > 0 && (
        <span className="text-[10px] text-white/40 ml-0.5">+{remaining}</span>
      )}
    </div>
  );
}
