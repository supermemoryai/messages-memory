import { auth } from '@/app/(auth)/auth';
import { 
    getWorkspaceMember, 
    saveChat, 
    getChatByWorkspaceAndTitle 
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { generateUUID } from '@/lib/utils';
import { NextResponse } from 'next/server';
import { z } from 'zod';


const createChatSchema = z.object({
    title: z.string().min(1).max(100),
    visibility: z.enum(['public', 'private']).optional().default('public'),
})

export async function POST(
    request: Request,
    { params }: { params: Promise<{id: string}> },
) {
    const session = await auth();
    if (!session?.user) {
        return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Only regular users can create chats (not guest users)
    if (session.user.type !== 'regular') {
        return new ChatSDKError(
            'forbidden:chat',
            'Only regular users can create chats',
        ).toResponse();
    }

    const { id: workspaceId } = await params;

    // Check if user is a member of the workspace
    const member = await getWorkspaceMember({
        workspaceId,
        userId: session.user.id,
    });

    if (!member) {
        return new ChatSDKError(
            'forbidden:chat',
            'Not a member of this workspace',
        ).toResponse();
    }

    let body: z.infer<typeof createChatSchema>;
    try {
        const json = await request.json();
        body = createChatSchema.parse(json);
    } catch (e) {
        return new ChatSDKError('bad_request:api', String(e)).toResponse();
    }

    try {
        // Check if chat title already exists in this workspace
        const existingChat = await getChatByWorkspaceAndTitle({
            workspaceId,
            title: body.title,
        });

        if (existingChat) {
            return new ChatSDKError(
                'bad_request:api',
                'A chat with this name already exists in this workspace',
            ).toResponse();
        }

        const chatId = generateUUID();
        await saveChat({
            id: chatId,
            workspaceId,
            createdBy: session.user.id,
            title: body.title,
            visibility: body.visibility,
        });

        return NextResponse.json({
            chat: {
                id: chatId,
                title: body.title,
                visibility: body.visibility,
                workspaceId,
                createdBy: session.user.id,
                createdAt: new Date().toISOString(),
            }
        })
    } catch (error) {
        console.error('[Create Chat API] Error creating: chat', error);
        return new ChatSDKError(
            'bad_request:database',
            'Failed to create chat',
        ).toResponse();
    }
}