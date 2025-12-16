import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type ToolSet,
} from 'ai';
import { withSupermemory } from '@supermemory/tools/ai-sdk';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import { createWebSearchTool } from '@/lib/ai/tools/web-search-tool';
import { createMemoryTools } from '@/lib/ai/tools/memory-tools';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import { ChatSDKError } from '@/lib/errors';

export const maxDuration = 60;
const REACTION_MARKER_REGEX =
  /<<\s*react\s*:\s*(heart|like|dislike|laugh|emphasize|question)\s*>>/gi;

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (e) {
    return new ChatSDKError('bad_request:api', String(e)).toResponse();
  }

  try {
    const { id, message, selectedChatModel, selectedVisibilityType } =
      requestBody;

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

    // Convert DB messages to AI SDK v5 format (using parts array)
    const formattedPreviousMessages = previousMessages.map((dbMsg: any) => {
      // Ensure parts array exists, or create one from content if needed
      const parts =
        Array.isArray(dbMsg.parts) && dbMsg.parts.length > 0
          ? dbMsg.parts
          : [{ type: 'text', text: dbMsg.content || '' }];

      return {
        id: dbMsg.id,
        role: dbMsg.role,
        parts,
        createdAt: dbMsg.createdAt,
      };
    });

    // Format current message using parts array (AI SDK v5 format)
    const formattedCurrentMessage = {
      id: message.id,
      role: message.role,
      parts: message.parts, // Already has parts from schema
      createdAt: message.createdAt,
    };

    // Append current message to previous messages
    const messages = [...formattedPreviousMessages, formattedCurrentMessage];

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
          attachments:
            message.parts?.filter((part: any) => part.type === 'file') ?? [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Get the API key for supermemory tools
    const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
    if (!supermemoryApiKey) {
      return new ChatSDKError(
        'bad_request:api',
        'SUPERMEMORY_API_KEY is not configured',
      ).toResponse();
    }

    // Get the API key for Exa tools
    const exaApiKey = process.env.EXA_API_KEY;
    if (!exaApiKey) {
      return new ChatSDKError(
        'bad_request:api',
        'EXA_API_KEY is not configured',
      ).toResponse();
    }

    // Always use user ID as container tag
    const containerTag = session.user.id;
    console.log('[Chat API] Using container tag:', containerTag);

    // Check if user has existing memories to determine if they're new
    let isNewUser = true;

    // Only check for existing memories if this is the first message in a new conversation
    if (previousMessages.length === 0) {
      try {
        console.log(
          '[Chat API] Checking for existing memories for user:',
          containerTag,
        );
        const baseUrl =
          process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai';
        const profileResponse = await fetch(`${baseUrl}/v4/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supermemoryApiKey}`,
          },
          body: JSON.stringify({
            containerTag: containerTag,
          }),
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          // If profile exists and has content, user is not new
          if (profileData?.profile.length > 0) {
            isNewUser = false;
            console.log(
              '[Chat API] User has existing memories, not a new user',
            );
          } else {
            console.log(
              '[Chat API] No existing memories found, treating as new user',
            );
          }
        }
      } catch (error) {
        console.error(
          '[Chat API] Error checking for existing memories:',
          error,
        );
        // Default to treating as existing user if check fails to avoid unnecessary onboarding
        isNewUser = false;
      }
    } else {
      // If there are previous messages in this conversation, definitely not a new user
      isNewUser = false;
    }

    // Create tools
    const memoryTools = createMemoryTools(supermemoryApiKey, containerTag);
    const webSearchTool = createWebSearchTool(exaApiKey);

    // Wrap the language model with supermemory
    const baseModel = myProvider(session.user.id).languageModel(
      selectedChatModel,
    );
    const modelWithMemory = withSupermemory(baseModel, containerTag, {
      conversationId: id,
      mode: 'full',
      verbose: true,
      addMemory: 'always',
      baseUrl: process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai',
    });

    const toolsConfig = {
      searchMemories: memoryTools.searchMemories,
      webSearch: webSearchTool,
    } as ToolSet;

    // Log what messages we're sending to AI SDK
    const convertedMessages = convertToModelMessages(messages as any);
    convertedMessages.forEach((msg, idx) => {
      console.log(`[Chat API] Message ${idx}:`, {
        role: msg.role,
        content:
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content),
      });
    });

    const result = streamText({
      model: modelWithMemory,
      system: systemPrompt({ selectedChatModel, requestHints, isNewUser }),
      messages: convertedMessages,
      tools: toolsConfig,
      stopWhen: stepCountIs(3), // Allows up to 3 steps for tool calls and responses

      onFinish: async ({ text, steps }) => {
        if (session.user?.id) {
          try {
            const cleanedText = text.replace(REACTION_MARKER_REGEX, '').trim();
            if (!cleanedText) {
              return;
            }

            // Check if the response contains split delimiter
            const splitMessages = cleanedText
              .split('<SPLIT>')
              .map((t) => t.trim())
              .filter((t) => t.length > 0);

            // If there are multiple messages, save them separately with small time delays
            if (splitMessages.length > 1) {
              const messagesToSave = splitMessages.map(
                (messageText, index) => ({
                  id: generateUUID(),
                  chatId: id,
                  role: 'assistant' as const,
                  parts: [{ type: 'text' as const, text: messageText }],
                  attachments: [],
                  // Add small time increments to ensure correct ordering
                  createdAt: new Date(Date.now() + index * 100),
                }),
              );

              await saveMessages({ messages: messagesToSave });
            } else {
              // Single message, save as before
              await saveMessages({
                messages: [
                  {
                    id: generateUUID(),
                    chatId: id,
                    role: 'assistant',
                    parts: [{ type: 'text', text: cleanedText }],
                    attachments: [],
                    createdAt: new Date(),
                  },
                ],
              });
            }
          } catch (error) {
            console.error('Failed to save chat:', error);
          }
        }
      },

      experimental_telemetry: {
        isEnabled: isProductionEnvironment,
        functionId: 'stream-text',
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Top-level error caught:', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    throw error;
  }
}

export async function GET() {
  return new Response(null, { status: 204 });
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
