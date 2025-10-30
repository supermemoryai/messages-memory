import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.SUPERMEMORY_API_KEY) {
      return NextResponse.json(
        { error: 'Supermemory API key not configured' },
        { status: 500 },
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      page = 1,
      limit = 500, // Start with 500 documents
      sort = 'createdAt',
      order = 'desc',
    } = body;

    // Always use user ID as container tag
    const containerTag = session.user.id;
    console.log('[Documents API] Using container tag:', containerTag);
    console.log('[Documents API] Fetching page:', page, 'limit:', limit);

    try {
      // Fetch documents from Supermemory API
      const response = await fetch(
        'https://api.supermemory.ai/v3/documents/documents',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.SUPERMEMORY_API_KEY,
          },
          body: JSON.stringify({
            page,
            limit,
            sort,
            order,
            containerTags: [containerTag], // Filter by user's container tag only
          }),
        },
      );

      if (!response.ok) {
        console.error(
          '[Documents API] Failed to fetch documents:',
          response.status,
        );
        const errorText = await response.text();
        console.error('[Documents API] Error details:', errorText);

        return NextResponse.json(
          {
            documents: [],
            pagination: {
              currentPage: 1,
              totalPages: 0,
              totalItems: 0,
              limit: limit,
            },
          },
          { status: 200 },
        );
      }

      const data = await response.json();
      console.log(
        '[Documents API] Fetched',
        data.documents?.length || 0,
        'documents',
      );

      console.log(data);

      // Transform the data if needed to match the expected format
      const result = {
        documents: data.documents || [],
        pagination: data.pagination || {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          limit: limit,
        },
      };

      return NextResponse.json(result, { status: 200 });
    } catch (fetchError) {
      console.error(
        '[Documents API] Error fetching from Supermemory:',
        fetchError,
      );

      // Return empty documents list if API fails
      return NextResponse.json(
        {
          documents: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            limit: limit,
          },
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error('[Documents API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
