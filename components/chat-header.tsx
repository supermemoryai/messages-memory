'use client';

import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';

import { Button } from '@/components/ui/button';
import { PlusIcon, TrashIcon } from './icons';
import { memo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import type { VisibilityType } from './visibility-selector';
import type { Session } from 'next-auth';
import type { UseChatHelpers } from '@ai-sdk/react';
import { toast } from './toast';
import { clearChat } from '@/app/(chat)/actions';

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  session,
  setMessages,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  setMessages: UseChatHelpers['setMessages'];
}) {
  const router = useRouter();

  const open = false;

  const { width: windowWidth } = useWindowSize();

  const handleClearChat = async () => {
    try {
      // Clear messages from UI first for immediate feedback
      setMessages([]);

      // Clear messages from database
      await clearChat({ id: chatId });
    } catch (error) {
      toast({
        type: 'error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to clear chat history',
      });
    }
  };

  return (
    <header className="flex sticky top-0 py-1.5 items-center px-2 md:px-2 gap-2">
      {!isReadonly && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="p-2 m-1 h-auto mr-auto bg-background"
            >
              <TrashIcon />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear chat?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all messages in this chat. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearChat}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
