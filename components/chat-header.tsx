'use client';

import Link from 'next/link';
import type { Session } from 'next-auth';
import { useRouter } from 'next/navigation';
import type { UIMessage } from 'ai';

import { ModelSelector } from '@/components/model-selector';
import { VisibilitySelector, type VisibilityType } from '@/components/visibility-selector';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { toast } from '@/components/toast';
import { generateUUID } from '@/lib/utils';

interface ChatHeaderProps {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  setMessages: (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;
  onChatIdChange?: (newChatId: string) => void;
}

export function ChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  session,
  setMessages,
  onChatIdChange,
}: ChatHeaderProps) {
  const router = useRouter();

  const handleClearChat = async () => {
    const confirmClear = window.confirm('Are you sure you want to clear this chat? This will start a new conversation with a fresh history.');
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

  return (
    <header className="flex sticky top-0 bg-background py-2 px-2 md:px-2 gap-2 z-10 border-b">
      <div className="flex flex-row gap-2 items-center">
        <ModelSelector session={session} selectedModelId={selectedModelId} />
        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}
      </div>
      
      <div className="flex flex-1 justify-end items-center gap-2">
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
          asChild
          className="hidden md:flex md:px-2 md:h-[34px]"
        >
          <Link href="/">New Chat</Link>
        </Button>
      </div>
    </header>
  );
}

