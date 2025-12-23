import { customProvider } from 'ai';
import { xai } from '@ai-sdk/xai';
import { isTestEnvironment } from '../constants';
import { createAnthropic } from '@ai-sdk/anthropic';

if (!process.env.SUPERMEMORY_API_KEY) {
  throw new Error('SUPERMEMORY_API_KEY is not set');
}

const supermemory = (user?: string) => {
  if (!user) {
    console.error('[Provider] User is required for supermemory provider');
    throw new Error('User is required');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[Provider] ANTHROPIC_API_KEY is missing');
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  console.log(`[Provider] Creating supermemory provider for user: ${user}`);

  return createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  }).languageModel('claude-haiku-4-5-20251001');
};

export const myProvider = isTestEnvironment
  ? (user?: string) =>
      customProvider({
        languageModels: {
          'chat-model': supermemory(user),
          'chat-model-reasoning': supermemory(user),
          'title-model': supermemory(user),
          'artifact-model': supermemory(user),
        },
      })
  : (user?: string) => {
      console.log(
        `[Provider] Creating production provider for user: ${user || 'unknown'}`,
      );

      const provider = customProvider({
        languageModels: {
          // 'chat-model': xai('grok-2-vision-latest'),
          'chat-model': supermemory(user),
          'chat-model-reasoning': supermemory(user),
          'title-model': supermemory(user),
          'artifact-model': (() => {
            console.log(
              `[Provider] Creating XAI grok-2-1212 model for artifacts`,
            );
            console.log(
              `[Provider] XAI_API_KEY available: ${!!process.env.XAI_API_KEY}`,
            );
            if (!process.env.XAI_API_KEY) {
              console.error(
                '[Provider] XAI_API_KEY is missing, falling back to supermemory',
              );
              return supermemory(user);
            }
            return xai('grok-2-1212');
          })(),
        },
        imageModels: {
          // @ts-ignore
          'small-model': supermemory(user),
        },
      });

      console.log(`[Provider] Provider created successfully`);
      return provider;
    };
