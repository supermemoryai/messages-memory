import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import {
  getChatById,
  getMessagesByChatId,
  getWorkspaceMember,
} from '@/lib/db/queries';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
  }

  const chat = await getChatById({ id: chatId });
  if (!chat) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  const member = await getWorkspaceMember({
    workspaceId: chat.workspaceId,
    userId: session.user.id,
  });

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbMessages = await getMessagesByChatId({ id: chatId });

  const messages = dbMessages.map((m: any) => {
    const text = Array.isArray(m.parts)
      ? m.parts
          .filter((p: any) => p?.type === 'text')
          .map((p: any) => p.text)
          .join('')
      : '';

    const attachments = Array.isArray(m.attachments)
      ? m.attachments.map((a: any) => ({
          url: a.url,
          name: a.name,
          contentType: a.mediaType,
        }))
      : [];

    const sender =
      m.role === 'assistant'
        ? 'Supermemory'
        : m.userId === session.user.id
          ? 'me'
          : 'Member';

    return {
      id: m.id,
      content: text,
      sender,
      timestamp: new Date(m.createdAt).toISOString(),
      attachments,
    };
  });

  return NextResponse.json({ messages }, { status: 200 });
}
