import { useState, useRef, useEffect, useCallback } from 'react';
import type { GmailMessage } from '../types';
import { EmailAttachment } from './EmailAttachment';

interface EmailMessageProps {
  message: GmailMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isLast: boolean;
}

function formatEmailDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function extractSenderName(from: string): string {
  const match = from.match(/^([^<]+)</);
  return match ? match[1].trim() : from.replace(/[<>]/g, '');
}

function splitQuotedText(text: string): { main: string; quoted: string | null } {
  const onWroteMatch = text.match(/\n(On .+ wrote:[\s\S]*)/);
  if (onWroteMatch && onWroteMatch.index) {
    return {
      main: text.slice(0, onWroteMatch.index).trim(),
      quoted: onWroteMatch[1],
    };
  }

  const lines = text.split('\n');
  const firstQuotedIndex = lines.findIndex(l => l.startsWith('>'));
  if (firstQuotedIndex > 0) {
    return {
      main: lines.slice(0, firstQuotedIndex).join('\n').trim(),
      quoted: lines.slice(firstQuotedIndex).join('\n'),
    };
  }

  return { main: text, quoted: null };
}

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

// Sandboxed HTML email viewer using iframe
function SandboxedHtml({ html, messageId, attachments }: {
  html: string;
  messageId: string;
  attachments?: GmailMessage['attachments'];
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const adjustHeight = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc?.body) {
      const newHeight = Math.max(100, Math.min(doc.body.scrollHeight + 20, 2000));
      setHeight(newHeight);
    }
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Strategy: Set white as default text color for dark theme, but use a
    // post-render pass to restore original colors on elements that sit on a
    // visible background. This handles mixed emails (header with bg + body without).
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background: transparent !important;
              color: rgba(255, 255, 255, 0.9);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
            }
            body { padding: 0; overflow-x: hidden; }
            table { border-collapse: collapse; }
            img {
              max-width: 100%;
              height: auto;
              pointer-events: none; /* prevent click-to-navigate on linked images */
            }
            a { color: #60a5fa; cursor: pointer; }
            a img { pointer-events: none; }
            /* Hide tracking pixels */
            img[width="1"], img[height="1"],
            img[style*="display:none"], img[style*="display: none"] {
              display: none !important;
            }
            body > * { max-width: 100% !important; }
            table { max-width: 100% !important; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    doc.close();

    // --- Post-render: smart per-element color fix ---
    // Walk the DOM. For each element, check if it or an ancestor has a visible
    // background. If yes, preserve its original text color. If no, set white.
    const win = iframe.contentWindow;
    if (win) {
      const allElements = doc.body.querySelectorAll('*');

      // Build a set of elements that have a visible background
      const hasVisibleBg = new WeakSet<Element>();
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const computed = win.getComputedStyle(el);
        const bg = computed.backgroundColor;
        // Check if this element has a non-transparent background
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          hasVisibleBg.add(el);
        }
      }

      // For each text-bearing element, decide color
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i] as HTMLElement;
        // Check if this element or any ancestor has a visible background
        let onBackground = false;
        let check: Element | null = el;
        while (check && check !== doc.documentElement) {
          if (hasVisibleBg.has(check)) {
            onBackground = true;
            break;
          }
          check = check.parentElement;
        }

        if (onBackground) {
          // On a background — keep original colors (don't override)
          // Remove any white override we may have inherited
        } else {
          // No background — force white text for dark app theme
          const computed = win.getComputedStyle(el);
          const color = computed.color;
          // Only override if the color is dark (black-ish or very dark)
          if (color && isDarkColor(color)) {
            el.style.setProperty('color', 'rgba(255, 255, 255, 0.9)', 'important');
          }
        }
      }

      // Fix links: make them blue regardless
      const links = doc.querySelectorAll('a');
      links.forEach(link => {
        // Check if the link is NOT on a background
        let onBg = false;
        let check: Element | null = link;
        while (check && check !== doc.documentElement) {
          if (hasVisibleBg.has(check)) { onBg = true; break; }
          check = check.parentElement;
        }
        if (!onBg) {
          (link as HTMLElement).style.setProperty('color', '#60a5fa', 'important');
        }
      });
    }

    // --- Resolve CID inline images ---
    // Replace cid: URLs with fetched data URIs from Gmail API
    const allAttachments = attachments || [];
    const cidImages = doc.querySelectorAll('img[src^="cid:"]');
    cidImages.forEach(img => {
      const src = img.getAttribute('src');
      if (!src) return;
      const cid = src.replace('cid:', '');
      // Match by Content-ID (exact), filename, or filename stem
      const match = allAttachments.find(a =>
        a.contentId === cid ||
        a.filename === cid ||
        a.filename.split('.')[0] === cid.split('@')[0]
      );
      if (match) {
        window.electron.gmail.getAttachment(messageId, match.id).then((base64: string) => {
          img.setAttribute('src', `data:${match.mimeType};base64,${base64}`);
          (img as HTMLElement).style.pointerEvents = 'none';
          setTimeout(adjustHeight, 100);
        }).catch(() => {
          (img as HTMLElement).style.display = 'none';
        });
      }
    });

    // --- Intercept link clicks → open in system browser ---
    doc.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
        const href = anchor.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
          window.electron.shell.openExternal(href);
        }
      }
    });

    // --- Height adjustment ---
    const images = doc.querySelectorAll('img');
    let loadedCount = 0;
    const totalImages = images.length;

    if (totalImages === 0) {
      adjustHeight();
    } else {
      images.forEach(img => {
        if (img.complete) {
          loadedCount++;
          if (loadedCount === totalImages) adjustHeight();
        } else {
          img.onload = () => { loadedCount++; if (loadedCount === totalImages) adjustHeight(); };
          img.onerror = () => {
            // Hide broken images gracefully
            (img as HTMLElement).style.display = 'none';
            loadedCount++;
            if (loadedCount === totalImages) adjustHeight();
          };
        }
      });
    }

    setTimeout(adjustHeight, 100);
    setTimeout(adjustHeight, 500);
    setTimeout(adjustHeight, 1500); // extra delay for slow-loading email images
  }, [html, messageId, attachments, adjustHeight]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full border-0"
      style={{ height: `${height}px`, background: 'transparent' }}
      sandbox="allow-same-origin"
      title="Email content"
    />
  );
}

/**
 * Check if a CSS color string is dark (would be invisible on a dark background).
 * Parses rgb(r, g, b) and rgba(r, g, b, a) formats.
 */
function isDarkColor(color: string): boolean {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  // Relative luminance — if below threshold, it's too dark for our dark bg
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.4;
}

export function EmailMessage({ message, isExpanded, onToggleExpand }: EmailMessageProps) {
  const [showQuoted, setShowQuoted] = useState(false);

  const senderName = extractSenderName(message.from);
  const relativeDate = formatRelativeDate(message.date);
  const fullDate = formatEmailDate(message.date);

  const bodyText = message.body.text || '';
  const { main: mainText, quoted: quotedText } = splitQuotedText(bodyText);

  if (!isExpanded) {
    return (
      <button
        onClick={onToggleExpand}
        className="w-full text-left p-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-white text-sm">
                {senderName}
              </span>
              <span className="text-xs text-white/40">
                {relativeDate}
              </span>
            </div>
            <p className="text-sm text-white/70 truncate mt-0.5">
              {message.snippet}
            </p>
          </div>
          <ChevronDownIcon />
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">From:</span>
              <span className="text-sm text-white truncate">{message.from}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">To:</span>
              <span className="text-sm text-white truncate">{message.to}</span>
            </div>
            {message.cc && (
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-white/50 uppercase tracking-wide">CC:</span>
                <span className="text-sm text-white truncate">{message.cc}</span>
              </div>
            )}
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">Date:</span>
              <span className="text-sm text-white">{fullDate}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">Subject:</span>
              <span className="text-sm text-white font-medium">{message.subject}</span>
            </div>
          </div>
          <button
            onClick={onToggleExpand}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            title="Collapse email"
          >
            <ChevronUpIcon />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {message.body.html ? (
          <SandboxedHtml
            html={message.body.html}
            messageId={message.id}
            attachments={message.attachments}
          />
        ) : (
          <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
            {mainText}
          </div>
        )}

        {quotedText && !message.body.html && (
          <div className="mt-4">
            <button
              onClick={() => setShowQuoted(!showQuoted)}
              className="text-xs text-white/50 hover:text-white/70 transition-colors"
            >
              {showQuoted ? '▼ Hide quoted text' : '▶ Show quoted text'}
            </button>
            {showQuoted && (
              <div className="mt-2 pl-4 border-l-2 border-white/10 text-white/70 text-sm whitespace-pre-wrap font-mono">
                {quotedText}
              </div>
            )}
          </div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-xs text-white/50 uppercase tracking-wide mb-3">
              Attachments ({message.attachments.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {message.attachments.map((attachment) => (
                <EmailAttachment
                  key={attachment.id}
                  attachment={attachment}
                  messageId={message.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
