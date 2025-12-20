import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { getWorkspacesByUserId, createWorkspace } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaces = await getWorkspacesByUserId({ userId: session.user.id });
  return NextResponse.json({ workspaces }, { status: 200 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:workspace').toResponse();
  }

  // Only regular users can create workspaces
  if (session.user.type !== 'regular') {
    return new ChatSDKError(
      'forbidden:workspace',
      'Only regular users can create workspaces',
    ).toResponse();
  }

  let body: z.infer<typeof createWorkspaceSchema>;
  try {
    const json = await request.json();
    body = createWorkspaceSchema.parse(json);
  } catch (e) {
    return new ChatSDKError('bad_request:api', String(e)).toResponse();
  }

  const workspace = await createWorkspace({
    name: body.name,
    createdBy: session.user.id,
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
