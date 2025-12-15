import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { deleteMessagesByChatId } from '@/lib/db/queries';
import { getUserSpecificProfileId } from '@/data/initial-conversations';

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('id');

    if (!chatId) {
      return new NextResponse('Chat ID is required', { status: 400 });
    }

    // Get the container tag to delete from Supermemory
    const containerTag = session.user.id;
    console.log(
      '[Delete All] Starting deletion for containerTag:',
      containerTag,
    );

    // Delete all memories from Supermemory using the bulk delete endpoint
    const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
    if (!supermemoryApiKey) {
      console.error('[Delete All] SUPERMEMORY_API_KEY not configured');
      return new NextResponse('Supermemory API key not configured', {
        status: 500,
      });
    }

    console.log('[Delete All] Sending bulk delete request to Supermemory...');
    try {
      const requestBody = {
        containerTags: [containerTag],
      };
      console.log('[Delete All] Request body:', JSON.stringify(requestBody));

      const baseUrl = process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai';
      const deleteMemoriesResponse = await fetch(
        `${baseUrl}/v3/documents/bulk`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${supermemoryApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      console.log(
        '[Delete All] Supermemory response status:',
        deleteMemoriesResponse.status,
      );

      if (!deleteMemoriesResponse.ok) {
        const errorText = await deleteMemoriesResponse.text();
        console.error(
          '[Delete All] Failed to delete memories from Supermemory:',
          errorText,
        );
        console.error(
          '[Delete All] Response status:',
          deleteMemoriesResponse.status,
        );
        return new NextResponse('Failed to delete memories', { status: 500 });
      }

      const deleteResult = await deleteMemoriesResponse.json();
      console.log(
        '[Delete All] Successfully deleted memories:',
        JSON.stringify(deleteResult, null, 2),
      );
    } catch (error) {
      console.error(
        '[Delete All] Error deleting memories from Supermemory:',
        error,
      );
      return new NextResponse('Failed to delete memories', { status: 500 });
    }

    // Delete conversation history from the current chat
    await deleteMessagesByChatId({ id: chatId });

    // Also delete the profile chat messages since the profile data is now gone
    const profileChatId = getUserSpecificProfileId(session.user.id);
    try {
      await deleteMessagesByChatId({ id: profileChatId });
      console.log('[Delete All] Cleared profile chat messages');
    } catch (error) {
      console.error('[Delete All] Error clearing profile chat:', error);
      // Don't fail the whole operation if profile chat deletion fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'All memories and conversation history deleted successfully',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error in delete-all:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
