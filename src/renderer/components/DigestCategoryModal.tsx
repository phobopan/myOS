import { useState, useEffect } from 'react';
import type { DigestCategory } from '../types';
import { ColorPicker } from './ColorPicker';

interface DigestCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: { name: string; color: string; description?: string }) => void;
  editCategory?: DigestCategory | null;
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

export function DigestCategoryModal({ isOpen, onClose, onSave, editCategory }: DigestCategoryModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editCategory) {
        setName(editCategory.name);
        setColor(editCategory.color);
        setDescription(editCategory.description || '');
      } else {
        setName('');
        setColor(PRESET_COLORS[0]);
        setDescription('');
      }
    }
  }, [isOpen, editCategory]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      color,
      description: description.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative glass-modal w-[400px] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {editCategory ? 'Edit Category' : 'Create Category'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Category Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Work, Urgent, Newsletters"
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Color
            </label>
            <ColorPicker value={color} onChange={setColor} presets={PRESET_COLORS} />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hint for Claude about what emails belong here..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

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
                {name || 'Category Name'}
              </span>
            </div>
          </div>
        </div>

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
            {editCategory ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  );
}
