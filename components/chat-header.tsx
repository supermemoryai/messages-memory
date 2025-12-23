'use client';

import type { Session } from 'next-auth';
import { useRouter } from 'next/navigation';
import type { UIMessage } from 'ai';
import { useCallback, useState } from 'react';

import { ModelSelector } from '@/components/model-selector';
// import { VisibilitySelector, type VisibilityType } from '@/components/visibility-selector';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RotateCcw, Link2, Loader2 } from 'lucide-react';
import { toast } from '@/components/toast';
import { generateUUID } from '@/lib/utils';

interface ChatHeaderProps {
  chatId: string;
  selectedModelId: string;
  // selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
  ) => void;
  onChatIdChange?: (newChatId: string) => void;
}

export function ChatHeader({
  chatId,
  selectedModelId,
  // selectedVisibilityType,
  isReadonly,
  session,
  setMessages,
  onChatIdChange,
}: ChatHeaderProps) {
  const router = useRouter();
  const handleStartNewChat = () => {
    const newChatId = generateUUID();

    // Persist the new chat ID for future sessions
    localStorage.setItem('supermemoryCurrentChatId', newChatId);

    // Clear local UI state
    setMessages([]);

    // Notify parent components if they need to react to the chat ID change
    if (onChatIdChange) {
      onChatIdChange(newChatId);
    }

    // Navigate to the new chat
    router.push(`/?id=${newChatId}`);
  };

  const handleClearChat = async () => {
    const confirmClear = window.confirm(
      'Are you sure you want to clear this chat? This will start a new conversation with a fresh history.',
    );
    if (!confirmClear) return;

    try {
      // Clear messages from the database
      const response = await fetch(`/api/chat/clear?id=${chatId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Generate a new chat ID for the fresh start
        const newChatId = generateUUID();

        // Update localStorage with the new chat ID
        localStorage.setItem('supermemoryCurrentChatId', newChatId);

        // Clear messages in the UI
        setMessages([]);

        // Notify parent component of the chat ID change if callback provided
        if (onChatIdChange) {
          onChatIdChange(newChatId);
        }

        // Update the URL to reflect the new chat ID
        window.history.pushState({}, '', `?id=${newChatId}`);

        toast({
          type: 'success',
          description: 'Chat cleared! Starting fresh conversation.',
        });
      } else {
        throw new Error('Failed to clear chat');
      }
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to clear chat',
      });
    }
  };

  const [connecting, setConnecting] = useState(false);
  const handleConnect = useCallback(
    async (provider: 'google-drive' | 'notion' | 'onedrive' | 'web-crawler' | 'github') => {
      setConnecting(true);
      try {
        const res = await fetch('/api/supermemory/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            chatId,
            documentLimit: 5000,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({
            type: 'error',
            description: data.message || 'Failed to start connection',
          });
          return;
        }

        const data = await res.json();
        if (data.authLink) {
          window.location.href = data.authLink;
          return;
        }

        toast({
          type: 'error',
          description: 'No auth link returned from Supermemory',
        });
      } catch (error) {
        toast({
          type: 'error',
          description: 'Failed to start connection',
        });
      } finally {
        setConnecting(false);
      }
    },
    [chatId],
  );

  return (
    <header className="flex sticky top-0 bg-background py-2 px-2 md:px-2 gap-2 z-10 border-b">
      <div className="flex flex-row gap-2 items-center">
        <ModelSelector session={session} selectedModelId={selectedModelId} />
      </div>

      <div className="flex flex-1 justify-end items-center gap-2">
        {!isReadonly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Connect data source"
                disabled={connecting}
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleConnect('google-drive')}>
                Connect Google Drive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleConnect('notion')}>
                Connect Notion
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleConnect('onedrive')}>
                Connect OneDrive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleConnect('github')}>
                Connect GitHub
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleConnect('web-crawler')}>
                Connect Web Crawler
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isReadonly && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            className="h-8 w-8"
            title="Clear chat and start fresh"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="outline"
          className="hidden md:flex md:px-2 md:h-[34px]"
          onClick={handleStartNewChat}
        >
          New Chat
        </Button>
      </div>
    </header>
  );
}
