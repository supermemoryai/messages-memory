import { NextResponse } from 'next/server';
import { getInvitationByToken } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invitation = await getInvitationByToken({ token });

  if (!invitation) {
    return new ChatSDKError(
      'not_found:workspace',
      'Invitation not found or expired',
    ).toResponse();
  }

  return NextResponse.json({
    invitation: {
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspaceName,
      createdAt: invitation.createdAt,
    },
  });
}
