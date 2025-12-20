import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { getChatsByWorkspaceId, getWorkspaceMember } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) {
    return new ChatSDKError('bad_request:api', 'workspaceId is required.').toResponse();
  }

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      'bad_request:api',
      'Only one of starting_after or ending_before can be provided.',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const member = await getWorkspaceMember({
    workspaceId,
    userId: session.user.id,
  });

  if (!member) {
    return new ChatSDKError('forbidden:chat', 'Not a member of this workspace').toResponse();
  }

  const chats = await getChatsByWorkspaceId({
    workspaceId,
    limit,
    startingAfter,
    endingBefore,
  });

  return Response.json(chats);
}
