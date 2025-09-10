import { customProvider } from 'ai';
import { xai } from '@ai-sdk/xai';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
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
    baseURL:
      'https://api.supermemory.ai/v3/https://api.anthropic.com/v1?userId=' +
      user,
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: {
      // @ts-ignore
      'x-supermemory-api-key': process.env.SUPERMEMORY_API_KEY,
    },
  }).languageModel('claude-3-5-sonnet-latest');
};

export const myProvider = isTestEnvironment
  ? (user?: string) =>
      customProvider({
        languageModels: {
          'chat-model': chatModel,
          'chat-model-reasoning': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
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
