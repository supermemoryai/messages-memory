import type { Conversation } from '../types';
import { createHash } from 'crypto';

// Helper function to create a timestamp for a specific time ago
const getTimeAgo = (minutes: number) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

// Generate deterministic but user-specific UUIDs using secure hash
const generateWorkspaceSpecificId = (userId: string, suffix: string): string => {
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

// Factory function to create workspace-specific initial conversations
export const createInitialConversationsForWorkspace = (
  workspaceId: string,
): Conversation[] => {
  const profileId = generateWorkspaceSpecificId(workspaceId, 'profile-chat');
  const profileAssistantId = generateWorkspaceSpecificId(
    workspaceId,
    'profile-assistant',
  );
  const profileQuestionId = generateWorkspaceSpecificId(workspaceId, 'profile-question');
  const profileResponseId = generateWorkspaceSpecificId(workspaceId, 'profile-response');

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

// Helper function to get workspace-specific Profile chat ID
export const getWorkspaceSpecificProfileId = (workspaceId: string): string =>
  generateWorkspaceSpecificId(workspaceId, 'profile-chat');

// Legacy export for backward compatibility - now requires workspaceId
export const getInitialConversations = (workspaceId: string): Conversation[] =>
  createInitialConversationsForWorkspace(workspaceId);
