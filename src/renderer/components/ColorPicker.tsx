import { useState, useRef } from 'react';

const DEFAULT_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  size?: 'sm' | 'md';
}

export function ColorPicker({ value, onChange, presets = DEFAULT_PRESETS, size = 'md' }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const nativeRef = useRef<HTMLInputElement>(null);

  const isPreset = presets.includes(value);
  const circleSize = size === 'sm' ? 'w-4 h-4' : 'w-8 h-8';
  const gap = size === 'sm' ? 'gap-1' : 'gap-2';

  const handleHexChange = (hex: string) => {
    setHexInput(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setHexInput(hex);
    onChange(hex);
  };

  return (
    <div className={`flex ${gap} flex-wrap items-center`}>
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => { onChange(c); setShowCustom(false); setHexInput(c); }}
          className={`${circleSize} rounded-full transition-all ${
            value === c
              ? size === 'sm'
                ? 'scale-125 ring-1 ring-white/40'
                : 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110'
              : size === 'sm'
                ? 'opacity-50 hover:opacity-100 hover:scale-110'
                : 'hover:scale-105'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}

      {/* Custom color button */}
      <button
        type="button"
        onClick={() => setShowCustom(!showCustom)}
        className={`${circleSize} rounded-full transition-all border-2 border-dashed flex items-center justify-center ${
          !isPreset && value
            ? 'border-white/40 scale-110'
            : 'border-white/20 hover:border-white/40'
        }`}
        style={!isPreset && value ? { backgroundColor: value } : undefined}
        title="Custom color"
      >
        {(isPreset || !value) && (
          <svg className={size === 'sm' ? 'w-2 h-2' : 'w-3.5 h-3.5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        )}
      </button>

      {/* Custom color popover */}
      {showCustom && (
        <div className="flex items-center gap-2 ml-1">
          <input
            ref={nativeRef}
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#3b82f6'}
            onChange={handleNativeChange}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
            title="Open color picker"
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            onBlur={() => {
              if (!/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
                setHexInput(value);
              }
            }}
            placeholder="#000000"
            className="w-[80px] px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-white/40 font-mono"
            maxLength={7}
          />
        </div>
      )}
    </div>
  );
}
