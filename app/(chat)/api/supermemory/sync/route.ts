import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatById, getWorkspaceMember } from '@/lib/db/queries';
import { syncConnection } from '@/lib/supermemory/client';
import { ChatSDKError } from '@/lib/errors';

const syncSchema = z.object({
  chatId: z.string(),
  provider: z.enum(['google-drive', 'notion', 'onedrive', 'web-crawler', 'github']),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  let body: z.infer<typeof syncSchema>;
  try {
    const json = await request.json();
    body = syncSchema.parse(json);
  } catch (e) {
    return new ChatSDKError('bad_request:api', String(e)).toResponse();
  }

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

  try {
    await syncConnection(body.provider, { containerTags: [body.chatId] });
    return NextResponse.json({ success: true });
  } catch (error) {
    return new ChatSDKError('bad_request:api', `Failed to sync connection: ${error}`).toResponse();
  }
}

