import type { Conversation } from '../types';
import { createHash } from 'crypto';

// Helper function to create a timestamp for a specific time ago
const getTimeAgo = (minutes: number) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

// Generate deterministic but user-specific UUIDs using secure hash
const generateUserSpecificId = (userId: string, suffix: string): string => {
  const hash = createHash('sha256').update(`${userId}-${suffix}`).digest('hex');
  // Convert to UUID format: 8-4-4-4-12
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join('-');
};

// Factory function to create user-specific initial conversations
export const createInitialConversationsForUser = (
  userId: string,
): Conversation[] => {
  // Generate user-specific IDs - deterministic but unique per user
  const supermemoryId = generateUserSpecificId(userId, 'supermemory-chat');
  const profileId = generateUserSpecificId(userId, 'profile-chat');
  const supermemoryAssistantId = generateUserSpecificId(
    userId,
    'supermemory-assistant',
  );
  const profileAssistantId = generateUserSpecificId(
    userId,
    'profile-assistant',
  );
  const welcomeMessageId = generateUserSpecificId(userId, 'welcome-message');
  const profileQuestionId = generateUserSpecificId(userId, 'profile-question');
  const profileResponseId = generateUserSpecificId(userId, 'profile-response');

  return [
    {
      id: supermemoryId,
      recipients: [
        {
          id: supermemoryAssistantId,
          name: 'Supermemory',
          bio: 'Your AI-powered memory assistant',
          title: 'AI Assistant',
        },
      ],
      lastMessageTime: getTimeAgo(1),
      unreadCount: 0,
      pinned: true,
      messages: [
        {
          id: welcomeMessageId,
          content:
            "hey dude, what's up? I'm a chatbot made by [supermemory.ai](https://supermemory.ai) to show how easy it is to make chatbots like myself, using supermemory.",
          sender: 'Supermemory',
          timestamp: getTimeAgo(5),
        },
        {
          id: welcomeMessageId,
          content:
            'to get started, can you please give me your: \n- Full name\n- Email address?\nAlso, tell me a little bit about yourself!',
          sender: 'Supermemory',
          timestamp: getTimeAgo(5),
        },
      ],
    },
    {
      id: profileId,
      recipients: [
        {
          id: profileAssistantId,
          name: 'Profile',
          bio: 'Your Supermemory profile',
          title: 'Profile',
        },
      ],
      lastMessageTime: getTimeAgo(0),
      unreadCount: 0,
      pinned: true,
      messages: [
        {
          id: profileQuestionId,
          content: 'who am i',
          sender: 'me',
          timestamp: getTimeAgo(1),
        },
        {
          id: profileResponseId,
          content: 'Loading your profile...',
          sender: 'Profile',
          timestamp: getTimeAgo(0),
        },
      ],
    },
  ];
};

// Helper functions to get user-specific IDs
export const getUserSpecificSupermemoryId = (userId: string): string =>
  generateUserSpecificId(userId, 'supermemory-chat');

export const getUserSpecificProfileId = (userId: string): string =>
  generateUserSpecificId(userId, 'profile-chat');

// Legacy export for backward compatibility - but now requires userId
export const getInitialConversations = (userId: string): Conversation[] =>
  createInitialConversationsForUser(userId);
