import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { Cluster } from '../types';
import { ChatBubble } from './ChatBubble';

interface UnreadInfo {
  text: string;
  count: number;
}

interface ClusterGroupProps {
  cluster: Cluster;
  unreadMap: Map<string, UnreadInfo>;
  nameMap: Map<string, string>;
  onClickPin: (source: 'imessage' | 'gmail' | 'instagram', id: string) => void;
  onPinContextMenu: (e: React.MouseEvent, source: 'imessage' | 'gmail' | 'instagram', id: string) => void;
  onAddPin: () => void;
  onEditCluster: () => void;
  onDeleteCluster: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}

export function ClusterGroup({
  cluster,
  unreadMap,
  nameMap,
  onClickPin,
  onPinContextMenu,
  onAddPin,
  onEditCluster,
  onDeleteCluster,
  onDragStart,
}: ClusterGroupProps) {
  const pinIds = cluster.pins.map(p => `${p.source}-${p.id}`);

  const { setNodeRef, isOver } = useDroppable({ id: `cluster-${cluster.id}` });

  // Dynamic columns: expand to fit, max 4 per row
  const cols = Math.min(Math.max(cluster.pins.length, 1), 4);

  return (
    <div
      ref={setNodeRef}
      data-cluster-drag
      className="cluster-container group/cluster transition-shadow duration-200"
      style={{
        background: `${cluster.color}10`,
        borderColor: isOver ? `${cluster.color}80` : `${cluster.color}25`,
        boxShadow: isOver ? `0 0 16px ${cluster.color}30, inset 0 0 12px ${cluster.color}15` : 'none',
      }}
    >

      {/* Header — drag handle + controls that appear on hover */}
      <div
        className="relative flex items-center gap-2 px-3 pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
      >
        <span
          className="w-[6px] h-[6px] rounded-full flex-shrink-0"
          style={{ backgroundColor: cluster.color }}
        />
        <span className="text-[11px] font-medium text-white/40 flex-1 tracking-wide">
          {cluster.name}
        </span>

        {/* Controls — fade in on cluster hover */}
        <div
          className="flex items-center gap-px opacity-0 group-hover/cluster:opacity-100 transition-opacity duration-200"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            onClick={onAddPin}
            className="w-5 h-5 rounded-md flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={onEditCluster}
            className="w-5 h-5 rounded-md flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-[10px] h-[10px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={onDeleteCluster}
            className="w-5 h-5 rounded-md flex items-center justify-center text-white/25 hover:text-red-400/60 hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-[10px] h-[10px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pins grid */}
      <div className="relative px-2 pb-3 pt-1">
        <SortableContext items={pinIds} strategy={rectSortingStrategy}>
          <div
            className="grid justify-items-center"
            style={{
              gridTemplateColumns: `repeat(${cols}, 110px)`,
              gap: '4px 4px',
            }}
          >
            {cluster.pins.map((pin, i) => {
              const key = `${pin.source}-${pin.id}`;
              return (
                <ChatBubble
                  key={key}
                  pinId={key}
                  source={pin.source}
                  name={nameMap.get(key) || pin.id}
                  unread={unreadMap.get(key)}
                  onClick={() => onClickPin(pin.source, pin.id)}
                  onContextMenu={(e) => onPinContextMenu(e, pin.source, pin.id)}
                  index={i}
                />
              );
            })}
          </div>
        </SortableContext>

        {cluster.pins.length === 0 && (
          <button
            onClick={onAddPin}
            className="w-full py-5 flex flex-col items-center gap-1.5 text-white/15 hover:text-white/30 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px]">Add pins</span>
          </button>
        )}
      </div>
    </div>
  );
}
