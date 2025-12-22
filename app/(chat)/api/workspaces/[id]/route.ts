import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { getWorkspaceMember, updateWorkspaceTitleById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:workspace').toResponse();
  }

  // Only regular users can rename workspaces (not guest users)
  if (session.user.type !== 'regular') {
    return new ChatSDKError(
      'forbidden:workspace',
      'Only regular users can rename workspaces',
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
      'forbidden:workspace',
      'Not a member of this workspace',
    ).toResponse();
  }

  let body: z.infer<typeof updateWorkspaceSchema>;
  try {
    const json = await request.json();
    body = updateWorkspaceSchema.parse(json);
  } catch (e) {
    return new ChatSDKError('bad_request:api', String(e)).toResponse();
  }

  try {
    const updatedWorkspace = await updateWorkspaceTitleById({
      workspaceId,
      name: body.name,
    });

    if (!updatedWorkspace) {
      return new ChatSDKError(
        'not_found:workspace',
        'Workspace not found',
      ).toResponse();
    }

    return NextResponse.json({
      workspace: updatedWorkspace,
    });
  } catch (error) {
    console.error('[Workspaces API] Error updating workspace:', error);
    return new ChatSDKError(
      'bad_request:database',
      'Failed to update workspace',
    ).toResponse();
  }
}
