'use client';

import type {
  Conversation,
  Reaction,
  ReactionType,
  Attachment,
} from '../types';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Icons } from './icons';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { MessageInput } from './message-input';
import { ConversationHeader } from './conversation-header';
import { Markdown } from './markdown';
import { TypingBubble } from './typing-bubble';

interface ChatAreaProps {
  isNewChat: boolean;
  activeConversation?: Conversation;
  recipientInput: string;
  setRecipientInput: (value: string) => void;
  isMobileView?: boolean;
  onBack?: () => void;
  onSendMessage: (
    message: string,
    conversationId?: string,
    attachments?: Attachment[],
  ) => void;
  onReaction?: (messageId: string, reaction: Reaction) => void;
  typingStatus: { conversationId: string; recipient: string } | null;
  conversationId: string | null;
  onUpdateConversationName?: (name: string) => void;
  onHideAlertsChange?: (hide: boolean) => void;
  messageDraft?: string;
  onMessageDraftChange?: (conversationId: string, message: string) => void;
  unreadCount?: number;
  onClearChat?: () => void;
  isReadOnly?: boolean;
  userId?: string;
}

export function ChatArea({
  isNewChat,
  activeConversation,
  recipientInput,
  setRecipientInput,
  isMobileView,
  onBack,
  onSendMessage,
  onReaction,
  typingStatus,
  conversationId,
  onUpdateConversationName,
  onHideAlertsChange,
  messageDraft = '',
  onMessageDraftChange,
  unreadCount = 0,
  onClearChat,
  isReadOnly = false,
  userId,
}: ChatAreaProps) {
  const [inputValue, setInputValue] = useState(messageDraft);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  // Reaction icon mappings
  const menuReactionIcons = {
    heart: '/reactions/heart-gray.svg',
    like: '/reactions/like-gray.svg',
    dislike: '/reactions/dislike-gray.svg',
    laugh: '/reactions/laugh-gray.svg',
    emphasize: '/reactions/emphasize-gray.svg',
    question: '/reactions/question-gray.svg',
  };

  // Helper function to get reaction icon SVG path
  const getReactionIconSvg = (
    reactionFromMe: boolean,
    messageFromMe: boolean,
    reactionType: ReactionType,
    isMobileView: boolean,
    overlay?: boolean,
  ) => {
    const orientation = messageFromMe ? 'left' : 'right';
    const baseVariant = effectiveTheme === 'dark' ? 'dark' : 'light';

    // If overlay is true, always use the base variant without "-blue"
    if (overlay) {
      return `/reactions/${orientation}-${baseVariant}-${reactionType}-overlay.svg`;
    }

    // Otherwise, if the reaction is from me and we're in mobile view, use the blue variant
    const variant =
      reactionFromMe && isMobileView ? `${baseVariant}-blue` : baseVariant;

    return `/reactions/${orientation}-${variant}-${reactionType}.svg`;
  };

  // Helper function to get reaction style with background image
  const getReactionStyle = (
    reaction: Reaction,
    isMe: boolean,
    isMobileView: boolean,
  ) => {
    const iconUrl = getReactionIconSvg(
      reaction.sender === 'me',
      isMe,
      reaction.type,
      isMobileView,
    );

    const mobileStyle = {
      backgroundImage: `url('${iconUrl}')`,
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    };

    if (isMobileView || reaction.sender !== 'me') {
      return mobileStyle;
    }

    return {
      WebkitMaskImage: `url('${iconUrl}')`,
      maskImage: `url('${iconUrl}')`,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      background: 'linear-gradient(to bottom, #47B5FF, #0A7CFF)',
      backgroundAttachment: 'fixed',
    };
  };

  // Check if a specific reaction type is already active for the current user
  const isReactionActive = (message: any, type: ReactionType) => {
    return (
      message.reactions?.some(
        (r: Reaction) => r.type === type && r.sender === 'me',
      ) ?? false
    );
  };

  useEffect(() => {
    setInputValue(messageDraft);
  }, [messageDraft]);

  // Reset input state when switching to/from read-only chats
  useEffect(() => {
    if (isReadOnly) {
      setInputValue('');
    }
  }, [isReadOnly, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (conversationId) {
      onMessageDraftChange?.(conversationId, value);
    }
  };

  const handleSend = (attachments?: Attachment[]) => {
    if (!inputValue.trim() && (!attachments || attachments.length === 0))
      return;

    // When sending attachments without text, send empty string (don't show blue bubble)
    const messageContent = inputValue.trim() || '';
    onSendMessage(messageContent, conversationId || undefined, attachments);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeConversation && !isNewChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background" />
    );
  }

  return (
    <div className="h-dvh relative bg-background">
      {/* Header with recipient management */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <ConversationHeader
          isNewChat={isNewChat}
          recipientInput={recipientInput}
          setRecipientInput={setRecipientInput}
          onBack={onBack}
          isMobileView={isMobileView}
          activeConversation={activeConversation}
          onUpdateConversationName={onUpdateConversationName}
          onHideAlertsChange={onHideAlertsChange}
          onClearChat={onClearChat}
          userId={userId}
        />
      </div>

      {/* Messages - iMessage style */}
      <div
        className={cn(
          'h-full overflow-y-auto px-4',
          isMobileView ? 'pt-24' : 'pt-20',
          'pb-[calc(var(--dynamic-height,64px)+0.5rem)]',
        )}
      >
        {activeConversation?.messages.flatMap((message, index) => {
          const isMe = message.sender === 'me';

          // Split message content if it contains <SPLIT>
          const contentParts = message.content
            .split(/<\s*SPLIT\s*>/gi)
            .map((c) => c.trim())
            .filter((c) => c.length > 0);

          // If no content but has attachments, render as single message
          if (
            contentParts.length === 0 &&
            message.attachments &&
            message.attachments.length > 0
          ) {
            contentParts.push(''); // Empty content to render attachments
          }

          // Skip messages with no content and no attachments
          if (contentParts.length === 0) {
            return [];
          }

          return contentParts.map((content, splitIndex) => {
            const prevMessage =
              index > 0 ? activeConversation.messages[index - 1] : null;
            const nextMessage =
              index < activeConversation.messages.length - 1
                ? activeConversation.messages[index + 1]
                : null;

            // First in group if: first split part AND (first message OR different sender from prev)
            const isFirstInGroup =
              splitIndex === 0 &&
              (!prevMessage || prevMessage.sender !== message.sender);
            // Last in group if: last split part AND (last message OR different sender from next)
            const isLastInGroup =
              splitIndex === contentParts.length - 1 &&
              (!nextMessage || nextMessage.sender !== message.sender);

            return (
              <div
                key={`${message.id}-split-${splitIndex}`}
                className={cn(
                  'flex',
                  isMe ? 'justify-end' : 'justify-start',
                  isFirstInGroup ? 'mt-3' : 'mt-0.5',
                  index === 0 && splitIndex === 0 && 'mt-0',
                )}
              >
                <div
                  className={cn(
                    'flex flex-col relative',
                    isMe ? 'items-end' : 'items-start',
                  )}
                >
                  {/* Display attachments only on first split part */}
                  {splitIndex === 0 &&
                    message.attachments &&
                    message.attachments.length > 0 && (
                      <div
                        className={cn(
                          'flex gap-2 flex-wrap mb-1 max-w-[280px] sm:max-w-md',
                          isMe ? 'justify-end' : 'justify-start',
                        )}
                      >
                        {message.attachments.map((attachment, idx) => (
                          <div
                            key={`${idx}-${message.content}`}
                            className="relative w-48 h-32 rounded-md overflow-hidden group"
                          >
                            {attachment.contentType.startsWith('image') ? (
                              <Image
                                src={attachment.url}
                                alt={attachment.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-2">
                                <Icons.paperclip className="h-8 w-8" />
                                <span className="text-xs px-2 text-center line-clamp-2">
                                  {attachment.name}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  {content && (
                    <div className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              'max-w-[280px] sm:max-w-md px-3.5 py-2 text-[17px] leading-[22px] break-words text-left',
                              isMe
                                ? 'bg-[#007AFF] text-white'
                                : 'bg-[#E9E9EB] dark:bg-[#262628] text-black dark:text-white',
                              // Bubble shape based on position in group
                              isMe
                                ? isFirstInGroup && isLastInGroup
                                  ? 'rounded-[18px]'
                                  : isFirstInGroup
                                    ? 'rounded-[18px] rounded-br-[4px]'
                                    : isLastInGroup
                                      ? 'rounded-[18px] rounded-tr-[4px]'
                                      : 'rounded-[18px] rounded-tr-[4px] rounded-br-[4px]'
                                : isFirstInGroup && isLastInGroup
                                  ? 'rounded-[18px]'
                                  : isFirstInGroup
                                    ? 'rounded-[18px] rounded-bl-[4px]'
                                    : isLastInGroup
                                      ? 'rounded-[18px] rounded-tl-[4px]'
                                      : 'rounded-[18px] rounded-tl-[4px] rounded-bl-[4px]',
                            )}
                          >
                            <div
                              className={cn(
                                'prose prose-sm max-w-none',
                                isMe ? 'prose-invert' : 'dark:prose-invert',
                                '[&_p]:my-1 [&_p]:leading-[22px] [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
                                '[&_h1]:text-xl [&_h1]:mt-2 [&_h1]:mb-1',
                                '[&_h2]:text-lg [&_h2]:mt-2 [&_h2]:mb-1',
                                '[&_h3]:text-base [&_h3]:mt-2 [&_h3]:mb-1',
                                '[&_ul]:my-1 [&_ol]:my-1',
                                '[&_li]:my-0',
                                '[&_code]:text-sm [&_code]:rounded [&_code]:px-1',
                                isMe
                                  ? '[&_a]:text-white [&_a]:underline'
                                  : '[&_a]:text-blue-500',
                              )}
                            >
                              <Markdown>{content}</Markdown>
                            </div>
                          </button>
                        </PopoverTrigger>

                        {/* Reaction menu */}
                        <PopoverContent
                          className="flex p-2 gap-2 w-fit rounded-full bg-gray-100 dark:bg-[#404040] z-50"
                          align={isMe ? 'end' : 'start'}
                          alignOffset={-8}
                          side="top"
                          sideOffset={20}
                        >
                          {/* Reaction buttons */}
                          {Object.entries(menuReactionIcons).map(
                            ([type, icon]) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  onReaction?.(message.id, {
                                    type: type as ReactionType,
                                    sender: 'me',
                                    timestamp: new Date().toISOString(),
                                  });
                                }}
                                className={cn(
                                  'inline-flex items-center justify-center rounded-full w-8 h-8 aspect-square p-0 cursor-pointer text-base transition-all duration-200 ease-out text-gray-500 hover:scale-125 flex-shrink-0',
                                  isReactionActive(
                                    message,
                                    type as ReactionType,
                                  )
                                    ? 'bg-[#0A7CFF] text-white scale-110'
                                    : '',
                                )}
                              >
                                <Image
                                  src={
                                    isReactionActive(
                                      message,
                                      type as ReactionType,
                                    )
                                      ? icon
                                          .replace('-gray', '-white')
                                          .replace('-dark', '-white')
                                      : icon
                                  }
                                  width={16}
                                  height={16}
                                  alt={`${type} reaction`}
                                  style={
                                    type === 'emphasize'
                                      ? { transform: 'scale(0.75)' }
                                      : type === 'question'
                                        ? { transform: 'scale(0.6)' }
                                        : undefined
                                  }
                                />
                              </button>
                            ),
                          )}
                        </PopoverContent>
                      </Popover>

                      {/* Display existing reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div
                          className={cn(
                            'absolute -top-8 flex',
                            isMe ? '-left-8' : '-right-8',
                            isMe ? 'flex-row' : 'flex-row-reverse',
                          )}
                        >
                          {[...message.reactions]
                            .sort(
                              (a, b) =>
                                new Date(a.timestamp).getTime() -
                                new Date(b.timestamp).getTime(),
                            )
                            .map((reaction, index, array) => (
                              <div
                                key={`${reaction.type}-${reaction.timestamp}`}
                                className={cn(
                                  'w-8 h-8 flex items-center justify-center text-sm relative cursor-pointer',
                                  index !== array.length - 1 &&
                                    (isMe ? '-mr-7' : '-ml-7'),
                                )}
                                style={{
                                  ...getReactionStyle(
                                    reaction,
                                    isMe,
                                    isMobileView ?? false,
                                  ),
                                  zIndex: array.length - index,
                                }}
                              >
                                {reaction.sender === 'me' && !isMobileView && (
                                  <Image
                                    src={getReactionIconSvg(
                                      reaction.sender === 'me',
                                      isMe,
                                      reaction.type,
                                      isMobileView ?? false,
                                      true,
                                    )}
                                    width={32}
                                    height={32}
                                    alt={`${reaction.type} reaction`}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                                  />
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                  {isLastInGroup && (
                    <div
                      className={cn(
                        'text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 px-1',
                        isMe ? 'text-right' : 'text-left',
                      )}
                    >
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          });
        })}

        {/* Typing indicator */}
        {typingStatus && typingStatus.conversationId === conversationId && (
          <TypingBubble
            senderName={typingStatus.recipient}
            isMobileView={isMobileView}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - iMessage style with TipTap - hide for read-only chats */}
      {!isReadOnly && (
        <div className="absolute bottom-0 left-0 right-0 z-50 mb-[env(keyboard-inset-height,0px)]">
          <MessageInput
            message={inputValue}
            setMessage={handleInputChange}
            handleSend={handleSend}
            disabled={false}
            recipients={activeConversation?.recipients || []}
            isMobileView={isMobileView ?? false}
            conversationId={conversationId ?? undefined}
            isNewChat={isNewChat}
          />
        </div>
      )}
    </div>
  );
}
