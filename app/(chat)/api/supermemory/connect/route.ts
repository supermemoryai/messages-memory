import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatById, getWorkspaceMember } from '@/lib/db/queries';
import { createConnection } from '@/lib/supermemory/client';
import { ChatSDKError } from '@/lib/errors';

const connectSchema = z.object({
  provider: z.enum(['google-drive', 'notion', 'onedrive', 'web-crawler', 'github']),
  chatId: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  documentLimit: z.number().int(),
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

    // Set a short-lived pending cookie so callback can write DB after OAuth completes
    const payload = {
      chatId: body.chatId,
      provider: body.provider,
      connectionId: result.connectionId,
      issuedAt: Date.now(),
    };

    const response = NextResponse.json({
      authLink: result.authLink,
      connectionId: result.connectionId,
      expiresIn: result.expiresIn,
    });

    response.cookies.set('sm_pending_conn', JSON.stringify(payload), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    return new ChatSDKError('bad_request:api', `Failed to create connection: ${error}`).toResponse();
  }
}