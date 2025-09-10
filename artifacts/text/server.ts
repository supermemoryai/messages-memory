import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { updateDocumentPrompt } from '@/lib/ai/prompts';

export const textDocumentHandler = createDocumentHandler<'text'>({
  kind: 'text',
  onCreateDocument: async ({ title, dataStream, session }) => {
    let draftContent = '';

    try {
      console.log(
        `[TextDocumentHandler] Starting text generation for title: ${title}`,
      );
      console.log(`[TextDocumentHandler] User ID: ${session?.user?.id}`);

      const { fullStream } = streamText({
        model: myProvider(session?.user?.id).languageModel('artifact-model'),
        system:
          'Write about the given topic. Markdown is supported. Use headings wherever appropriate.',
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt: title,
      });

      console.log(
        `[TextDocumentHandler] Stream created, starting generation...`,
      );

      for await (const delta of fullStream) {
        const { type } = delta;

        if (type === 'text-delta') {
          const { textDelta } = delta;

          draftContent += textDelta;

          dataStream.writeData({
            type: 'text-delta',
            content: textDelta,
          });
        }
      }

      console.log(
        `[TextDocumentHandler] Generated content length: ${draftContent.length}`,
      );
      return draftContent;
    } catch (error) {
      console.error(
        `[TextDocumentHandler] Error during text generation:`,
        error,
      );
      throw error;
    }
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider().languageModel('artifact-model'),
      system: updateDocumentPrompt(document.content, 'text'),
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: description,
      experimental_providerMetadata: {
        openai: {
          prediction: {
            type: 'content',
            content: document.content,
          },
        },
      },
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { textDelta } = delta;

        draftContent += textDelta;
        dataStream.writeData({
          type: 'text-delta',
          content: textDelta,
        });
      }
    }

    return draftContent;
  },
});
