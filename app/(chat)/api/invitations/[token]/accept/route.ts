import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import {
  getInvitationByToken,
  getWorkspaceMember,
  addWorkspaceMember,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:workspace').toResponse();
  }

  // Only regular users can accept invitations (not guest users)
  if (session.user.type !== 'regular') {
    return new ChatSDKError(
      'forbidden:workspace',
      'Only regular users can accept invitations',
    ).toResponse();
  }

  const { token } = await params;

  // Get invitation details
  const invitation = await getInvitationByToken({ token });

  if (!invitation) {
    return new ChatSDKError(
      'not_found:workspace',
      'Invitation not found or expired',
    ).toResponse();
  }

  // Check if user is already a member of the workspace
  const existingMember = await getWorkspaceMember({
    workspaceId: invitation.workspaceId,
    userId: session.user.id,
  });

  if (existingMember) {
    // User is already a member, just redirect them to the workspace
    return NextResponse.json(
      {
        success: true,
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspaceName,
        alreadyMember: true,
      },
      { status: 200 },
    );
  }

  try {
    // Add user to workspace
    await addWorkspaceMember({
      workspaceId: invitation.workspaceId,
      userId: session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspaceName,
        alreadyMember: false,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Invitations API] Error accepting invitation:', error);
    return new ChatSDKError(
      'bad_request:database',
      'Failed to accept invitation',
    ).toResponse();
  }
}
