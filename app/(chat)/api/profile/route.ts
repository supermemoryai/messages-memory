import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user profile from Supermemory using search with profile mode
    if (!process.env.SUPERMEMORY_API_KEY) {
      return NextResponse.json(
        { error: 'Supermemory API key not configured' },
        { status: 500 }
      );
    }

    try {
      // Use Supermemory v4 profile API to get the user's profile
      // This is the same profile that gets injected into LLM calls
      // containerTag is the user's session ID (dynamically generated, not hardcoded)
      const response = await fetch('https://api.supermemory.ai/v4/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.SUPERMEMORY_API_KEY,
        },
        body: JSON.stringify({
          containerTag: userId,
        }),
      });

      if (!response.ok) {
        console.error('[Profile API] Failed to fetch profile:', response.status);
        const errorText = await response.text();
        console.error('[Profile API] Error details:', errorText);
        
        return NextResponse.json(
          {
            profile: {
              userId: userId,
              name: session.user.name || session.user.email || 'User',
              email: session.user.email,
              summary: 'No profile data available yet. Start chatting to build your profile!',
              memories: [],
            },
          },
          { status: 200 }
        );
      }

      const data = await response.json();
      
      // v4/profile returns the profile data directly
      const profile = data.profile || data;
      
      return NextResponse.json({ 
        profile: {
          userId: userId,
          name: session.user.name || session.user.email || 'User',
          email: session.user.email,
          summary: profile.summary || profile.context || '',
          facts: profile.facts || [],
          preferences: profile.preferences || [],
          context: profile.context || '',
          memories: (profile.memories || []).slice(0, 10).map((memory: any) => ({
            content: memory.content || memory.text || '',
            timestamp: memory.createdAt || memory.timestamp,
            source: memory.source || memory.metadata?.source,
          })),
        }
      }, { status: 200 });
    } catch (fetchError) {
      console.error('[Profile API] Error fetching from Supermemory:', fetchError);
      
      // Return basic profile if Supermemory API fails
      return NextResponse.json(
        {
          profile: {
            userId: userId,
            name: session.user.name || session.user.email || 'User',
            email: session.user.email,
            summary: 'Unable to fetch profile data at this time.',
            memories: [],
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('[Profile API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

