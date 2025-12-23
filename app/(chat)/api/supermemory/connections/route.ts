import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { getChatById, getWorkspaceMember, getChatConnectionsByChatId, deleteChatConnection } from '@/lib/db/queries';
import { deleteConnection, listConnections } from '@/lib/supermemory/client';
import { ChatSDKError } from '@/lib/errors';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api', 'chatId is required').toResponse();
  }

  // Verify chat exists and user has access
  const chat = await getChatById({ id: chatId });
  if (!chat) {
    return new ChatSDKError('not_found:chat', 'Chat not found').toResponse();
  }

  const member = await getWorkspaceMember({
    workspaceId: chat.workspaceId,
    userId: session.user.id,
  });

  if (!member) {
    return new ChatSDKError('forbidden:chat', 'Not a member of this workspace').toResponse();
  }

  try {
    const [supermemoryConnections, dbConnections] = await Promise.all([
      listConnections(chatId),
      getChatConnectionsByChatId({ chatId }),
    ]);

    const smMap = new Map(supermemoryConnections.map((c) => [c.id, c]));

    const connections = dbConnections.map((dbConn) => {
      const smConn = smMap.get(dbConn.supermemoryConnectionId);
      return {
        id: dbConn.id,
        connectionId: dbConn.supermemoryConnectionId,
        provider: dbConn.provider,
        createdAt: dbConn.createdAt,
        updatedAt: dbConn.updatedAt,
        email: smConn?.email,
        documentLimit: smConn?.documentLimit,
        expiresAt: smConn?.expiresAt,
      };
    });

    return NextResponse.json({ connections });
  } catch (error) {
    return new ChatSDKError('bad_request:api', `Failed to list connections: ${error}`).toResponse();
  }
}

export async function DELETE(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return new ChatSDKError('unauthorized:api').toResponse();
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const chatId = searchParams.get('chatId');

    if (!connectionId || !chatId) {
        return new ChatSDKError('bad_request:api', 'connectionId and chatId are required').toResponse();
    }

    // Verify chat exists and user has access
    const chat = await getChatById({ id: chatId });
    if (!chat) {
        return new ChatSDKError('not_found:chat', 'Chat not found').toResponse();
    }

    const member = await getWorkspaceMember({
        workspaceId: chat.workspaceId,
        userId: session.user.id,
    });

    if (!member) {
        return new ChatSDKError('forbidden:chat', 'Not a member of this workspace').toResponse();
    }

    try {
        // Get the connection from DB to get supermemoryConnectionId
        const dbConnections = await getChatConnectionsByChatId({ chatId });
        const dbConnection = dbConnections.find(c => c.supermemoryConnectionId === connectionId);

        if (!dbConnection) {
        return new ChatSDKError('not_found:api', 'Connection not found').toResponse();
        }

        // Delete from Supermemory first
        await deleteConnection(dbConnection.supermemoryConnectionId);

        // Then delete from our DB
        await deleteChatConnection({ connectionId: connectionId });

        return NextResponse.json({ success: true, connectionId: connectionId, provider: dbConnection.provider });
    } catch (error) {
        return new ChatSDKError('bad_request:api', `Failed to delete connection: ${error}`).toResponse();
    }
}