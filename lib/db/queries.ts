import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  stream,
  workspace,
  workspaceMember,
  invitation,
  chatConnection,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';
import type { Provider } from '../supermemory/client';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function saveChat({
  id,
  workspaceId,
  createdBy,
  title,
  visibility,
}: {
  id: string;
  workspaceId: string;
  createdBy: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      workspaceId,
      createdBy,
      title,
      visibility,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.createdBy, id))
            : eq(chat.createdBy, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatsByWorkspaceId({
  workspaceId,
  limit,
  startingAfter,
  endingBefore,
}: {
  workspaceId: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.workspaceId, workspaceId))
            : eq(chat.workspaceId, workspaceId),
        )
        .orderBy(asc(chat.createdAt)) // Discord-style: oldest channels first, fixed order
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;
    const chatsToReturn = hasMore ? filteredChats.slice(0, limit) : filteredChats;

    // Fetch last message for each chat to show previews
    const chatIds = chatsToReturn.map(c => c.id);

    if (chatIds.length > 0) {
      // Get the latest message for each chat in a single query
      const lastMessages = await db
        .select()
        .from(message)
        .where(inArray(message.chatId, chatIds))
        .orderBy(desc(message.createdAt));

      // Group messages by chatId and get the most recent one for each
      const lastMessageByChat = new Map();
      for (const msg of lastMessages) {
        if (!lastMessageByChat.has(msg.chatId)) {
          lastMessageByChat.set(msg.chatId, msg);
        }
      }

      // Attach last message to each chat
      const chatsWithMessages = chatsToReturn.map(chat => ({
        ...chat,
        lastMessage: lastMessageByChat.get(chat.id) || null,
      }));

      return {
        chats: chatsWithMessages,
        hasMore,
      };
    }

    return {
      chats: chatsToReturn,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by workspace id',
    );
  }
}

export async function getChatByWorkspaceAndTitle({
  workspaceId,
  title,
} : {
  workspaceId: string;
  title: string;
}) {
  try {
    const [existingChat] = await db
      .select()
      .from(chat)
      .where(and(
        eq(chat.workspaceId, workspaceId), 
        eq(chat.title, title)
      ))
      .limit(1);
    return existingChat;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to check chat title',
    )
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function createChatConnection({
  chatId,
  workspaceId,
  provider,
  supermemoryConnectionId,
}: {
  chatId: string;
  workspaceId: string;
  provider: Provider;
  supermemoryConnectionId: string;
}) {
  try {
    const now = new Date();
    return await db.insert(chatConnection).values({
      chatId,
      workspaceId,
      provider,
      supermemoryConnectionId,
      createdAt: now,
      updatedAt: now,
    }).returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create chat connection');
  }
}

export async function getChatConnectionsByChatId({ chatId }: { chatId: string }) {
  try {
    return await db.select().from(chatConnection).where(eq(chatConnection.chatId, chatId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat connections');
  }
}

export async function deleteChatConnection({ connectionId }: { connectionId: string }) {
  try {
    return await db.delete(chatConnection).where(eq(chatConnection.supermemoryConnectionId, connectionId)).returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete chat connection');
  }
}

export async function deleteChatConnectionById({ id }: { id: string }) {
  try {
    return await db.delete(chatConnection).where(eq(chatConnection.id, id)).returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete chat connection by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    console.log(`[SaveDocument] Attempting to save document:`, {
      id,
      title,
      kind,
      contentLength: content?.length || 0,
      userId,
    });

    const result = await db
      .insert(document)
      .values({
        id,
        title,
        kind: kind as 'text' | 'code' | 'image' | 'sheet',
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();

    console.log(`[SaveDocument] Document saved successfully:`, {
      id,
      resultLength: result?.length || 0,
    });

    return result;
  } catch (error) {
    console.error(`[SaveDocument] Database error:`, error);

    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    const [updated] = await db
      .update(chat)
      .set({ title })
      .where(eq(chat.id, chatId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat title by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .where(
        and(
          eq(message.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

export async function deleteOldestMessageInChat({
  chatId,
}: { chatId: string }) {
  try {
    // Find the oldest message in the chat
    const oldestMessage = await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(asc(message.createdAt))
      .limit(2);

    if (oldestMessage.length === 0) {
      return null;
    }

    const messageIds = oldestMessage.map((message) => message.id);

    // Delete any votes associated with this message
    await db
      .delete(vote)
      .where(and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)));

    // Delete the message
    return await db
      .delete(message)
      .where(and(eq(message.chatId, chatId), inArray(message.id, messageIds)));
  } catch (error) {
    console.error('Failed to delete oldest message in chat', error);
    throw error;
  }
}

export async function deleteMessages({
  messageIds,
  chatId,
}: {
  messageIds: string[];
  chatId: string;
}) {
  try {
    // First delete any votes associated with these messages
    await db
      .delete(vote)
      .where(and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)));

    // Then delete the messages
    return await db
      .delete(message)
      .where(and(eq(message.chatId, chatId), inArray(message.id, messageIds)));
  } catch (error) {
    console.error('Failed to delete messages from database');
    throw error;
  }
}

export async function deleteMessagesByChatId({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));
  } catch (error) {
    console.error('Failed to delete messages by chat id from database');
    throw error;
  }
}

// Workspace queries
export async function createWorkspace({
  name,
  createdBy,
}: {
  name: string;
  createdBy: string;
}) {
  try {
    const [ws] = await db
      .insert(workspace)
      .values({
        name,
        createdBy,
        createdAt: new Date(),
      })
      .returning();

    // Auto-add creator as member
    await db.insert(workspaceMember).values({
      workspaceId: ws.id,
      userId: createdBy,
      joinedAt: new Date(),
    });

    // Create #setup channel with onboarding message
    const setupChannelId = crypto.randomUUID();
    await db.insert(chat).values({
      id: setupChannelId,
      workspaceId: ws.id,
      createdBy,
      title: 'setup',
      visibility: 'private',
      createdAt: new Date(),
    });

    // Seed the onboarding message
    const onboardingText = `Welcome to your new workspace! 👋

I'm your AI assistant, and I'm here to help you with anything you need. This is your #setup channel - a great place to get started.

Here's what makes me different:
- I have persistent memory within each channel - I'll remember our conversations and context
- I can search the web for current information when needed
- I work naturally and seamlessly, using tools in the background without announcing it

A few tips:
- Each channel has its own isolated memory and context
- I can help with research, brainstorming, coding, writing, and much more
- Just ask me questions naturally - I'll figure out what tools I need to use

What would you like to work on today?`;

    await db.insert(message).values({
      id: crypto.randomUUID(),
      chatId: setupChannelId,
      userId: null, // Assistant message
      role: 'assistant',
      parts: [{ type: 'text', text: onboardingText }],
      attachments: [],
      createdAt: new Date(),
    });

    return ws;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create workspace');
  }
}

export async function getWorkspacesByUserId({ userId }: { userId: string }) {
  try {
    const workspaces = await db
      .select({
        id: workspace.id,
        name: workspace.name,
        createdBy: workspace.createdBy,
        createdAt: workspace.createdAt,
      })
      .from(workspace)
      .innerJoin(workspaceMember, eq(workspace.id, workspaceMember.workspaceId))
      .where(eq(workspaceMember.userId, userId))
      .orderBy(desc(workspace.createdAt));

    return workspaces;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get workspaces by user id',
    );
  }
}

export async function getWorkspaceById({ id }: { id: string }) {
  try {
    const [ws] = await db.select().from(workspace).where(eq(workspace.id, id));
    return ws;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get workspace by id',
    );
  }
}

export async function deleteWorkspace({ id }: { id: string }) {
  try {
    // Cascade delete will handle members, invitations, chats, messages
    const [deleted] = await db
      .delete(workspace)
      .where(eq(workspace.id, id))
      .returning();
    return deleted;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete workspace');
  }
}

export async function updateWorkspaceTitleById({
  workspaceId,
  name,
}: {
  workspaceId: string;
  name: string;
}) {
  try {
    const [updated] = await db
      .update(workspace)
      .set({ name })
      .where(eq(workspace.id, workspaceId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update workspace title by id',
    );
  }
}

// WorkspaceMember queries
export async function getWorkspaceMember({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  try {
    const [member] = await db
      .select()
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.workspaceId, workspaceId),
          eq(workspaceMember.userId, userId),
        ),
      );
    return member;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get workspace member',
    );
  }
}

export async function getWorkspaceMembers({
  workspaceId,
}: {
  workspaceId: string;
}) {
  try {
    const members = await db
      .select({
        id: workspaceMember.id,
        userId: workspaceMember.userId,
        joinedAt: workspaceMember.joinedAt,
        email: user.email,
      })
      .from(workspaceMember)
      .innerJoin(user, eq(workspaceMember.userId, user.id))
      .where(eq(workspaceMember.workspaceId, workspaceId))
      .orderBy(asc(workspaceMember.joinedAt));

    return members;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get workspace members',
    );
  }
}

export async function addWorkspaceMember({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  try {
    const [member] = await db
      .insert(workspaceMember)
      .values({
        workspaceId,
        userId,
        joinedAt: new Date(),
      })
      .returning();
    return member;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to add workspace member',
    );
  }
}

export async function removeWorkspaceMember({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  try {
    const [removed] = await db
      .delete(workspaceMember)
      .where(
        and(
          eq(workspaceMember.workspaceId, workspaceId),
          eq(workspaceMember.userId, userId),
        ),
      )
      .returning();
    return removed;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to remove workspace member',
    );
  }
}

// Invitation queries
export async function createInvitation({
  workspaceId,
  createdBy,
}: {
  workspaceId: string;
  createdBy: string;
}) {
  try {
    const token = generateUUID(); // Use UUID as token
    const [inv] = await db
      .insert(invitation)
      .values({
        workspaceId,
        token,
        createdBy,
        createdAt: new Date(),
      })
      .returning();
    return inv;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create invitation');
  }
}

export async function getInvitationByToken({ token }: { token: string }) {
  try {
    const [inv] = await db
      .select({
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        token: invitation.token,
        createdBy: invitation.createdBy,
        createdAt: invitation.createdAt,
        workspaceName: workspace.name,
      })
      .from(invitation)
      .innerJoin(workspace, eq(invitation.workspaceId, workspace.id))
      .where(eq(invitation.token, token));
    return inv;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get invitation by token',
    );
  }
}

export async function deleteInvitation({ id }: { id: string }) {
  try {
    const [deleted] = await db
      .delete(invitation)
      .where(eq(invitation.id, id))
      .returning();
    return deleted;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete invitation');
  }
}

export async function getInvitationsByWorkspaceId({
  workspaceId,
}: {
  workspaceId: string;
}) {
  try {
    const invitations = await db
      .select({
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        token: invitation.token,
        createdBy: invitation.createdBy,
        createdAt: invitation.createdAt,
      })
      .from(invitation)
      .where(eq(invitation.workspaceId, workspaceId))
      .orderBy(desc(invitation.createdAt));
    return invitations;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get invitations by workspace ID',
    );
  }
}

export async function deleteInvitationsByWorkspaceId({
  workspaceId,
}: {
  workspaceId: string;
}) {
  try {
    const deleted = await db
      .delete(invitation)
      .where(eq(invitation.workspaceId, workspaceId))
      .returning();
    return deleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete invitations by workspace ID',
    );
  }
}
