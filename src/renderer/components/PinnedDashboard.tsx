import { useState, useEffect, useMemo, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { IMessageConversation, GmailThread, InstagramConversation, PinnedDashboard as PinnedDashboardType, Cluster, PinnedChat } from '../types';
import { DashboardCanvas } from './DashboardCanvas';
import { DashboardToolbar } from './DashboardToolbar';
import { PinSearchModal } from './PinSearchModal';
import { ColorPicker } from './ColorPicker';

interface UnreadInfo {
  text: string;
  count: number;
}

interface PinnedDashboardProps {
  conversations: IMessageConversation[];
  gmailThreads: GmailThread[];
  instagramConversations: InstagramConversation[];
  onSelectImessage: (id: number) => void;
  onSelectGmailThread: (id: string) => void;
  onSelectInstagramConversation: (id: string) => void;
  refreshKey?: number; // Increment to force re-fetch (e.g. after sidebar pin)
  onDashboardChanged?: (clusters: Cluster[]) => void;
}

const CLUSTER_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

export function PinnedDashboard({
  conversations,
  gmailThreads,
  instagramConversations,
  onSelectImessage,
  onSelectGmailThread,
  onSelectInstagramConversation,
  refreshKey = 0,
  onDashboardChanged,
}: PinnedDashboardProps) {
  const [dashboard, setDashboard] = useState<PinnedDashboardType | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchTargetCluster, setSearchTargetCluster] = useState<string | undefined>(undefined);
  const [showClusterForm, setShowClusterForm] = useState(false);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [clusterNameInput, setClusterNameInput] = useState('');
  const [clusterColorInput, setClusterColorInput] = useState('#3b82f6');
  const [pinContextMenu, setPinContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    source: 'imessage' | 'gmail' | 'instagram';
    id: string;
  } | null>(null);

  // Load dashboard from store — re-fetch when refreshKey changes
  const reload = useCallback(() => {
    return window.electron.dashboard.get().then(d => {
      setDashboard(d);
      onDashboardChanged?.(d.clusters);
    });
  }, [onDashboardChanged]);

  useEffect(() => {
    reload();
  }, [refreshKey, reload]);

  // Build preview map — show last message for ALL conversations (not just unanswered)
  const unreadMap = useMemo(() => {
    const map = new Map<string, UnreadInfo>();

    for (const conv of conversations) {
      if (conv.lastMessage) {
        map.set(`imessage-${conv.id}`, { text: conv.lastMessage, count: 1 });
      }
    }

    for (const thread of gmailThreads) {
      const lastMsg = thread.messages[thread.messages.length - 1];
      if (lastMsg) {
        map.set(`gmail-${thread.id}`, {
          text: lastMsg.snippet || lastMsg.subject || 'Email',
          count: 1,
        });
      }
    }

    for (const conv of instagramConversations) {
      if (conv.lastMessage?.text) {
        map.set(`instagram-${conv.id}`, {
          text: conv.lastMessage.text,
          count: 1,
        });
      }
    }

    return map;
  }, [conversations, gmailThreads, instagramConversations]);

  // Build name lookup map
  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const conv of conversations) {
      map.set(`imessage-${conv.id}`, conv.contactName || conv.displayName || conv.handleId || 'Unknown');
    }
    for (const thread of gmailThreads) {
      map.set(`gmail-${thread.id}`, thread.messages[0]?.subject || 'No Subject');
    }
    for (const conv of instagramConversations) {
      map.set(`instagram-${conv.id}`, conv.recipientName || `@${conv.recipientUsername}`);
    }
    return map;
  }, [conversations, gmailThreads, instagramConversations]);

  // Build set of already-pinned IDs
  const pinnedIds = useMemo(() => {
    if (!dashboard) return new Set<string>();
    const ids = new Set<string>();
    for (const pin of dashboard.unclusteredPins) ids.add(`${pin.source}-${pin.id}`);
    for (const cluster of dashboard.clusters) {
      for (const pin of cluster.pins) ids.add(`${pin.source}-${pin.id}`);
    }
    return ids;
  }, [dashboard]);

  const handleClickPin = (source: 'imessage' | 'gmail' | 'instagram', id: string) => {
    if (source === 'imessage') onSelectImessage(Number(id));
    else if (source === 'gmail') onSelectGmailThread(id);
    else if (source === 'instagram') onSelectInstagramConversation(id);
  };

  const handlePinContextMenu = (e: React.MouseEvent, source: 'imessage' | 'gmail' | 'instagram', id: string) => {
    e.preventDefault();
    setPinContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, source, id });
  };

  const handleUnpin = async (source: string, id: string) => {
    await window.electron.dashboard.unpinChat(source, id);
    reload();
    setPinContextMenu(null);
  };

  const handleMovePin = async (source: string, id: string, targetClusterId: string | null) => {
    await window.electron.dashboard.movePin(source, id, targetClusterId);
    reload();
    setPinContextMenu(null);
  };

  // Move a cluster to a new position — optimistic update, no reload
  const handleMoveCluster = (clusterId: string, position: { x: number; y: number }) => {
    if (!dashboard) return;
    const updated = {
      ...dashboard,
      clusters: dashboard.clusters.map(c =>
        c.id === clusterId ? { ...c, position } : c
      ),
    };
    setDashboard(updated);
    window.electron.dashboard.save(updated);
  };

  // Reorder pins within a cluster
  const handleReorder = async (clusterId: string, fromIndex: number, toIndex: number) => {
    if (!dashboard) return;

    const updated = { ...dashboard };
    updated.clusters = updated.clusters.map(c => {
      if (c.id === clusterId) {
        return { ...c, pins: arrayMove([...c.pins], fromIndex, toIndex) };
      }
      return c;
    });
    setDashboard(updated);
    await window.electron.dashboard.save(updated);
  };

  // Move an unclustered pin to a new position — optimistic update, no reload
  const handleMoveUnclustered = (source: string, id: string, position: { x: number; y: number }) => {
    if (!dashboard) return;
    const updated = {
      ...dashboard,
      unclusteredPins: dashboard.unclusteredPins.map(p =>
        p.source === source && p.id === id ? { ...p, position } : p
      ),
    };
    setDashboard(updated);
    window.electron.dashboard.save(updated);
  };

  // Move a pin to a different container (cluster or unclustered) — with position for unclustered drops
  const handleMovePinToContainer = async (source: string, id: string, targetClusterId: string | null, position?: { x: number; y: number }) => {
    await window.electron.dashboard.movePin(source, id, targetClusterId);
    // If moving to unclustered with a specific drop position, update the position
    if (targetClusterId === null && position && dashboard) {
      const updated = await window.electron.dashboard.get();
      const pin = updated.unclusteredPins.find(p => p.source === source && p.id === id);
      if (pin) {
        pin.position = position;
        await window.electron.dashboard.save(updated);
        setDashboard(updated);
        onDashboardChanged?.(updated.clusters);
        return;
      }
    }
    reload();
  };

  const handleAddCluster = () => {
    setEditingCluster(null);
    setClusterNameInput('');
    setClusterColorInput(CLUSTER_COLORS[Math.floor(Math.random() * CLUSTER_COLORS.length)]);
    setShowClusterForm(true);
  };

  const handleSaveCluster = async () => {
    if (!clusterNameInput.trim()) return;
    if (editingCluster) {
      await window.electron.dashboard.updateCluster(editingCluster.id, {
        name: clusterNameInput.trim(),
        color: clusterColorInput,
      });
    } else {
      await window.electron.dashboard.createCluster({
        name: clusterNameInput.trim(),
        color: clusterColorInput,
        position: { x: 0, y: 0 },
        pins: [],
      });
    }
    reload();
    setClusterNameInput('');
    setEditingCluster(null);
    setShowClusterForm(false);
  };

  const handleEditCluster = (clusterId: string) => {
    const cluster = dashboard?.clusters.find(c => c.id === clusterId);
    if (cluster) {
      setEditingCluster(cluster);
      setClusterNameInput(cluster.name);
      setClusterColorInput(cluster.color);
      setShowClusterForm(true);
    }
  };

  const handleDeleteCluster = async (clusterId: string) => {
    await window.electron.dashboard.deleteCluster(clusterId);
    reload();
  };

  const handlePin = async (source: 'imessage' | 'gmail' | 'instagram', id: string, clusterId?: string) => {
    const existing = dashboard?.unclusteredPins.length || 0;
    const col = existing % 6;
    const row = Math.floor(existing / 6);
    const pin: PinnedChat = {
      source,
      id,
      position: clusterId ? { x: 0, y: 0 } : { x: col * 130, y: row * 130 },
      addedAt: new Date().toISOString(),
    };
    await window.electron.dashboard.pinChat(pin, clusterId);
    reload();
  };

  const handleAddPinToCluster = (clusterId: string) => {
    setSearchTargetCluster(clusterId);
    setSearchModalOpen(true);
  };

  if (!dashboard) {
    return <div className="flex-1 flex items-center justify-center text-white/40">Loading...</div>;
  }

  const isEmpty = dashboard.clusters.length === 0 && dashboard.unclusteredPins.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header — minimal, recedes */}
      <div className="flex items-center justify-between px-5 py-2.5">
        <DashboardToolbar
          onAddCluster={handleAddCluster}
          onAddPin={() => { setSearchTargetCluster(undefined); setSearchModalOpen(true); }}
        />
      </div>

      {/* Cluster creation/edit form — inline, elegant */}
      {showClusterForm && (
        <div className="mx-5 mb-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center gap-3">
          <input
            autoFocus
            type="text"
            placeholder="Name this cluster..."
            value={clusterNameInput}
            onChange={e => setClusterNameInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveCluster();
              if (e.key === 'Escape') { setClusterNameInput(''); setEditingCluster(null); setShowClusterForm(false); }
            }}
            className="bg-transparent text-[13px] text-white placeholder-white/25 outline-none flex-1 min-w-0"
          />
          <ColorPicker
            value={clusterColorInput}
            onChange={setClusterColorInput}
            presets={CLUSTER_COLORS}
            size="sm"
          />
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={handleSaveCluster}
              disabled={!clusterNameInput.trim()}
              className="px-2.5 py-1 text-[11px] font-medium text-white/70 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              {editingCluster ? 'Save' : 'Create'}
            </button>
            <button
              onClick={() => { setClusterNameInput(''); setEditingCluster(null); setShowClusterForm(false); }}
              className="px-2 py-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      {isEmpty && !showClusterForm ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8">
          {/* Decorative circles — hint at what this space becomes */}
          <div className="relative w-32 h-20">
            <div className="absolute left-2 top-2 w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06]" />
            <div className="absolute left-10 top-0 w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.08]" />
            <div className="absolute right-4 top-4 w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.05]" />
          </div>
          <div>
            <p className="text-white/40 text-[13px] font-light">Pin your conversations here</p>
            <p className="text-white/20 text-[11px] mt-1.5 leading-relaxed font-light">
              Right-click any conversation in the sidebar,<br />or use the buttons above.
            </p>
          </div>
        </div>
      ) : (
        <DashboardCanvas
          clusters={dashboard.clusters}
          unclusteredPins={dashboard.unclusteredPins}
          unreadMap={unreadMap}
          nameMap={nameMap}
          onClickPin={handleClickPin}
          onPinContextMenu={handlePinContextMenu}
          onReorderPins={handleReorder}
          onMoveCluster={handleMoveCluster}
          onMovePin={handleMoveUnclustered}
          onMovePinToContainer={handleMovePinToContainer}
          onAddPinToCluster={handleAddPinToCluster}
          onEditCluster={handleEditCluster}
          onDeleteCluster={handleDeleteCluster}
        />
      )}

      {/* Pin context menu */}
      {pinContextMenu?.isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPinContextMenu(null)} />
          <div
            className="fixed z-50 bg-[#2a2a2e] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: pinContextMenu.position.x, top: pinContextMenu.position.y }}
          >
            <button
              onClick={() => handleUnpin(pinContextMenu.source, pinContextMenu.id)}
              className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Unpin
            </button>
            {dashboard.clusters.length > 0 && (
              <>
                <div className="border-t border-white/10 my-0.5" />
                <div className="px-3 py-1 text-[10px] text-white/30 uppercase tracking-wider">Move to...</div>
                <button
                  onClick={() => handleMovePin(pinContextMenu.source, pinContextMenu.id, null)}
                  className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                >
                  No cluster
                </button>
                {dashboard.clusters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleMovePin(pinContextMenu.source, pinContextMenu.id, c.id)}
                    className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* Pin search modal */}
      <PinSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        conversations={conversations}
        gmailThreads={gmailThreads}
        instagramConversations={instagramConversations}
        clusters={dashboard.clusters}
        pinnedIds={pinnedIds}
        onPin={handlePin}
        defaultClusterId={searchTargetCluster}
      />
    </div>
  );
}
