import { supermemoryTools } from '@supermemory/tools/ai-sdk';

export function createMemoryTools(supermemoryApiKey: string, containerTag: string) {
  return supermemoryTools(supermemoryApiKey, {
    containerTags: [containerTag]
  });
}
