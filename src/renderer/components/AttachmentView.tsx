import { useState } from 'react';
import type { Attachment } from '../types';

interface AttachmentViewProps {
  attachment: Attachment;
}

export function AttachmentView({ attachment }: AttachmentViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);

  if (!attachment.path) {
    return (
      <div className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white/60">
        Attachment unavailable
      </div>
    );
  }

  // For images, show thumbnail with click to expand
  if (attachment.isImage && !error) {
    const imageSrc = `file://${attachment.path}`;

    if (expanded) {
      return (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setExpanded(false)}
        >
          <img
            src={imageSrc}
            alt={attachment.filename || 'Image'}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onError={() => setError(true)}
          />
        </div>
      );
    }

    return (
      <img
        src={imageSrc}
        alt={attachment.filename || 'Image'}
        className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setExpanded(true)}
        onError={() => setError(true)}
      />
    );
  }

  // For non-images, show file chip
  const sizeStr = attachment.size > 1024 * 1024
    ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
    : attachment.size > 1024
      ? `${(attachment.size / 1024).toFixed(0)} KB`
      : `${attachment.size} B`;

  return (
    <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2 max-w-[200px]">
      <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center text-xs">
        {attachment.mimeType?.split('/')[1]?.slice(0, 3).toUpperCase() || 'FILE'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          {attachment.filename || 'Attachment'}
        </p>
        <p className="text-xs text-white/50">{sizeStr}</p>
      </div>
    </div>
  );
}
