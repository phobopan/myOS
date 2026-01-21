import { useState, useEffect, useRef } from 'react';
import type { IMessageConversation, IMessageMessage } from '../types';
import { MessageBubble } from './MessageBubble';

function IMessageIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    </div>
  );
}

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) return 'Today';
  if (messageDate.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function getDisplayName(conv: IMessageConversation): string {
  if (conv.contactName) return conv.contactName;
  if (conv.displayName) return conv.displayName;
  if (conv.isGroup && conv.participants && conv.participants.length > 0) {
    return conv.participants.join(', ');
  }
  return conv.handleId || 'Unknown';
}

interface ThreadViewProps {
  conversation: IMessageConversation | null;
}

export function ThreadView({ conversation }: ThreadViewProps) {
  const [messages, setMessages] = useState<IMessageMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversation) {
      loadMessages(conversation.id);
    } else {
      setMessages([]);
    }
  }, [conversation?.id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (chatId: number) => {
    setLoading(true);
    try {
      const msgs = await window.electron.imessage.getMessages(chatId, 100);
      // Messages come DESC, reverse for chronological display
      setMessages(msgs.reverse());
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
    setLoading(false);
  };

  if (!conversation) {
    return (
      <main className="flex-1 h-full flex flex-col p-4">
        <div className="widget-bubble-large flex-1 flex items-center justify-center text-white/30">
          <div className="text-center">
            <div className="text-4xl mb-3">Select a conversation</div>
            <p className="text-sm text-white/40">
              Choose a message from the sidebar to view the thread
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Group messages by date for separators
  const messagesByDate: { date: string; messages: IMessageMessage[] }[] = [];
  let currentDate = '';

  for (const msg of messages) {
    const dateStr = formatDateSeparator(msg.date);
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      messagesByDate.push({ date: dateStr, messages: [] });
    }
    messagesByDate[messagesByDate.length - 1].messages.push(msg);
  }

  return (
    <main className="flex-1 h-full flex flex-col p-4">
      <div className="widget-bubble-large flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <IMessageIcon />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white truncate">
              {getDisplayName(conversation)}
            </h2>
            {conversation.isGroup && (
              <p className="text-sm text-white/50">
                Group Chat
              </p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center text-white/40">Loading messages...</div>
          ) : (
            messagesByDate.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">
                    {group.date}
                  </span>
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {group.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      content={message.text}
                      isFromMe={message.isFromMe}
                      senderName={message.senderName}
                      timestamp={message.date}
                      attachments={message.attachments}
                      reactions={message.reactions}
                      showSender={conversation.isGroup}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer placeholder - will be functional in Plan 05 */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-colors"
            />
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
