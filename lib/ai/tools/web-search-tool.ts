import { tool } from 'ai';
import { z } from 'zod';
import ExaClient from 'exa-js';

const webSearchSchema = z.object({
  query: z.string().describe('The search query to find relevant web content'),
  numResults: z.number().int().min(1).max(10).optional().default(5).describe('Number of results to return (1-10)'),
});

export function createWebSearchTool(exaApiKey: string) {
  const exa = new ExaClient(exaApiKey);

  return tool({
    description: 'Search the web for current information, news, articles, and online content. Use this when you need up-to-date information from the internet that is not in the user\'s personal memory.',
    inputSchema: webSearchSchema,
    execute: async ({ query, numResults = 5 }) => {
      try {
        console.log('[Web Search Tool] Executing search:', query);
        const searchResults = await exa.searchAndContents(query, {
          numResults: Math.min(numResults || 5, 10),
          text: { maxCharacters: 1000 },
          type: 'auto',
        });

        console.log('[Web Search Tool] Results count:', searchResults.results.length);

        return {
          success: true,
          results: searchResults.results.map(result => ({
            title: result.title,
            url: result.url,
            text: result.text || '',
            publishedDate: result.publishedDate,
            author: result.author,
          })),
          count: searchResults.results.length,
        };
      } catch (error) {
        console.error('[Web Search Tool] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred during web search',
          results: [],
          count: 0,
        };
      }
    },
  });
}
