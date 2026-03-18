import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { UnreadPreview } from './UnreadPreview';

interface ChatBubbleProps {
  pinId: string;
  source: 'imessage' | 'gmail' | 'instagram';
  name: string;
  unread?: { text: string; count: number } | null;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  index?: number;
  sortable?: boolean; // true = dnd-kit sortable (clustered pins)
  draggable?: boolean; // true = dnd-kit draggable (unclustered pins)
}

const SOURCE_DOTS: Record<string, string> = {
  imessage: 'source-dot-imessage',
  gmail: 'source-dot-gmail',
  instagram: 'source-dot-instagram',
};

// Bubble placement variants within the bounding box — keeps things organic
const BUBBLE_POSITIONS: React.CSSProperties[] = [
  { top: 0, left: '50%', transform: 'translateX(-50%)' },  // centered above
  { top: 4, left: 2 },                                      // upper-left
  { top: 4, right: 2 },                                     // upper-right
  { top: 0, left: 8 },                                      // slight left
  { top: 0, right: 8 },                                     // slight right
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ChatBubbleInner({
  source,
  name,
  unread,
  onClick,
  onContextMenu,
  index = 0,
}: Omit<ChatBubbleProps, 'pinId' | 'sortable' | 'draggable'>) {
  const hasUnread = unread && unread.count > 0;
  const bubbleVariant = index % BUBBLE_POSITIONS.length;

  return (
    <>
      {hasUnread && (
        <div
          className="absolute z-20 pointer-events-none"
          style={BUBBLE_POSITIONS[bubbleVariant]}
        >
          <div className="animate-bubble-in">
            <UnreadPreview text={unread!.text} />
          </div>
        </div>
      )}

      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        className="chat-pin-circle absolute left-1/2 -translate-x-1/2 bottom-[18px] w-16 h-16 rounded-full flex items-center justify-center text-white/80 font-medium text-[15px] tracking-wide"
      >
        {getInitials(name)}
        <span className={`absolute -bottom-px -right-px w-[11px] h-[11px] rounded-full ${SOURCE_DOTS[source]}`} />
      </button>

      <span className="absolute bottom-0 left-0 right-0 text-[10px] text-white/40 truncate text-center leading-tight font-light">
        {name}
      </span>
    </>
  );
}

export function ChatBubble({ pinId, sortable = true, draggable = false, ...rest }: ChatBubbleProps) {
  if (draggable) {
    return <DraggableChatBubble pinId={pinId} {...rest} />;
  }
  if (sortable) {
    return <SortableChatBubble pinId={pinId} {...rest} />;
  }

  return (
    <div className="relative w-[110px] h-[108px] select-none">
      <ChatBubbleInner {...rest} />
    </div>
  );
}

function SortableChatBubble({ pinId, ...rest }: Omit<ChatBubbleProps, 'sortable' | 'draggable'>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pinId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative w-[110px] h-[108px] select-none"
    >
      <ChatBubbleInner {...rest} />
    </div>
  );
}

function DraggableChatBubble({ pinId, ...rest }: Omit<ChatBubbleProps, 'sortable' | 'draggable'>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: pinId });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative w-[110px] h-[108px] select-none cursor-grab active:cursor-grabbing"
    >
      <ChatBubbleInner {...rest} />
    </div>
  );
}
