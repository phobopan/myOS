import { Conversation } from '../types';

// Source icons (duplicated for now, can refactor to shared later)
function IMessageIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    </div>
  );
}

function GmailIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
      </svg>
    </div>
  );
}

function InstagramIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    </div>
  );
}

function SourceIcon({ source }: { source: Conversation['source'] }) {
  switch (source) {
    case 'imessage':
      return <IMessageIcon />;
    case 'gmail':
      return <GmailIcon />;
    case 'instagram':
      return <InstagramIcon />;
  }
}

function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface ThreadViewProps {
  conversation: Conversation | null;
}

export function ThreadView({ conversation }: ThreadViewProps) {
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

  return (
    <main className="flex-1 h-full flex flex-col p-4">
      <div className="widget-bubble-large flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <SourceIcon source={conversation.source} />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white truncate">
              {conversation.name}
            </h2>
            {conversation.subject && (
              <p className="text-sm text-white/50 truncate">
                {conversation.subject}
              </p>
            )}
            {conversation.username && (
              <p className="text-sm text-white/50">
                @{conversation.username}
              </p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isFromMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  message.isFromMe
                    ? 'bg-blue-500/80 text-white'
                    : 'bg-white/10 text-white'
                }`}
              >
                {!message.isFromMe && message.senderName && (
                  <p className="text-xs text-white/60 mb-1">
                    {message.senderName}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.isFromMe ? 'text-white/60' : 'text-white/40'
                }`}>
                  {formatMessageTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
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
