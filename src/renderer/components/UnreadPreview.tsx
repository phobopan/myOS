interface UnreadPreviewProps {
  text: string;
}

export function UnreadPreview({ text }: UnreadPreviewProps) {
  // Single line, truncated — matches iMessage compact preview
  const truncated = text.length > 30 ? text.slice(0, 28) + '...' : text;

  return (
    <div className="unread-badge relative">
      {truncated}
    </div>
  );
}
