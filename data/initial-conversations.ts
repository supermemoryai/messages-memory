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
  const profileId = generateUserSpecificId(userId, 'profile-chat');
  const profileAssistantId = generateUserSpecificId(
    userId,
    'profile-assistant',
  );
  const profileQuestionId = generateUserSpecificId(userId, 'profile-question');
  const profileResponseId = generateUserSpecificId(userId, 'profile-response');

  return [
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
          content: 'memory graph',
          sender: 'me',
          timestamp: getTimeAgo(1),
        },
        {
          id: profileResponseId,
          content: 'Select a channel to view its memory graph.',
          sender: 'Profile',
          timestamp: getTimeAgo(0),
        },
      ],
    },
  ];
};

// Helper functions to get user-specific IDs
export const getUserSpecificProfileId = (userId: string): string =>
  generateUserSpecificId(userId, 'profile-chat');

// Legacy export for backward compatibility - but now requires userId
export const getInitialConversations = (userId: string): Conversation[] =>
  createInitialConversationsForUser(userId);
