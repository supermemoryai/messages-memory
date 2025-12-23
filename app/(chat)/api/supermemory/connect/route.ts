import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createChatConnection, getChatById, getWorkspaceMember } from '@/lib/db/queries';
import { createConnection } from '@/lib/supermemory/client';
import { ChatSDKError } from '@/lib/errors';

const connectSchema = z.object({
  provider: z.enum(['google-drive', 'notion', 'onedrive', 'web-crawler', 'github']),
  chatId: z.uuid(),
  metadata: z.record(z.any(), z.any()).optional(),
  documentLimit: z.int(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  let body: z.infer<typeof connectSchema>;
  try {
    const json = await request.json();
    body = connectSchema.parse(json);
  } catch (e) {
    return new ChatSDKError('bad_request:api', String(e)).toResponse();
  }

  // Verify chat exists and user has access
  const chat = await getChatById({ id: body.chatId });
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

  // Build redirect URL for OAuth callback
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';
  const redirectUrl = `${baseUrl}/api/supermemory/callback?chatId=${body.chatId}`;

  // Create connection via Supermemory
  try {
    const result = await createConnection({
      provider: body.provider,
      redirectUrl,
      containerTags: [body.chatId],
      documentLimit: body.documentLimit,
      metadata: body.metadata,
    });

    if (!result) {
      return new ChatSDKError('bad_request:connection', 'Failed to create connection').toResponse();
    }

    // // Store connectionId in cache for callback
    // setPendingConnection(body.chatId, result.connectionId);
    // Write to DB immediately
    await createChatConnection({
      chatId: body.chatId,
      workspaceId: chat.workspaceId,
      provider: body.provider,
      supermemoryConnectionId: result.connectionId,
    });

    return NextResponse.json({
      authLink: result.authLink,
      connectionId: result.connectionId,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    return new ChatSDKError('bad_request:api', `Failed to create connection: ${error}`).toResponse();
  }
}