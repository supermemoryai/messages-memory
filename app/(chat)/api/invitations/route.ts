import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import {
  createInvitation,
  getWorkspaceMember,
  getInvitationsByWorkspaceId,
  deleteInvitationsByWorkspaceId,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';

const createInvitationSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:workspace').toResponse();
  }

  // Only regular users can view invitations (not guest users)
  if (session.user.type !== 'regular') {
    return new ChatSDKError(
      'forbidden:workspace',
      'Only regular users can view invitations',
    ).toResponse();
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return new ChatSDKError('bad_request:api', 'workspaceId is required').toResponse();
  }

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

  try {
    const invitations = await getInvitationsByWorkspaceId({ workspaceId });

    // Generate full URLs for each invitation
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';
    const invitationsWithUrls = invitations.map((inv) => ({
      ...inv,
      url: `${baseUrl}/invite/${inv.token}`,
    }));

    return NextResponse.json({
      invitations: invitationsWithUrls,
    });
  } catch (error) {
    console.error('[Invitations API] Error fetching invitations:', error);
    return new ChatSDKError(
      'bad_request:database',
      'Failed to fetch invitations',
    ).toResponse();
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:workspace').toResponse();
  }

  // Only regular users can create invitations (not guest users)
  if (session.user.type !== 'regular') {
    return new ChatSDKError(
      'forbidden:workspace',
      'Only regular users can create invitations',
    ).toResponse();
  }

  let body: z.infer<typeof createInvitationSchema>;
  try {
    const json = await request.json();
    body = createInvitationSchema.parse(json);
  } catch (e) {
    return new ChatSDKError('bad_request:api', String(e)).toResponse();
  }

  // Check if user is a member of the workspace
  const member = await getWorkspaceMember({
    workspaceId: body.workspaceId,
    userId: session.user.id,
  });

  if (!member) {
    return new ChatSDKError(
      'forbidden:workspace',
      'Not a member of this workspace',
    ).toResponse();
  }

  try {
    // Delete all existing invitations for this workspace
    await deleteInvitationsByWorkspaceId({ workspaceId: body.workspaceId });

    // Create new invitation
    const invitation = await createInvitation({
      workspaceId: body.workspaceId,
      createdBy: session.user.id,
    });

    // Generate the full invitation URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/invite/${invitation.token}`;

    return NextResponse.json(
      {
        invitation: {
          ...invitation,
          url: invitationUrl,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[Invitations API] Error creating invitation:', error);
    return new ChatSDKError(
      'bad_request:database',
      'Failed to create invitation',
    ).toResponse();
  }
}
