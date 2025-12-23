import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { getChatById, getWorkspaceMember } from '@/lib/db/queries';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return NextResponse.redirect(new URL('/?error=missing_chatId', request.url));
  }

  // Verify chat exists and user has access
  const chat = await getChatById({ id: chatId });
  if (!chat) {
    return NextResponse.redirect(new URL('/?error=chat_not_found', request.url));
  }

  const member = await getWorkspaceMember({
    workspaceId: chat.workspaceId,
    userId: session.user.id,
  });

  if (!member) {
    return NextResponse.redirect(new URL('/?error=forbidden', request.url));
  }

    return NextResponse.redirect(new URL(`/?id=${chatId}&connected=true`, request.url));
}