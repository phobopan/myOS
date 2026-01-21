export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  isFromMe: boolean;
  senderName?: string;
}

export interface Conversation {
  id: string;
  source: 'imessage' | 'gmail' | 'instagram';
  name: string;
  preview: string;
  lastMessageTime: Date;
  waitingDays?: number;
  messages: Message[];
  // Gmail-specific
  subject?: string;
  // Instagram-specific
  username?: string;
}
