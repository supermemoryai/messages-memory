import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { getChatById, updateChatTitleById, getWorkspaceMember } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';

const updateChatSchema = z.object({
  title: z.string().min(1).max(200),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const { id: chatId } = await params;

  // Get the chat
  const chatData = await getChatById({ id: chatId });
  if (!chatData) {
    return new ChatSDKError('not_found:chat', 'Chat not found').toResponse();
  }

  // Check if user is a member of the workspace
  const member = await getWorkspaceMember({
    workspaceId: chatData.workspaceId,
    userId: session.user.id,
  });

  if (!member) {
    return new ChatSDKError(
      'forbidden:chat',
      'Not a member of this workspace',
    ).toResponse();
  }

  return NextResponse.json({
    chat: chatData,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const { id: chatId } = await params;

  // Get the chat to verify workspace membership
  const chatData = await getChatById({ id: chatId });
  if (!chatData) {
    return new ChatSDKError('not_found:chat', 'Chat not found').toResponse();
  }

  // Check if user is a member of the workspace
  const member = await getWorkspaceMember({
    workspaceId: chatData.workspaceId,
    userId: session.user.id,
  });

  if (!member) {
    return new ChatSDKError(
      'forbidden:chat',
      'Not a member of this workspace',
    ).toResponse();
  }

  let body: z.infer<typeof updateChatSchema>;
  try {
    const json = await request.json();
    body = updateChatSchema.parse(json);
  } catch (e) {
    return new ChatSDKError('bad_request:api', String(e)).toResponse();
  }

  try {
    const updatedChat = await updateChatTitleById({
      chatId,
      title: body.title,
    });

    if (!updatedChat) {
      return new ChatSDKError('not_found:chat', 'Chat not found').toResponse();
    }

    return NextResponse.json({
      chat: updatedChat,
    });
  } catch (error) {
    console.error('[Chat API] Error updating chat:', error);
    return new ChatSDKError(
      'bad_request:database',
      'Failed to update chat',
    ).toResponse();
  }
}
