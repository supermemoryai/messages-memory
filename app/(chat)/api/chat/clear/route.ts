import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { deleteMessagesByChatId } from '@/lib/db/queries';

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

    await deleteMessagesByChatId({ id: chatId });

    return new NextResponse('Chat cleared successfully', { status: 200 });
  } catch (error) {
    console.error('Error clearing chat:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
