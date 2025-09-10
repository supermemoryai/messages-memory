import { generateUUID } from '@/lib/utils';
import { type DataStreamWriter, tool } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';

interface CreateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description:
      'Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.',
    parameters: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
    }),
    execute: async ({ title, kind }) => {
      try {
        console.log(
          `[CreateDocumentTool] Starting execution - title: ${title}, kind: ${kind}`,
        );
        console.log(`[CreateDocumentTool] Session details:`, {
          userId: session?.user?.id,
          userEmail: session?.user?.email,
        });

        const id = generateUUID();
        console.log(`[CreateDocumentTool] Generated document ID: ${id}`);

        dataStream.writeData({
          type: 'kind',
          content: kind,
        });

        dataStream.writeData({
          type: 'id',
          content: id,
        });

        dataStream.writeData({
          type: 'title',
          content: title,
        });

        dataStream.writeData({
          type: 'clear',
          content: '',
        });

        const documentHandler = documentHandlersByArtifactKind.find(
          (documentHandlerByArtifactKind) =>
            documentHandlerByArtifactKind.kind === kind,
        );

        if (!documentHandler) {
          console.error(
            `[CreateDocumentTool] No document handler found for kind: ${kind}`,
          );
          console.error(
            `[CreateDocumentTool] Available handlers:`,
            documentHandlersByArtifactKind.map((h) => h.kind),
          );
          throw new Error(`No document handler found for kind: ${kind}`);
        }

        console.log(`[CreateDocumentTool] Found handler for kind: ${kind}`);

        await documentHandler.onCreateDocument({
          id,
          title,
          dataStream,
          session,
        });

        dataStream.writeData({ type: 'finish', content: '' });

        console.log(
          `[CreateDocumentTool] Document creation completed successfully`,
        );

        return {
          id,
          title,
          kind,
          content: 'A document was created and is now visible to the user.',
        };
      } catch (error) {
        console.error(
          `[CreateDocumentTool] Fatal error during document creation:`,
          error,
        );
        throw error;
      }
    },
  });
