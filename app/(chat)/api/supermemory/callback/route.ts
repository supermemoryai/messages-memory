import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getChatById, getWorkspaceMember, createChatConnection, getChatConnectionsByChatId } from '@/lib/db/queries';
import { listConnections } from '@/lib/supermemory/client';

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

  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get('sm_pending_conn')?.value;
  let pending:
    | {
        chatId: string;
        provider: string;
        connectionId: string;
        issuedAt: number;
      }
    | null = null;

  try {
    pending = pendingRaw ? JSON.parse(pendingRaw) : null;
  } catch {
    pending = null;
  }

  try {
    // Get existing connections to avoid duplicates
    const existing = await getChatConnectionsByChatId({ chatId });
    const existingIds = new Set(existing.map((c) => c.supermemoryConnectionId));

    let targetConnectionId: string | null = null;
    let targetProvider: string | null = null;

    // Prefer cookie if it matches chatId and is recent
    if (
      pending &&
      pending.chatId === chatId &&
      Number.isFinite(pending.issuedAt) &&
      Date.now() - pending.issuedAt < 15 * 60 * 1000
    ) {
      targetConnectionId = pending.connectionId;
      targetProvider = pending.provider;
    }

    // Fallback: find newest SM connection not already in DB
    if (!targetConnectionId) {
      const smConnections = await listConnections(chatId);
      const candidates = smConnections
        .filter((c) => !existingIds.has(c.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (candidates.length > 0) {
        targetConnectionId = candidates[0].id;
        targetProvider = candidates[0].provider;
      }
    }

    if (targetConnectionId && targetProvider) {
      await createChatConnection({
        chatId,
        workspaceId: chat.workspaceId,
        provider: targetProvider as any,
        supermemoryConnectionId: targetConnectionId,
      });
    }

    // ignore errors
  } catch {
    // swallow errors to avoid blocking redirect
  }

  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('id', chatId);
  redirectUrl.searchParams.set('connected', 'true');

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set('sm_pending_conn', '', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}