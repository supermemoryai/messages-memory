'use client';

import { useState, useEffect } from 'react';
import { toast } from './toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Users, Copy, Check } from 'lucide-react';

export function InviteButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Fetch workspace ID on mount
  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      try {
        const res = await fetch('/api/workspaces');
        if (!res.ok) return;
        const data = await res.json();
        const firstWorkspace = data?.workspaces?.[0]?.id ?? null;
        if (!cancelled) setWorkspaceId(firstWorkspace);
      } catch (error) {
        console.error('[InviteButton] Failed to load workspace:', error);
      }
    }
    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchExistingInvitation = async () => {
    if (!workspaceId) {
      toast({
        type: 'error',
        description: 'No workspace found',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/invitations?workspaceId=${workspaceId}`);

      if (!res.ok) {
        const data = await res.json();
        toast({
          type: 'error',
          description: data.message || 'Failed to fetch invitations',
        });
        setLoading(false);
        return;
      }

      const data = await res.json();

      // If there's an existing invitation, use it
      if (data.invitations && data.invitations.length > 0) {
        setInvitationUrl(data.invitations[0].url);
      } else {
        // No existing invitation, create a new one
        await generateNewInvitation();
        return;
      }

      setLoading(false);
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to fetch invitations',
      });
      setLoading(false);
    }
  };

  const generateNewInvitation = async () => {
    if (!workspaceId) {
      toast({
        type: 'error',
        description: 'No workspace found',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({
          type: 'error',
          description: data.message || 'Failed to generate invitation',
        });
        setLoading(false);
        return;
      }

      const data = await res.json();
      setInvitationUrl(data.invitation.url);
      setLoading(false);
      toast({
        type: 'success',
        description: 'New invitation link generated',
      });
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to generate invitation',
      });
      setLoading(false);
    }
  };

  const handleRegenerateClick = () => {
    setShowRegenerateDialog(true);
  };

  const handleConfirmRegenerate = async () => {
    setShowRegenerateDialog(false);
    await generateNewInvitation();
  };

  const handleCopy = async () => {
    if (!invitationUrl) return;

    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      toast({
        type: 'success',
        description: 'Invitation link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to copy to clipboard',
      });
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setInvitationUrl(null);
    setCopied(false);
    fetchExistingInvitation();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-2 rounded-md hover:bg-muted-foreground/10 transition-colors"
        aria-label="Invite to workspace"
        type="button"
      >
        <Users className="h-4 w-4" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to Workspace</DialogTitle>
            <DialogDescription>
              Share this link with others to invite them to your workspace. You
              can also{' '}
              <button
                onClick={handleRegenerateClick}
                className="text-primary hover:underline font-medium"
                disabled={loading}
                type="button"
              >
                generate a new link
              </button>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-gray-800 rounded-full dark:border-zinc-600 dark:border-t-zinc-200" />
              </div>
            ) : invitationUrl ? (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md break-all text-sm">
                  {invitationUrl}
                </div>
                <Button
                  onClick={handleCopy}
                  className="w-full"
                  variant="default"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Failed to load invitation link
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate new invitation link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will expire the previous invitation link. Anyone with the old
              link will no longer be able to use it to join your workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRegenerate}>
              Generate New Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
