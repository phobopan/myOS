import { useState, useEffect } from 'react';
import type { Tag } from '../types';
import { ColorPicker } from './ColorPicker';

interface TagCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tag: { name: string; importance: number; color: string }) => void;
  editTag?: Tag | null; // If provided, we're editing instead of creating
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

export function TagCreateModal({ isOpen, onClose, onSave, editTag }: TagCreateModalProps) {
  const [name, setName] = useState('');
  const [importance, setImportance] = useState(5);
  const [color, setColor] = useState(PRESET_COLORS[0]);

  // Reset form when opening/closing or when editTag changes
  useEffect(() => {
    if (isOpen) {
      if (editTag) {
        setName(editTag.name);
        setImportance(editTag.importance);
        setColor(editTag.color);
      } else {
        setName('');
        setImportance(5);
        setColor(PRESET_COLORS[0]);
      }
    }
  }, [isOpen, editTag]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), importance, color });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-modal w-[400px] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {editTag ? 'Edit Tag' : 'Create Tag'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Tag Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Work, Family, VIP"
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Color
            </label>
            <ColorPicker value={color} onChange={setColor} presets={PRESET_COLORS} />
          </div>

          {/* Importance */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Importance: {importance}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Preview
            </label>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-white">
                {name || 'Tag Name'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 text-sm text-white/60 hover:text-white transition-colors px-4 py-2 rounded-lg bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 text-sm text-white hover:bg-blue-600 transition-colors px-4 py-2 rounded-lg bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editTag ? 'Save Changes' : 'Create Tag'}
          </button>
        </div>
      </div>
    </div>
  );
}
