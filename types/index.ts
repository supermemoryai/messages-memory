export interface Attachment {
  url: string;
  name: string;
  contentType: string;
}

export interface Message {
  id: string;
  content: string;
  htmlContent?: string;
  sender: 'me' | 'system' | string;
  timestamp: string;
  type?: 'silenced';
  mentions?: { id: string; name: string }[];
  reactions?: Reaction[];
  attachments?: Attachment[];
  form?: {
    id: string;
    title: string;
    description?: string;
    fields: {
      id: string;
      label: string;
      type: 'text' | 'email' | 'textarea' | 'number' | 'select';
      required: boolean;
      placeholder?: string;
      options?: string[];
    }[];
  };
}

export interface Conversation {
  id: string;
  name?: string;
  recipients: Recipient[];
  messages: Message[];
  lastMessageTime: string;
  unreadCount: number;
  pinned?: boolean;
  isTyping?: boolean;
  hideAlerts?: boolean;
}

export interface Recipient {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  title?: string;
}

export type ReactionType =
  | 'heart'
  | 'like'
  | 'dislike'
  | 'laugh'
  | 'emphasize'
  | 'question';

export interface Reaction {
  type: ReactionType;
  sender: string;
  timestamp: string;
  splitIndex?: number; // Track which split part this reaction belongs to
}
