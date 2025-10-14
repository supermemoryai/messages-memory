import type { Conversation } from "../types";

// Helper function to create a timestamp for a specific time ago
const getTimeAgo = (minutes: number) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

// Fixed UUID for the Supermemory chat - using a consistent UUID so the conversation persists
const SUPERMEMORY_CHAT_ID = "00000000-0000-0000-0000-000000000001";

// Fixed UUID for the Profile chat - read-only chat showing user profile
const PROFILE_CHAT_ID = "00000000-0000-0000-0000-000000000002";

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
  {
    id: PROFILE_CHAT_ID,
    recipients: [
      {
        id: "profile-assistant",
        name: "Profile",
        bio: "Your Supermemory profile",
        title: "Profile",
      },
    ],
    lastMessageTime: getTimeAgo(0),
    unreadCount: 0,
    pinned: true,
    messages: [
      {
        id: "profile-question",
        content: "who am i",
        sender: "You",
        timestamp: getTimeAgo(1),
      },
      {
        id: "profile-response",
        content: "Loading your profile...",
        sender: "Profile",
        timestamp: getTimeAgo(0),
      },
    ],
  },
];

// Export the constants for use in other files
export { SUPERMEMORY_CHAT_ID, PROFILE_CHAT_ID };