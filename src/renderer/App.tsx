import { useState } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { ThreadView } from './components/ThreadView';
import { Settings } from './components/Settings';
import { Conversation } from './types';

// Dummy data for preview
const dummyConversations: Conversation[] = [
  {
    id: '1',
    source: 'imessage',
    name: 'Mom',
    preview: 'Are you coming to dinner on Sunday?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    waitingDays: 3,
    messages: [
      {
        id: '1a',
        content: 'Hi sweetie! How are you doing?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 74),
        isFromMe: false,
        senderName: 'Mom',
      },
      {
        id: '1b',
        content: 'Good! Just been busy with work',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 73),
        isFromMe: true,
      },
      {
        id: '1c',
        content: 'Are you coming to dinner on Sunday? Dad is making his famous lasagna',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
        isFromMe: false,
        senderName: 'Mom',
      },
    ],
  },
  {
    id: '2',
    source: 'gmail',
    name: 'Sarah Chen',
    preview: 'Re: Q4 Planning Meeting - Can we reschedule to Thursday?',
    subject: 'Re: Q4 Planning Meeting',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    messages: [
      {
        id: '2a',
        content: 'Hi team,\n\nI wanted to follow up on our Q4 planning discussion. Can we schedule a meeting for next week?\n\nBest,\nSarah',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        isFromMe: false,
        senderName: 'Sarah Chen',
      },
      {
        id: '2b',
        content: 'Hi Sarah,\n\nTuesday at 2pm works for me. Does that work for everyone else?\n\nThanks',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20),
        isFromMe: true,
      },
      {
        id: '2c',
        content: 'Tuesday is tough for me - I have back-to-back meetings. Can we reschedule to Thursday instead? Same time works.\n\nThanks,\nSarah',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        isFromMe: false,
        senderName: 'Sarah Chen',
      },
    ],
  },
  {
    id: '3',
    source: 'instagram',
    name: 'Alex Rivera',
    username: 'alex.creates',
    preview: 'Loved your latest post! Would you be interested in a collab?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    waitingDays: 2,
    messages: [
      {
        id: '3a',
        content: 'Hey! I\'ve been following your work for a while and I absolutely love your style',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50),
        isFromMe: false,
        senderName: 'Alex Rivera',
      },
      {
        id: '3b',
        content: 'Loved your latest post! Would you be interested in a collab? I think our audiences would really vibe together',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
        isFromMe: false,
        senderName: 'Alex Rivera',
      },
    ],
  },
  {
    id: '4',
    source: 'imessage',
    name: 'Jake',
    preview: 'yo you still down for basketball tmrw?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    messages: [
      {
        id: '4a',
        content: 'yo you still down for basketball tmrw?',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        isFromMe: false,
        senderName: 'Jake',
      },
    ],
  },
  {
    id: '5',
    source: 'gmail',
    name: 'Newsletter - The Verge',
    preview: 'Your daily tech digest is here',
    subject: 'The Verge Daily: Apple announces new MacBook',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    messages: [
      {
        id: '5a',
        content: 'Good morning!\n\nHere are today\'s top tech stories:\n\n• Apple announces new MacBook Pro with M4 chip\n• Google updates Chrome with AI features\n• Tesla recalls 50,000 vehicles\n\nRead more at theverge.com',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        isFromMe: false,
        senderName: 'The Verge',
      },
    ],
  },
];

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedConversation = dummyConversations.find(c => c.id === selectedId) || null;

  return (
    <div
      className="h-screen flex flex-col text-white"
      style={{
        background: 'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
      }}
    >
      <Titlebar onSettingsClick={() => setSettingsOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          conversations={dummyConversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ThreadView conversation={selectedConversation} />
      </div>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
