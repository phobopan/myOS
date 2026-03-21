import { memo, useState, type ReactNode } from 'react';
import type { Digest, DigestCategory, DigestEmailItem, DigestImessageItem, GmailThread, IMessageConversation } from '../types';

interface DigestViewProps {
  digest: Digest | null;
  categories: DigestCategory[];
  generating: boolean;
  claudeConfigured: boolean;
  onRegenerate: () => void;
  onOpenSettings: () => void;
  onSelectGmailThread: (threadId: string) => void;
  onSelectImessageConversation: (id: number) => void;
  conversations: IMessageConversation[];
  repliedThreadIds?: Set<string>;
  dismissedThreadIds?: Set<string>;
  onDismissThread?: (id: string, source: 'imessage' | 'gmail' | 'instagram', activityKey: string) => void;
  gmailThreads?: GmailThread[];
}

export const DigestView = memo(function DigestView({
  digest,
  categories,
  generating,
  claudeConfigured,
  onRegenerate,
  onOpenSettings,
  onSelectGmailThread,
  onSelectImessageConversation,
  conversations,
  repliedThreadIds = new Set(),
  dismissedThreadIds = new Set(),
  onDismissThread,
  gmailThreads = [],
}: DigestViewProps) {
  const [digestTab, setDigestTab] = useState<'imessage' | 'gmail'>('imessage');

  // Not configured state
  if (!claudeConfigured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8">
        <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
        <div>
          <p className="text-white/40 text-[13px] font-light">AI provider not configured</p>
          <p className="text-white/20 text-[11px] mt-1.5 leading-relaxed font-light">
            Set up an AI provider in Settings to<br />generate digests of your messages.
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="text-[12px] text-white/50 hover:text-white/70 transition-colors px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1]"
        >
          Open Settings
        </button>
      </div>
    );
  }

  // Generating state (no previous digest)
  if (generating && !digest) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <DigestHeader generating={true} generatedAt={null} onRegenerate={onRegenerate} />
        <div className="flex-1 p-4 space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/4 mb-3" />
              <div className="space-y-2 ml-1">
                <div className="h-10 bg-white/5 rounded-lg" />
                <div className="h-10 bg-white/5 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No digest generated yet
  if (!digest) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8">
        <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
        <div>
          <p className="text-white/40 text-[13px] font-light">Generate your daily digest</p>
          <p className="text-white/20 text-[11px] mt-1.5 leading-relaxed font-light">
            AI will triage your unreplied messages<br />into categories with priority and action notes.
          </p>
        </div>
        <button
          onClick={onRegenerate}
          className="text-[12px] text-white/50 hover:text-white/70 transition-colors px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1]"
        >
          Generate Digest
        </button>
      </div>
    );
  }

  // Error state
  if (digest.status === 'error') {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <DigestHeader generating={false} generatedAt={digest.generatedAt} onRegenerate={onRegenerate} />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8">
          <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] max-w-md">
            <p className="text-[12px] text-white/40">{digest.error || 'Failed to generate digest'}</p>
          </div>
          <button
            onClick={onRegenerate}
            className="text-[12px] text-white/50 hover:text-white/70 transition-colors px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ============ Categorize items: active vs dealt-with ============

  // Helper: check if an iMessage item has been replied to (auto-detect from live data)
  const isImessageReplied = (item: DigestImessageItem): boolean => {
    const conv = conversations.find(c => c.id === item.conversationId);
    if (!conv) return true; // conversation gone from list
    if (conv.isFromMe) return true; // user replied since digest
    return false;
  };

  // Helper: check if a Gmail item has been replied to
  const isGmailReplied = (item: DigestEmailItem): boolean => {
    if (repliedThreadIds.has(item.threadId)) return true;
    const thread = gmailThreads.find(t => t.id === item.threadId);
    if (thread) {
      const lastMsg = thread.messages[thread.messages.length - 1];
      if (lastMsg?.labelIds?.includes('SENT')) return true;
    }
    return false;
  };

  // Build set of "dealt with" IDs (replied OR dismissed) — these show crossed out
  const dealtWithImessageIds = new Set<string>();
  const dealtWithGmailIds = new Set<string>();

  // iMessage: filter out dismissed (hide completely), mark replied as dealt-with
  const imessageItems = (digest.imessageItems || [])
    .filter(item => !dismissedThreadIds.has(String(item.conversationId)));
  for (const item of imessageItems) {
    if (isImessageReplied(item)) dealtWithImessageIds.add(String(item.conversationId));
  }
  // Sort: active first, dealt-with last
  const activeImessageItems = imessageItems.filter(item => !dealtWithImessageIds.has(String(item.conversationId)));
  const dealtImessageItems = imessageItems.filter(item => dealtWithImessageIds.has(String(item.conversationId)));
  const sortedImessageItems = [...activeImessageItems, ...dealtImessageItems];

  const imessageSummary = digest.imessageSummary || '';

  // Gmail: filter out dismissed (hide completely), mark replied as dealt-with
  const allEmailItems = digest.emailItems
    .filter(item => !dismissedThreadIds.has(item.threadId));
  for (const item of allEmailItems) {
    if (isGmailReplied(item)) dealtWithGmailIds.add(item.threadId);
  }
  const activeEmailItems = allEmailItems.filter(item => !dealtWithGmailIds.has(item.threadId));
  const dealtEmailItems = allEmailItems.filter(item => dealtWithGmailIds.has(item.threadId));

  const totalActive = activeImessageItems.length + activeEmailItems.length;

  // Empty — genuinely all caught up (both sources, no items at all including dismissed)
  if (digest.emailItems.length === 0 && (digest.imessageItems || []).length === 0) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <DigestHeader generating={generating} generatedAt={digest.generatedAt} onRegenerate={onRegenerate} />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">All caught up!</h3>
          <p className="text-sm text-white/50">No unreplied messages or emails.</p>
        </div>
      </div>
    );
  }

  // All active items handled and no summary — show "all caught up" but still render dismissed below
  const showAllCaughtUpBanner = totalActive === 0 && !imessageSummary;

  // ============ Main digest view ============

  // Group email items by categoryId (active + dismissed together)
  const categoryMap = new Map<string, DigestCategory>();
  for (const c of categories) categoryMap.set(c.id, c);
  const MISC_ID = '__miscellaneous__';
  if (!categoryMap.has(MISC_ID) && allEmailItems.some(i => i.categoryId === MISC_ID)) {
    categoryMap.set(MISC_ID, { id: MISC_ID, name: 'Miscellaneous', color: '#6b7280' });
  }

  // Group: active items first, then dealt-with items per category
  const grouped = new Map<string, DigestEmailItem[]>();
  for (const item of activeEmailItems) {
    const list = grouped.get(item.categoryId) || [];
    list.push(item);
    grouped.set(item.categoryId, list);
  }
  // Append dealt-with at end of each category
  for (const item of dealtEmailItems) {
    const list = grouped.get(item.categoryId) || [];
    list.push(item);
    grouped.set(item.categoryId, list);
  }

  const allCategoryIds = [...categoryMap.keys()];

  const hasImessage = sortedImessageItems.length > 0 || imessageSummary;
  const hasGmail = allEmailItems.length > 0 || allCategoryIds.length > 0;
  const showTabs = hasImessage && hasGmail;

  // Build set of dealt-with conversation IDs for summary paragraph rendering
  const dealtConvIds = new Set(dealtWithImessageIds);

  // Parse <<conversationId:Name>> markers in iMessage summary into clickable elements
  // Dismissed conversations render with strikethrough instead of clickable
  const renderImessageParagraph = (text: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    const regex = /<<(\d+):([^>]+)>>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const convId = parseInt(match[1], 10);
      const name = match[2];
      const isDealtWith = dealtConvIds.has(convId);

      if (isDealtWith) {
        parts.push(
          <span
            key={`link-${convId}-${match.index}`}
            className="line-through text-white/30"
          >
            {name}
          </span>
        );
      } else {
        parts.push(
          <button
            key={`link-${convId}-${match.index}`}
            onClick={() => onSelectImessageConversation(convId)}
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors font-medium"
          >
            {name}
          </button>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <DigestHeader generating={generating} generatedAt={digest.generatedAt} onRegenerate={onRegenerate} />

      {/* All caught up banner (when all active are done but dismissed remain) */}
      {showAllCaughtUpBanner && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm text-green-400 font-medium">All caught up!</span>
        </div>
      )}

      {/* Source toggle tabs */}
      {showTabs && (
        <div className="flex px-4 pt-3 pb-0 gap-1">
          <button
            onClick={() => setDigestTab('imessage')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              digestTab === 'imessage'
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            iMessage
          </button>
          <button
            onClick={() => setDigestTab('gmail')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              digestTab === 'gmail'
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            Gmail
            <span className="ml-1.5 text-[10px] opacity-60">{activeEmailItems.length}</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-5">
        {/* ============ iMessage Section ============ */}
        {hasImessage && (!showTabs || digestTab === 'imessage') && (
          <div>
            {/* Summary paragraph */}
            {imessageSummary && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/15 px-4 py-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Summary</h3>
                </div>
                <div className="text-sm text-white/70 leading-relaxed space-y-2">
                  {imessageSummary.split(/\n\n+/).map((para, i) => (
                    <p key={i}>{renderImessageParagraph(para)}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation list */}
            {sortedImessageItems.length > 0 ? (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Conversations</h3>
                </div>
                <div className="space-y-0.5">
                  {sortedImessageItems.map((item) => {
                    const isDealt = dealtWithImessageIds.has(String(item.conversationId));
                    return (
                      <div
                        key={item.conversationId}
                        className={`relative flex items-start gap-0 group ${isDealt ? 'opacity-40' : ''}`}
                      >
                        {onDismissThread && !isDealt && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismissThread(String(item.conversationId), 'imessage', item.lastMessage || '');
                            }}
                            className="flex-shrink-0 w-7 h-7 mt-1.5 flex items-center justify-center rounded transition-colors text-transparent group-hover:text-white/30 hover:!text-green-400/70"
                            title="Mark as Done"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        {isDealt && (
                          <div className="flex-shrink-0 w-7 h-7 mt-1.5 flex items-center justify-center text-green-400/70">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                        <div
                          className={`flex-1 min-w-0 text-left px-2 py-2 rounded-lg flex items-start gap-3 ${
                            isDealt ? 'cursor-default' : 'hover:bg-white/5 transition-colors cursor-pointer'
                          }`}
                          onClick={isDealt ? undefined : () => onSelectImessageConversation(item.conversationId)}
                        >
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium break-words ${isDealt ? 'line-through text-white/50' : 'text-white/90'}`}>
                              {item.contactName}
                            </span>
                            {item.note && (
                              <div className={`text-xs mt-0.5 ${isDealt ? 'line-through text-white/25' : 'text-white/45'}`}>
                                {item.note}
                              </div>
                            )}
                          </div>
                          {!isDealt && (
                            <svg
                              className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors mt-1 flex-shrink-0"
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : !imessageSummary ? (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/15 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Messages</h3>
                </div>
                <p className="text-sm text-white/40 italic">All caught up!</p>
              </div>
            ) : null}
          </div>
        )}

        {/* ============ Gmail Section ============ */}
        {hasGmail && (!showTabs || digestTab === 'gmail') && allCategoryIds.map(categoryId => {
          const category = categoryMap.get(categoryId)!;
          const items = grouped.get(categoryId) || [];

          return (
            <section key={categoryId}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
                  {category.name}
                </h3>
              </div>

              {items.length === 0 ? (
                <div className="pl-4 py-1">
                  <p className="text-xs text-white/30 italic">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isDealt = dealtWithGmailIds.has(item.threadId);
                    return (
                      <div
                        key={item.threadId}
                        className={`relative flex items-start gap-0 group ${isDealt ? 'opacity-40' : ''}`}
                      >
                        {onDismissThread && !isDealt && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const thread = gmailThreads.find(t => t.id === item.threadId);
                              const lastMsg = thread?.messages[thread.messages.length - 1];
                              const activityKey = lastMsg?.id || '';
                              onDismissThread(item.threadId, 'gmail', activityKey);
                            }}
                            className="flex-shrink-0 w-7 h-7 mt-1.5 flex items-center justify-center rounded transition-colors text-transparent group-hover:text-white/30 hover:!text-green-400/70"
                            title="Mark as Done"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        {isDealt && (
                          <div className="flex-shrink-0 w-7 h-7 mt-1.5 flex items-center justify-center text-green-400/70">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                        <div
                          className={`flex-1 min-w-0 text-left px-2 py-2 rounded-lg flex items-start gap-3 ${
                            isDealt ? 'cursor-default' : 'hover:bg-white/5 transition-colors cursor-pointer'
                          }`}
                          onClick={isDealt ? undefined : () => onSelectGmailThread(item.threadId)}
                        >
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium break-words ${isDealt ? 'line-through text-white/50' : 'text-white/90'}`}>
                              &ldquo;{item.subject}&rdquo;
                            </span>
                            {item.note && (
                              <div className={`text-xs mt-0.5 ${isDealt ? 'line-through text-white/25' : 'text-white/45'}`}>
                                {item.note}
                              </div>
                            )}
                          </div>
                          {!isDealt && (
                            <svg
                              className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors mt-1 flex-shrink-0"
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
});

function DigestHeader({
  generating,
  generatedAt,
  onRegenerate,
}: {
  generating: boolean;
  generatedAt: Date | null;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-white/10 min-w-0">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-white truncate">Daily Digest</h2>
        {generatedAt && (
          <div className="text-xs text-white/40 mt-0.5">
            Updated {formatDigestTime(new Date(generatedAt))}
          </div>
        )}
      </div>
      <button
        onClick={onRegenerate}
        disabled={generating}
        className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/10 disabled:opacity-50"
      >
        <svg
          className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {generating ? 'Generating...' : 'Regenerate'}
      </button>
    </div>
  );
}

function formatDigestTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
