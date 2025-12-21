'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from '@/components/toast';
import { SubmitButton } from '@/components/submit-button';
import Link from 'next/link';

interface InvitationDetails {
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvitation() {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.message || 'Invitation not found or expired');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setInvitation(data.invitation);
        setLoading(false);
      } catch (e) {
        setError('Failed to load invitation');
        setLoading(false);
      }
    }

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!session?.user) {
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        toast({
          type: 'error',
          description: data.message || 'Failed to accept invitation',
        });
        setAccepting(false);
        return;
      }

      const data = await res.json();

      if (data.alreadyMember) {
        toast({
          type: 'success',
          description: `Redirecting to ${data.workspaceName}...`,
        });
      } else {
        toast({
          type: 'success',
          description: `Successfully joined ${data.workspaceName}!`,
        });
      }

      // Redirect to home with the invited workspace ID
      // Using window.location to force a full reload and ensure workspace list is refreshed
      window.location.href = `/?invitedWorkspace=${data.workspaceId}`;
    } catch (e) {
      toast({
        type: 'error',
        description: 'Failed to accept invitation',
      });
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
            <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-gray-800 rounded-full dark:border-zinc-600 dark:border-t-zinc-200" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Loading invitation...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
        <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
            <h3 className="text-xl font-semibold dark:text-zinc-50">
              Invalid Invitation
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400">{error}</p>
            <Link
              href="/"
              className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const isGuest = session?.user?.type === 'guest';

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">
            Workspace Invitation
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            You've been invited to join
          </p>
          <p className="text-lg font-semibold mt-2 dark:text-zinc-50">
            {invitation.workspaceName}
          </p>
        </div>

        <div className="flex flex-col gap-4 px-4 sm:px-16">
          {status === 'unauthenticated' ? (
            <>
              <p className="text-sm text-gray-600 dark:text-zinc-400 text-center">
                Please sign in to accept this invitation
              </p>
              <Link
                href={`/login?redirect=/invite/${token}`}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 text-center"
              >
                Sign In
              </Link>
              <p className="text-center text-sm text-gray-600 dark:text-zinc-400">
                {"Don't have an account? "}
                <Link
                  href={`/register?redirect=/invite/${token}`}
                  className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
                >
                  Sign up
                </Link>
                {' for free.'}
              </p>
            </>
          ) : isGuest ? (
            <>
              <p className="text-sm text-gray-600 dark:text-zinc-400 text-center">
                Guest users cannot accept invitations. Please create an account
                to join this workspace.
              </p>
              <Link
                href={`/register?redirect=/invite/${token}`}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 text-center"
              >
                Create Account
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
              <Link
                href="/"
                className="text-center text-sm text-gray-600 hover:underline dark:text-zinc-400"
              >
                Cancel
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
