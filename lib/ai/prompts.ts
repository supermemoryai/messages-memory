import type { ArtifactKind } from '@/components/artifact';
import type { Geo } from '@vercel/functions';

export const toolsPrompt = `
You have access to two powerful tools:

1. **supermemorySearch**: Search the user's personal memories, documents, and past conversations
   - Use this when the user asks about their preferences, past discussions, saved information, or personal context
   - This tool searches through everything the user has saved or discussed before
   - Examples: "What did I say about...", "Remember when...", "My preferences for..."

2. **exaSearch**: Search the web for current information
   - Use this for factual questions, current events, news, or general knowledge
   - This tool searches the internet for up-to-date information
   - Examples: "What's the weather...", "Latest news about...", "How to..."

**Important guidelines:**
- Use tools when you need additional context beyond what's in the current conversation
- Don't use tools for simple conversational responses
- You can use both tools in the same response if needed
- If a query could benefit from both personal context AND web search, use both tools
`;

export const regularPrompt = `You are a friendly assistant! Keep your responses concise and helpful.

You can process and analyze images, PDFs, and text files that users upload. When users share files:
- For images: describe what you see, answer questions about the image, or perform analysis as requested
- For PDFs and text files: read and analyze the content, answer questions, or summarize as needed
- You have full access to the file contents, so provide detailed and helpful responses about them`;

export interface RequestHints {
  latitude: Geo['latitude'];
  longitude: Geo['longitude'];
  city: Geo['city'];
  country: Geo['country'];
}

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  selectedChatModel,
  requestHints,
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  if (selectedChatModel === 'chat-model-reasoning') {
    return `${regularPrompt}\n\n${requestPrompt}`;
  } else {
    return `${regularPrompt}\n\n${requestPrompt}\n\n${toolsPrompt}`;
  }
};

export const codePrompt = `
You are a Python code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet should be complete and runnable on its own
2. Prefer using print() statements to display outputs
3. Include helpful comments explaining the code
4. Keep snippets concise (generally under 15 lines)
5. Avoid external dependencies - use Python standard library
6. Handle potential errors gracefully
7. Return meaningful output that demonstrates the code's functionality
8. Don't use input() or other interactive functions
9. Don't access files or network resources
10. Don't use infinite loops

Examples of good snippets:

# Calculate factorial iteratively
def factorial(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

print(f"Factorial of 5 is: {factorial(5)}")
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in csv format based on the given prompt. The spreadsheet should contain meaningful column headers and data.
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind,
) =>
  type === 'text'
    ? `\
Improve the following contents of the document based on the given prompt.

${currentContent}
`
    : type === 'code'
      ? `\
Improve the following code snippet based on the given prompt.

${currentContent}
`
      : type === 'sheet'
        ? `\
Improve the following spreadsheet based on the given prompt.

${currentContent}
`
        : '';
