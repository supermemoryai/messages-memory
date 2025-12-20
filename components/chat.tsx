'use client';

import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import type { Attachment } from '@ai-sdk/ui-utils';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  console.log(
    '[CHAT] Component rendered with initialMessages:',
    initialMessages.length,
  );
  const { mutate } = useSWRConfig();

  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const [input, setInput] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Fetch workspaces and select first one
  useEffect(() => {
    let cancelled = false;
    async function loadWorkspaces() {
      try {
        const res = await fetch('/api/workspaces');
        if (!res.ok) return;
        const data = await res.json();
        const first = data?.workspaces?.[0]?.id ?? null;
        if (!cancelled) setWorkspaceId(first);
      } catch (error) {
        console.error('[Chat] Failed to load workspaces:', error);
      }
    }
    loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages }) {
        return {
          body: {
            id,
            workspaceId,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
          },
        };
      },
    }),

    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey(workspaceId)));

      // Disabled message eviction for now
      // const totalTokens = usage?.totalTokens || 0;
      // console.log('totalTokens in chat.tsx', totalTokens);
      // if (totalTokens > 10000) {
      //   console.log('deleting oldest message in chat.tsx');
      //   setMessages((messages) => messages.slice(2));
      // }
    },

    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      }
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workspaceId) return; // Wait for workspace to load
    if (!input.trim()) return;

    sendMessage({ text: input });
    setInput('');
  };

  const append = (message: { role: 'user'; content: string }) => {
    sendMessage({ text: message.content });
  };

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      append({
        role: 'user',
        content: query,
      });

      setHasAppendedQuery(true);
    }
  }, [query, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background/95 dark:bg-[url(/images/gradient.png)] dark:bg-cover dark:backdrop-blur-3xl">
        <ChatHeader
          chatId={id}
          selectedModelId={initialChatModel}
          // selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
          setMessages={setMessages}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
              selectedVisibilityType={visibilityType}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
    </>
  );
}
