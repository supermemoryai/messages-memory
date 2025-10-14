import { Conversation } from "../types";

// Helper function to create a timestamp for a specific time ago
const getTimeAgo = (minutes: number) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

// Fixed UUID for the Supermemory chat - using a consistent UUID so the conversation persists
const SUPERMEMORY_CHAT_ID = "00000000-0000-0000-0000-000000000001";

// Create initial conversation with Supermemory
export const initialConversations: Conversation[] = [
  {
    id: SUPERMEMORY_CHAT_ID,
    recipients: [
      {
        id: "supermemory-ai",
        name: "Supermemory",
        bio: "Your AI-powered memory assistant",
        title: "AI Assistant",
      },
    ],
    lastMessageTime: getTimeAgo(1),
    unreadCount: 0,
    pinned: true,
    messages: [
      {
        id: "welcome-message",
        content: "Hello! I'm Supermemory, your AI-powered memory assistant. I can help you remember, organize, and find information. What would you like to know or discuss today?",
        sender: "Supermemory",
        timestamp: getTimeAgo(5),
      },
    ],
  },
];

// Export the constant for use in other files
export { SUPERMEMORY_CHAT_ID };