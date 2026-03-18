import { useState, useEffect, useRef } from 'react';
import type { Tag, ContactIdentifier } from '../types';

interface TagAssignmentPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  contact: ContactIdentifier;
  displayName: string;
  currentTagIds: string[];
  onSave: (contact: ContactIdentifier, tagIds: string[], displayName: string) => Promise<void>;
  // Position for the popover (from click event or anchor element)
  anchorPosition?: { x: number; y: number };
}

export function TagAssignmentPopover({
  isOpen,
  onClose,
  tags,
  contact,
  displayName,
  currentTagIds,
  onSave,
  anchorPosition,
}: TagAssignmentPopoverProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds);
  const [isSaving, setIsSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Reset selected tags when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedTagIds(currentTagIds);
    }
  }, [isOpen, currentTagIds]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding the listener to avoid immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(contact, selectedTagIds, displayName);
      onClose();
    } catch (err) {
      console.error('Failed to save tags:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(selectedTagIds.sort()) !== JSON.stringify(currentTagIds.sort());

  // Calculate position - default to center if no anchor
  const style: React.CSSProperties = anchorPosition
    ? {
        position: 'fixed',
        left: Math.min(anchorPosition.x, window.innerWidth - 280),
        top: Math.min(anchorPosition.y, window.innerHeight - 400),
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };

  // Group tags by type
  const tierTags = tags.filter(t => t.type === 'tier');
  const customTags = tags.filter(t => t.type === 'custom');

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Popover */}
      <div
        ref={popoverRef}
        className="glass-modal w-64 rounded-xl overflow-hidden shadow-xl"
        style={style}
      >
        {/* Header */}
        <div className="p-3 border-b border-white/10">
          <div className="text-sm font-medium text-white truncate">{displayName}</div>
          <div className="text-xs text-white/50 mt-0.5">Manage tags</div>
        </div>

        {/* Tag list */}
        <div className="p-2 max-h-[300px] overflow-y-auto">
          {/* Tier tags */}
          {tierTags.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] text-white/40 uppercase tracking-wider px-2 mb-1">
                Priority Tiers
              </div>
              {tierTags.map(tag => (
                <TagCheckbox
                  key={tag.id}
                  tag={tag}
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
              ))}
            </div>
          )}

          {/* Custom tags */}
          {customTags.length > 0 && (
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider px-2 mb-1">
                Custom Tags
              </div>
              {customTags.map(tag => (
                <TagCheckbox
                  key={tag.id}
                  tag={tag}
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
              ))}
            </div>
          )}

          {tags.length === 0 && (
            <div className="text-sm text-white/40 text-center py-4">
              No tags available. Create tags in Settings.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-white/10 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-xs text-white/60 hover:text-white px-3 py-1.5 rounded bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex-1 text-xs text-white px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TagCheckbox({
  tag,
  checked,
  onChange,
}: {
  tag: Tag;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          checked ? 'border-blue-500 bg-blue-500' : 'border-white/30'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: tag.color }}
      />
      <span className="text-sm text-white flex-1 text-left">{tag.name}</span>
    </button>
  );
}
