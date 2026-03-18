import { useState, useRef, useEffect } from 'react';
import type { Tag, Cluster } from '../types';

interface FilterDropdownProps {
  tags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  clusters?: Cluster[];
  selectedClusterIds?: string[];
  onToggleCluster?: (clusterId: string) => void;
  onClearAll: () => void;
}

export function TagFilterPills({
  tags,
  selectedTagIds,
  onToggleTag,
  clusters = [],
  selectedClusterIds = [],
  onToggleCluster,
  onClearAll,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const hasTags = tags.length > 0;
  const hasClusters = clusters.length > 0;
  if (!hasTags && !hasClusters) return null;

  const totalSelected = selectedTagIds.length + selectedClusterIds.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Compact trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
          totalSelected > 0
            ? 'bg-white/15 text-white'
            : 'bg-white/5 text-white/50 hover:text-white/70 hover:bg-white/10'
        }`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span>Filter{totalSelected > 0 ? ` (${totalSelected})` : ''}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-52 glass-modal rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header with clear button */}
          {totalSelected > 0 && (
            <div className="px-2 py-1.5 border-b border-white/10 flex justify-between items-center">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">
                {totalSelected} selected
              </span>
              <button
                onClick={onClearAll}
                className="text-[10px] text-white/50 hover:text-white"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="py-1 max-h-[280px] overflow-y-auto">
            {/* Tags section */}
            {hasTags && (
              <>
                <div className="px-2 py-1 text-[10px] text-white/30 uppercase tracking-wider">
                  Tags
                </div>
                {tags.map(tag => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => onToggleTag(tag.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm text-white flex-1 text-left truncate">{tag.name}</span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Clusters section */}
            {hasClusters && onToggleCluster && (
              <>
                {hasTags && <div className="border-t border-white/10 my-1" />}
                <div className="px-2 py-1 text-[10px] text-white/30 uppercase tracking-wider">
                  Groups
                </div>
                {clusters.map(cluster => {
                  const isSelected = selectedClusterIds.includes(cluster.id);
                  return (
                    <button
                      key={cluster.id}
                      onClick={() => onToggleCluster(cluster.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cluster.color }}
                      />
                      <span className="text-sm text-white flex-1 text-left truncate">{cluster.name}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
