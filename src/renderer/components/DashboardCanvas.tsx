import { useState, useRef, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { Cluster, PinnedChat } from '../types';
import { ClusterGroup } from './ClusterGroup';
import { ChatBubble } from './ChatBubble';

interface UnreadInfo {
  text: string;
  count: number;
}

const DRAG_THRESHOLD = 5; // pixels before mousedown becomes a drag

interface DashboardCanvasProps {
  clusters: Cluster[];
  unclusteredPins: PinnedChat[];
  unreadMap: Map<string, UnreadInfo>;
  nameMap: Map<string, string>;
  onClickPin: (source: 'imessage' | 'gmail' | 'instagram', id: string) => void;
  onPinContextMenu: (e: React.MouseEvent, source: 'imessage' | 'gmail' | 'instagram', id: string) => void;
  onReorderPins: (clusterId: string, fromIndex: number, toIndex: number) => void;
  onMoveCluster: (clusterId: string, position: { x: number; y: number }) => void;
  onMovePin: (source: string, id: string, position: { x: number; y: number }) => void;
  onMovePinToContainer: (source: string, id: string, targetClusterId: string | null, position?: { x: number; y: number }) => void;
  onAddPinToCluster: (clusterId: string) => void;
  onEditCluster: (clusterId: string) => void;
  onDeleteCluster: (clusterId: string) => void;
}

// Droppable wrapper for the unclustered area
function UnclusteredDropZone({ children, canvasRef, isActive }: { children: React.ReactNode; canvasRef: React.RefObject<HTMLDivElement | null>; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unclustered' });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="flex-1 overflow-hidden dashboard-canvas relative"
      style={{
        outline: isOver && isActive ? '2px dashed rgba(255,255,255,0.15)' : 'none',
        outlineOffset: '-4px',
        borderRadius: '8px',
      }}
    >
      {children}
    </div>
  );
}

export function DashboardCanvas({
  clusters,
  unclusteredPins,
  unreadMap,
  nameMap,
  onClickPin,
  onPinContextMenu,
  onReorderPins,
  onMoveCluster,
  onMovePin,
  onMovePinToContainer,
  onAddPinToCluster,
  onEditCluster,
  onDeleteCluster,
}: DashboardCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // dnd-kit sensors for cross-container drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Track the active dnd-kit drag for overlay
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // --- Cluster drag (native mouse with threshold — cluster BOXES only) ---
  const [draggingCluster, setDraggingCluster] = useState<string | null>(null);
  const clusterDragRef = useRef<{
    mouseX: number; mouseY: number;
    startX: number; startY: number;
    elWidth: number; elHeight: number;
    activated: boolean;
  } | null>(null);
  const [clusterDragDelta, setClusterDragDelta] = useState<{ id: string; dx: number; dy: number } | null>(null);

  // Clamp a position so the element stays within the canvas bounds.
  // Positions are rendered at `left: pos.x + 20`, so the element's right edge
  // is at `pos.x + 20 + elementWidth`. To keep it in view: pos.x <= canvasWidth - 20 - elementWidth.
  const clampToCanvas = useCallback((x: number, y: number, elementWidth: number, elementHeight: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: Math.max(0, x), y: Math.max(0, y) };
    const maxX = Math.max(0, rect.width - elementWidth - 40);
    const maxY = Math.max(0, rect.height - elementHeight - 40);
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }, []);

  const startClusterDrag = useCallback((clusterId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const cluster = clusters.find(c => c.id === clusterId);
    if (!cluster) return;

    // Measure the cluster element for accurate clamping
    const clusterEl = (e.target as HTMLElement).closest('[data-cluster-drag]');
    const elWidth = clusterEl?.getBoundingClientRect().width || 200;
    const elHeight = clusterEl?.getBoundingClientRect().height || 100;

    clusterDragRef.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      startX: cluster.position.x, startY: cluster.position.y,
      elWidth, elHeight,
      activated: false,
    };

    const onMove = (ev: MouseEvent) => {
      if (!clusterDragRef.current) return;
      const dx = ev.clientX - clusterDragRef.current.mouseX;
      const dy = ev.clientY - clusterDragRef.current.mouseY;
      if (!clusterDragRef.current.activated) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        clusterDragRef.current.activated = true;
        setDraggingCluster(clusterId);
      }
      setClusterDragDelta({ id: clusterId, dx, dy });
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (clusterDragRef.current?.activated) {
        const rawX = clusterDragRef.current.startX + ev.clientX - clusterDragRef.current.mouseX;
        const rawY = clusterDragRef.current.startY + ev.clientY - clusterDragRef.current.mouseY;
        const clamped = clampToCanvas(rawX, rawY, clusterDragRef.current.elWidth, clusterDragRef.current.elHeight);
        onMoveCluster(clusterId, clamped);
      }
      clusterDragRef.current = null;
      setDraggingCluster(null);
      setClusterDragDelta(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clusters, onMoveCluster, clampToCanvas]);

  const liveClusterPos = (c: Cluster) => {
    if (clusterDragDelta?.id === c.id && clusterDragRef.current) {
      const rawX = clusterDragRef.current.startX + clusterDragDelta.dx;
      const rawY = clusterDragRef.current.startY + clusterDragDelta.dy;
      return clampToCanvas(rawX, rawY, clusterDragRef.current.elWidth, clusterDragRef.current.elHeight);
    }
    return c.position;
  };

  // --- Build a map of pinId -> which cluster it belongs to ---
  const pinToCluster = new Map<string, string>();
  for (const cluster of clusters) {
    for (const pin of cluster.pins) {
      pinToCluster.set(`${pin.source}-${pin.id}`, cluster.id);
    }
  }

  // Build position map for unclustered pins
  const pinPositionMap = new Map<string, { x: number; y: number }>();
  for (const pin of unclusteredPins) {
    pinPositionMap.set(`${pin.source}-${pin.id}`, pin.position);
  }

  // All sortable IDs for the unclustered area
  const unclusteredIds = unclusteredPins.map(p => `${p.source}-${p.id}`);

  // Compute drop position relative to canvas, clamped to bounds.
  // Pin elements render at `left: pos.x + 20`, so pos.x = screenLeft - canvasLeft - 20.
  const getDropPosition = (event: DragEndEvent): { x: number; y: number } => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const translated = event.active.rect.current.translated;
    // Measure actual dragged element size, fall back to 80px
    const initial = event.active.rect.current.initial;
    const pinW = initial?.width || 80;
    const pinH = initial?.height || 80;
    if (!canvasRect || !translated) {
      // Fallback: use delta from stored position
      const activeId = event.active.id as string;
      const storedPos = pinPositionMap.get(activeId);
      if (storedPos) {
        return clampToCanvas(storedPos.x + event.delta.x, storedPos.y + event.delta.y, pinW, pinH);
      }
      return { x: 0, y: 0 };
    }
    const rawX = translated.left - canvasRect.left - 20;
    const rawY = translated.top - canvasRect.top - 20;
    return clampToCanvas(rawX, rawY, pinW, pinH);
  };

  // Handle dnd-kit drag end (cross-container moves + in-cluster reorder + position moves)
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    const activeId = active.id as string;
    const [source, ...idParts] = activeId.split('-');
    const id = idParts.join('-');

    // Determine source container
    const sourceClusterId = pinToCluster.get(activeId) || null;

    // If not dropped on anything meaningful
    if (!over) {
      // For unclustered pins, this is a position move (dropped on empty canvas)
      if (!sourceClusterId) {
        const pos = getDropPosition(event);
        onMovePin(source, id, pos);
      }
      return;
    }

    const overId = over.id as string;

    // Determine target container
    let targetClusterId: string | null = null;
    if (overId === 'unclustered') {
      targetClusterId = null;
    } else if (overId.startsWith('cluster-')) {
      targetClusterId = overId.replace('cluster-', '');
    } else {
      // Dropped on another pin — figure out which container that pin is in
      targetClusterId = pinToCluster.get(overId) || null;
    }

    // Cross-container move
    if (sourceClusterId !== targetClusterId) {
      // When moving to unclustered, include drop position
      if (targetClusterId === null) {
        const pos = getDropPosition(event);
        onMovePinToContainer(source, id, null, pos);
      } else {
        onMovePinToContainer(source, id, targetClusterId);
      }
      return;
    }

    // Same unclustered area — position update
    if (!sourceClusterId && targetClusterId === null) {
      const pos = getDropPosition(event);
      onMovePin(source, id, pos);
      return;
    }

    // Same cluster reorder
    if (sourceClusterId && active.id !== over.id) {
      const cluster = clusters.find(c => c.id === sourceClusterId);
      if (cluster) {
        const clusterPinIds = cluster.pins.map(p => `${p.source}-${p.id}`);
        const fromIndex = clusterPinIds.indexOf(activeId);
        const toIndex = clusterPinIds.indexOf(overId);
        if (fromIndex !== -1 && toIndex !== -1) {
          onReorderPins(sourceClusterId, fromIndex, toIndex);
        }
      }
    }
  };

  // Find the dragged pin's info for the overlay
  const activeDragPin = activeDragId ? (() => {
    for (const cluster of clusters) {
      for (const pin of cluster.pins) {
        if (`${pin.source}-${pin.id}` === activeDragId) return pin;
      }
    }
    for (const pin of unclusteredPins) {
      if (`${pin.source}-${pin.id}` === activeDragId) return pin;
    }
    return null;
  })() : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveDragId(event.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <UnclusteredDropZone canvasRef={canvasRef} isActive={!!activeDragId}>
        {/* Clusters — absolutely positioned, free-floating */}
        {clusters.map(cluster => {
          const pos = liveClusterPos(cluster);
          const isDragging = draggingCluster === cluster.id;
          return (
            <div
              key={cluster.id}
              className={isDragging ? 'absolute z-30' : 'absolute z-10'}
              style={{
                left: pos.x + 20,
                top: pos.y + 20,
                transition: isDragging ? 'none' : 'left 0.15s ease, top 0.15s ease',
              }}
            >
              <ClusterGroup
                cluster={cluster}
                unreadMap={unreadMap}
                nameMap={nameMap}
                onClickPin={onClickPin}
                onPinContextMenu={onPinContextMenu}
                onAddPin={() => onAddPinToCluster(cluster.id)}
                onEditCluster={() => onEditCluster(cluster.id)}
                onDeleteCluster={() => onDeleteCluster(cluster.id)}
                onDragStart={(e) => startClusterDrag(cluster.id, e)}
              />
            </div>
          );
        })}

        {/* Unclustered pins — absolutely positioned, draggable via dnd-kit */}
        <SortableContext items={unclusteredIds} strategy={rectSortingStrategy}>
          {unclusteredPins.map((pin, i) => {
            const key = `${pin.source}-${pin.id}`;
            const isDragging = activeDragId === key;
            return (
              <div
                key={key}
                className={`absolute ${isDragging ? 'z-30' : 'z-10'}`}
                style={{
                  left: pin.position.x + 20,
                  top: pin.position.y + 20,
                }}
              >
                <ChatBubble
                  pinId={key}
                  source={pin.source}
                  name={nameMap.get(key) || pin.id}
                  unread={unreadMap.get(key)}
                  onClick={() => onClickPin(pin.source, pin.id)}
                  onContextMenu={(e) => onPinContextMenu(e, pin.source, pin.id)}
                  index={i}
                  sortable={false}
                  draggable={true}
                />
              </div>
            );
          })}
        </SortableContext>
      </UnclusteredDropZone>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeDragPin ? (
          <div className="opacity-80">
            <ChatBubble
              pinId={activeDragId!}
              source={activeDragPin.source}
              name={nameMap.get(activeDragId!) || activeDragPin.id}
              unread={unreadMap.get(activeDragId!)}
              onClick={() => {}}
              onContextMenu={() => {}}
              index={0}
              sortable={false}
              draggable={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
