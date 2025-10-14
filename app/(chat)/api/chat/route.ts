import {
  createUIMessageStream,
  streamText,
  stepCountIs,
  convertToModelMessages,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import type { Chat } from '@/lib/db/schema';
import { differenceInSeconds } from 'date-fns';
import { ChatSDKError } from '@/lib/errors';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log('Resumable streams disabled due to missing REDIS_URL');
      } else {
        console.error(error);
      }
    }
  }
  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (e) {
    return new ChatSDKError('bad_request:api', String(e)).toResponse();
  }

  try {
    const { id, message, selectedChatModel, selectedVisibilityType } = requestBody;

    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });
    if (!chat) {
      await saveChat({
        id,
        userId: session.user.id,
        title: '',
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const previousMessages = await getMessagesByChatId({ id });
    
    // Convert database messages to UIMessage format
    const convertedPreviousMessages = previousMessages.map(dbMsg => {
      const parts = Array.isArray(dbMsg.parts) ? dbMsg.parts : [];
      const textContent = parts.find((part: any) => part.type === 'text')?.text || '';
      
      return {
        id: dbMsg.id,
        role: dbMsg.role as 'user' | 'assistant' | 'system',
        content: textContent,
        parts: parts,
        createdAt: dbMsg.createdAt,
      };
    });
    
    // Manual migration: append client message to previous messages
    const messages = [
      ...convertedPreviousMessages,
      message,
    ];

    const { longitude, latitude, city, country } = geolocation(request);
    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: message.parts?.filter((part: any) => part.type === 'file') ?? [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const result = streamText({
      model: myProvider(session.user.id).languageModel(selectedChatModel),
      system: systemPrompt({ selectedChatModel, requestHints }),
      messages: convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
      experimental_activeTools: [],
      // TODO: Re-enable tools after updating for AI SDK v5 stream format
      // tools: {},

      onFinish: async ({ response }) => {
        if (session.user?.id) {
          try {
            // Get the assistant message from response.messages
            const assistantMessages = response.messages || [];
            const lastAssistantMessage = assistantMessages.find(msg => msg.role === 'assistant');
            
            if (!lastAssistantMessage) {
              console.log('No assistant message found in response.messages');
              return;
            }

            const assistantId = generateUUID();

            // Extract text content from the assistant message
            let textContent = '';
            if (typeof lastAssistantMessage.content === 'string') {
              textContent = lastAssistantMessage.content;
            } else if (Array.isArray(lastAssistantMessage.content)) {
              const textPart = lastAssistantMessage.content.find((part: any) => part.type === 'text');
              textContent = (textPart as any)?.text || '';
            }

            await saveMessages({
              messages: [
                {
                  id: assistantId,
                  chatId: id,
                  role: 'assistant',
                  parts: [{ type: 'text', text: textContent }],
                  attachments: [],
                  createdAt: new Date(),
                },
              ],
            });
          } catch (error) {
            console.error('Failed to save chat:', error);
          }
        }
      },

      experimental_telemetry: {
        isEnabled: isProductionEnvironment,
        functionId: 'stream-text',
      }
    });

    // Create a custom streaming response that matches MessageQueue expectations
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            // Format each text chunk as expected by MessageQueue
            const line = `0:${JSON.stringify(chunk)}\n`;
            controller.enqueue(new TextEncoder().encode(line));
          }
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorLine = `3:${JSON.stringify(errorMessage)}\n`;
          controller.enqueue(new TextEncoder().encode(errorLine));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Top-level error caught:', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    throw error;
  }
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;
  try {
    chat = await getChatById({ id: chatId });
  } catch (error) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });
  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);
  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createUIMessageStream({
    execute: () => {},
  });

  // TODO: Fix resumable stream functionality for AI SDK v5
  const stream = null; // await streamContext.resumableStream(recentStreamId, () => emptyDataStream);

  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);
    const timeDiff = differenceInSeconds(resumeRequestedAt, messageCreatedAt);

    if (timeDiff > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    // TODO: Implement message restoration for AI SDK v5
    return new Response(JSON.stringify(mostRecentMessage), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(stream, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });
  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });
  return Response.json(deletedChat, { status: 200 });
}