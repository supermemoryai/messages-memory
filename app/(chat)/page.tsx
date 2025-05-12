import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { getChatsByUserId, getMessagesByChatId } from '@/lib/db/queries';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { DBMessage } from '@/lib/db/schema';
import type { Attachment, UIMessage } from 'ai';
import { generateUUID } from '@/lib/utils';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const userId = session.user?.id;
  let chat = null;
  let messagesFromDb: DBMessage[] = [];
  let id = '';

  if (userId) {
    // Try to get user's existing chat
    const userChats = await getChatsByUserId({
      id: userId,
      limit: 1,
      startingAfter: null,
      endingBefore: null,
    });

    if (userChats.chats.length > 0) {
      // Use the most recent chat
      chat = userChats.chats[0];
      id = chat.id;

      // Load messages for this chat
      messagesFromDb = await getMessagesByChatId({ id });
    } else {
      // Create a new chat ID if no existing chats
      id = generateUUID();
    }
  } else {
    // Fallback ID for guests
    id = generateUUID();
  }

  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message) => ({
      id: message.id,
      parts: message.parts as UIMessage['parts'],
      role: message.role as UIMessage['role'],
      // Note: content will soon be deprecated in @ai-sdk/react
      content: '',
      createdAt: message.createdAt,
      experimental_attachments:
        (message.attachments as Array<Attachment>) ?? [],
    }));
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');
  const initialVisibilityType = chat?.visibility || 'private';

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          id={id}
          initialMessages={convertToUIMessages(messagesFromDb)}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType={initialVisibilityType}
          isReadonly={false}
          session={session}
          autoResume={!!chat}
        />
        <DataStreamHandler id={id} />
      </>
    );
  }

  return (
    <>
      <Chat
        id={id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        initialChatModel={chatModelFromCookie.value}
        initialVisibilityType={initialVisibilityType}
        isReadonly={false}
        session={session}
        autoResume={!!chat}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
