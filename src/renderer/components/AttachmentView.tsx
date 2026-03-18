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

  const fileSrc = `file://${attachment.path}`;

  // Format file size for display
  const sizeStr = attachment.size > 1024 * 1024
    ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
    : attachment.size > 1024
      ? `${(attachment.size / 1024).toFixed(0)} KB`
      : `${attachment.size} B`;

  // For images, show thumbnail with click to expand
  if (attachment.isImage && !error) {
    if (expanded) {
      return (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setExpanded(false)}
        >
          <img
            src={fileSrc}
            alt={attachment.filename || 'Image'}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onError={() => setError(true)}
          />
        </div>
      );
    }

    return (
      <img
        src={fileSrc}
        alt={attachment.filename || 'Image'}
        className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setExpanded(true)}
        onError={() => setError(true)}
      />
    );
  }

  // For videos, show video player with controls
  if (attachment.isVideo && !error) {
    if (expanded) {
      return (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpanded(false);
          }}
        >
          <video
            src={fileSrc}
            controls
            autoPlay
            className="max-w-[90vw] max-h-[90vh]"
            onError={() => setError(true)}
          />
        </div>
      );
    }

    return (
      <div className="relative max-w-[200px] cursor-pointer" onClick={() => setExpanded(true)}>
        <video
          src={fileSrc}
          className="max-w-[200px] max-h-[200px] rounded-lg"
          onError={() => setError(true)}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg hover:bg-black/40 transition-colors">
          <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // For audio, show audio player
  if (attachment.isAudio && !error) {
    return (
      <div className="bg-white/10 rounded-lg p-3 max-w-[280px]">
        <audio
          src={fileSrc}
          controls
          className="w-full h-8"
          onError={() => setError(true)}
        />
        <p className="text-xs text-white/50 mt-1 truncate">
          {attachment.filename || 'Audio'} ({sizeStr})
        </p>
      </div>
    );
  }

  // For other files, show file chip with icon
  const getFileIcon = () => {
    const mime = attachment.mimeType?.toLowerCase() || '';
    if (mime.includes('pdf')) return 'PDF';
    if (mime.includes('zip') || mime.includes('compressed')) return 'ZIP';
    if (mime.includes('document') || mime.includes('word')) return 'DOC';
    if (mime.includes('sheet') || mime.includes('excel')) return 'XLS';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'PPT';
    if (mime.includes('text')) return 'TXT';
    return attachment.mimeType?.split('/')[1]?.slice(0, 3).toUpperCase() || 'FILE';
  };

  return (
    <div
      className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2 max-w-[200px] cursor-pointer hover:bg-white/15 transition-colors"
      onClick={() => {
        // Open file in default app
        window.electron?.shell?.openPath?.(attachment.path!);
      }}
    >
      <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center text-xs font-medium">
        {getFileIcon()}
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
