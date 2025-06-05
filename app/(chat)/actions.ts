'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
  deleteMessages,
  getMessagesByChatId,
  deleteMessagesByChatId,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
  userId,
}: {
  message: UIMessage;
  userId: string;
}) {
  const { text: title } = await generateText({
    model: myProvider(userId).languageModel('title-model'),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}

export async function deleteMessagePair({ id }: { id: string }) {
  const [message] = await getMessageById({ id });
  const messages = await getMessagesByChatId({ id: message.chatId });

  const messageIndex = messages.findIndex((m) => m.id === id);
  if (messageIndex === -1) return;

  const messagesToDelete = [message.id];

  // If this is a user message and there's an assistant message after it, include it
  if (message.role === 'user' && messageIndex < messages.length - 1) {
    const nextMessage = messages[messageIndex + 1];
    if (nextMessage.role === 'assistant') {
      messagesToDelete.push(nextMessage.id);
    }
  }

  await deleteMessages({
    messageIds: messagesToDelete,
    chatId: message.chatId,
  });
}

export async function clearChat({ id }: { id: string }) {
  await deleteMessagesByChatId({ id });
}
