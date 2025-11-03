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
import { FileIcon, Icons } from './icons';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { MessageInput } from './message-input';
import { ConversationHeader } from './conversation-header';
import { Markdown } from './markdown';
import { TypingBubble } from './typing-bubble';
import { MessageForm } from './message-form';
import { MemoryGraphView } from './memory-graph-view';

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
  onReaction?: (
    messageId: string,
    reaction: Reaction,
    splitIndex?: number,
  ) => void;
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
  const [submittedForm, setSubmittedForm] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeReactionTarget, setActiveReactionTarget] = useState<{
    messageId: string;
    splitIndex?: number;
  } | null>(null);
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;
  const currentReactionActor = 'me';

  // Helper to determine which actor identifier should be used when creating/checking reactions.
  // For now, UI reactions are attributed to the current user ("me"). Change this if you use a different actor id.
  const getReactionActorForMessage = (_sender: string) => {
    return currentReactionActor;
  };

  const isReactionMenuOpen = (
    messageId: string,
    splitIndex?: number,
  ): boolean => {
    return (
      activeReactionTarget?.messageId === messageId &&
      (activeReactionTarget?.splitIndex ?? null) === (splitIndex ?? null)
    );
  };

  const closeReactionMenu = () => {
    setActiveReactionTarget(null);
  };

  const openReactionMenu = (messageId: string, splitIndex?: number) => {
    setActiveReactionTarget({ messageId, splitIndex });
  };

  const handleReactionMenuToggle = (
    open: boolean,
    messageId: string,
    splitIndex?: number,
  ) => {
    if (open) {
      openReactionMenu(messageId, splitIndex);
    } else if (isReactionMenuOpen(messageId, splitIndex)) {
      closeReactionMenu();
    }
  };

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
  const isReactionActive = (
    message: any,
    type: ReactionType,
    actor: string,
    splitIndex?: number,
    hasSplits?: boolean,
  ) => {
    return (
      message.reactions?.some(
        (r: Reaction) =>
          r.type === type &&
          r.sender === actor &&
          // Check splitIndex if message has splits
          (!hasSplits ||
            r.splitIndex === splitIndex ||
            (r.splitIndex === undefined && splitIndex === 0)),
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

  useEffect(() => {
    setActiveReactionTarget(null);
  }, [conversationId]);

  useEffect(() => {
    if (
      localStorage.getItem('submittedForm') === `submitted-${conversationId}`
    ) {
      setSubmittedForm(true);
    } else {
      setSubmittedForm(false);
    }
  }, [conversationId]);

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

  // Check if this is a Profile conversation
  const isProfileChat = activeConversation?.recipients.some(
    (r) => r.name === 'Profile',
  );

  // For Profile chat on desktop, show split view
  if (isProfileChat && !isMobileView) {
    return (
      <div className="h-dvh flex bg-background">
        {/* Left side: Chat area (50%) */}
        <div className="w-1/2 h-full relative">
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
              'pt-20',
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

              // Calculate if this is a recent message for animation
              const totalMessages = activeConversation.messages.length;
              const recentThreshold = 5; // Show animation for last 5 messages
              const isRecentMessage = index >= totalMessages - recentThreshold;

              // Calculate animation delay based on position in recent messages
              const recentMessageIndex = isRecentMessage
                ? index - (totalMessages - recentThreshold)
                : -1;

              return contentParts.map((content, splitIndex) => {
                const prevMessage =
                  index > 0 ? activeConversation.messages[index - 1] : null;
                const nextMessage =
                  index < activeConversation.messages.length - 1
                    ? activeConversation.messages[index + 1]
                    : null;
                const reactionSplitIndex =
                  contentParts.length > 1 ? splitIndex : undefined;
                const reactionActor = getReactionActorForMessage(
                  message.sender,
                );

                // First in group if: first split part AND (first message OR different sender from prev)
                const isFirstInGroup =
                  splitIndex === 0 &&
                  (!prevMessage || prevMessage.sender !== message.sender);
                // Last in group if: last split part AND (last message OR different sender from next)
                const isLastInGroup =
                  splitIndex === contentParts.length - 1 &&
                  (!nextMessage || nextMessage.sender !== message.sender);

                const isNewMessage =
                  new Date().getTime() - new Date(message.timestamp).getTime() <
                  2000;

                // Calculate staggered animation delay - messages appear one by one
                const baseDelay = 150; // Base delay between messages in ms
                const splitDelay = 75; // Additional delay for split parts
                const animationDelay =
                  isRecentMessage && isNewMessage
                    ? `${recentMessageIndex * baseDelay + splitIndex * Math.random() * splitDelay}ms`
                    : '0ms';

                return (
                  <div
                    key={`${message.id}-split-${splitIndex}`}
                    className={cn(
                      'flex',
                      isMe ? 'justify-end' : 'justify-start',
                      isFirstInGroup ? 'mt-3' : 'mt-0.5',
                      index === 0 && splitIndex === 0 && 'mt-0',
                      isRecentMessage && isNewMessage && 'animate-message-in',
                    )}
                    style={{
                      animationDelay:
                        isRecentMessage && isNewMessage
                          ? animationDelay
                          : undefined,
                    }}
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
                          {/* Only show Popover for reactions if message doesn't have a form or form was submitted */}
                          {!message.form || submittedForm ? (
                            <Popover
                              open={isReactionMenuOpen(
                                message.id,
                                reactionSplitIndex,
                              )}
                              onOpenChange={(open) =>
                                handleReactionMenuToggle(
                                  open,
                                  message.id,
                                  reactionSplitIndex,
                                )
                              }
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  disabled={
                                    isProfileChat || submittedForm === false
                                  }
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
                                            ? `rounded-[18px] rounded-tl-[4px]`
                                            : 'rounded-[18px] rounded-tl-[4px] rounded-bl-[4px]',
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'prose prose-sm max-w-none',
                                      isMe
                                        ? 'prose-invert'
                                        : 'dark:prose-invert',
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
                                        onReaction?.(
                                          message.id,
                                          {
                                            type: type as ReactionType,
                                            sender: reactionActor,
                                            timestamp: new Date().toISOString(),
                                            splitIndex:
                                              contentParts.length > 1
                                                ? splitIndex
                                                : undefined,
                                          },
                                          contentParts.length > 1
                                            ? splitIndex
                                            : undefined,
                                        );
                                        closeReactionMenu();
                                      }}
                                      className={cn(
                                        'inline-flex items-center justify-center rounded-full w-7 h-7 aspect-square p-0 cursor-pointer text-sm transition-colors duration-200 ease-out text-gray-500 flex-shrink-0',
                                        isReactionActive(
                                          message,
                                          type as ReactionType,
                                          reactionActor,
                                          splitIndex,
                                          contentParts.length > 1,
                                        ) && 'bg-[#0A7CFF] text-white',
                                      )}
                                    >
                                      <Image
                                        src={
                                          isReactionActive(
                                            message,
                                            type as ReactionType,
                                            reactionActor,
                                            splitIndex,
                                            contentParts.length > 1,
                                          )
                                            ? icon
                                                .replace('-gray', '-white')
                                                .replace('-dark', '-white')
                                            : icon
                                        }
                                        width={14}
                                        height={14}
                                        alt={`${type} reaction`}
                                        style={
                                          type === 'emphasize'
                                            ? { transform: 'scale(0.82)' }
                                            : type === 'question'
                                              ? { transform: 'scale(0.58)' }
                                              : undefined
                                        }
                                      />
                                    </button>
                                  ),
                                )}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            /* When there's a form and it hasn't been submitted, render without popover */
                            <div
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
                              {/* Render form if it exists and hasn't been submitted */}
                              {message.form && !submittedForm && (
                                <MessageForm
                                  messageId={message.id}
                                  onSubmit={(data) => {
                                    // Send the form submission directly without updating input state
                                    onSendMessage(
                                      `Hello, I am ${data.name}\n My email is${data.email}`,
                                      conversationId || undefined,
                                    );
                                    setSubmittedForm(true);
                                    localStorage.setItem(
                                      `submittedForm`,
                                      `submitted-${conversationId}`,
                                    );
                                  }}
                                />
                              )}
                            </div>
                          )}

                          {/* Display existing reactions */}
                          {message.reactions &&
                            message.reactions.length > 0 && (
                              <div
                                className={cn(
                                  'absolute -top-10 flex',
                                  isMe
                                    ? 'left-0 flex-row'
                                    : 'right-0 flex-row-reverse',
                                )}
                              >
                                {[...message.reactions]
                                  .filter(
                                    (r) =>
                                      // Only show reactions for this split part
                                      contentParts.length <= 1 ||
                                      r.splitIndex === splitIndex ||
                                      (r.splitIndex === undefined &&
                                        splitIndex === 0), // Backward compatibility
                                  )
                                  .sort(
                                    (a, b) =>
                                      new Date(a.timestamp).getTime() -
                                      new Date(b.timestamp).getTime(),
                                  )
                                  .map((reaction, index, array) => (
                                    <div
                                      key={`${reaction.type}-${reaction.timestamp}`}
                                      className={cn(
                                        'w-10 h-10 flex items-center justify-center text-sm relative cursor-pointer',
                                        index !== array.length - 1 &&
                                          (isMe ? '-ml-9' : '-mr-9'),
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
                                      {reaction.sender === 'me' &&
                                        !isMobileView && (
                                          <Image
                                            src={getReactionIconSvg(
                                              reaction.sender === 'me',
                                              isMe,
                                              reaction.type,
                                              isMobileView ?? false,
                                              true,
                                            )}
                                            width={36}
                                            height={36}
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
          {!isReadOnly && submittedForm && (
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

        {/* Right side: Memory Graph (50%) */}
        <div className="w-1/2 h-full border-l border-border">
          <MemoryGraphView isActive={true} />
        </div>
      </div>
    );
  }

  // Regular full-width chat view for non-Profile conversations
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
          const contentParts = message.content.split(/<\s*SPLIT\s*>/gi);

          const prevMessage =
            index > 0 ? activeConversation.messages[index - 1] : null;
          const nextMessage =
            index < activeConversation.messages.length - 1
              ? activeConversation.messages[index + 1]
              : null;

          const recentMessageCount = activeConversation.messages.filter(
            (m) =>
              new Date().getTime() - new Date(m.timestamp).getTime() < 2000,
          ).length;
          const recentMessageIndex = activeConversation.messages
            .filter(
              (m) =>
                new Date().getTime() - new Date(m.timestamp).getTime() < 2000,
            )
            .indexOf(message);
          const isRecentMessage = recentMessageIndex !== -1;

          const hasSplits = contentParts.length > 1;

          return contentParts.map((contentPart, splitIndex) => {
            // First in group if: first split part AND (first message OR different sender from prev)
            const isFirstInGroup =
              splitIndex === 0 &&
              (!prevMessage || prevMessage.sender !== message.sender);
            // Last in group if: last split part AND (last message OR different sender from next)
            const isLastInGroup =
              splitIndex === contentParts.length - 1 &&
              (!nextMessage || nextMessage.sender !== message.sender);

            const isNewMessage =
              new Date().getTime() - new Date(message.timestamp).getTime() <
              2000;
            const reactionSplitIndex = hasSplits ? splitIndex : undefined;
            const reactionActor = getReactionActorForMessage(message.sender);

            // Calculate staggered animation delay - messages appear one by one
            const baseDelay = 150; // Base delay between messages in ms
            const splitDelay = 75; // Additional delay for split parts
            const animationDelay =
              isRecentMessage && isNewMessage
                ? `${recentMessageIndex * baseDelay + splitIndex * Math.random() * splitDelay}ms`
                : '0ms';

            return (
              <div
                key={`${message.id}-split-${splitIndex}`}
                className={cn(
                  'flex',
                  isMe ? 'justify-end' : 'justify-start',
                  isFirstInGroup ? 'mt-3' : 'mt-0.5',
                  index === 0 && splitIndex === 0 && 'mt-0',
                  isRecentMessage && isNewMessage && 'animate-message-in',
                )}
                style={{
                  animationDelay:
                    isRecentMessage && isNewMessage
                      ? animationDelay
                      : undefined,
                }}
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
                          'flex flex-wrap gap-2 mb-2 max-w-sm',
                          isMe ? 'justify-end' : 'justify-start',
                        )}
                      >
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.url}
                            className="relative group cursor-pointer"
                          >
                            {attachment.contentType.includes('image') ? (
                              <Image
                                src={attachment.url}
                                alt="attachment"
                                width={200}
                                height={150}
                                className="rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <FileIcon />
                                <span className="text-sm truncate max-w-[150px]">
                                  {attachment.name}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Message bubble and reactions */}
                  {!isNewChat && (
                    <div className="group relative flex items-start gap-1">
                      {/* Sender name - only on first split */}
                      {splitIndex === 0 &&
                        !isMe &&
                        activeConversation?.recipients.length > 1 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {message.sender}
                          </div>
                        )}

                      {/* Message bubble container */}
                      <div className="relative">
                        <Popover
                          open={isReactionMenuOpen(
                            message.id,
                            reactionSplitIndex,
                          )}
                          onOpenChange={(open) =>
                            handleReactionMenuToggle(
                              open,
                              message.id,
                              reactionSplitIndex,
                            )
                          }
                        >
                          <PopoverTrigger asChild>
                            <button
                              disabled={
                                isProfileChat || submittedForm === false
                              }
                              className={cn(
                                'px-4 py-2 rounded-2xl text-left break-words whitespace-pre-wrap relative',
                                'transition-all duration-200',
                                isMe
                                  ? 'bg-[#0A7CFF] text-white ml-auto'
                                  : 'bg-gray-100 dark:bg-[#262729] text-gray-900 dark:text-gray-100',
                                isMobileView ? 'max-w-[280px]' : 'max-w-md',
                                isFirstInGroup && isMe && 'rounded-tr-sm',
                                isFirstInGroup && !isMe && 'rounded-tl-sm',
                                !isFirstInGroup &&
                                  !isLastInGroup &&
                                  isMe &&
                                  'rounded-r-sm',
                                !isFirstInGroup &&
                                  !isLastInGroup &&
                                  !isMe &&
                                  'rounded-l-sm',
                                isLastInGroup && isMe && 'rounded-br-sm',
                                isLastInGroup && !isMe && 'rounded-bl-sm',
                              )}
                              type="button"
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
                                <Markdown>{contentPart}</Markdown>
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="flex p-2 gap-2 w-fit rounded-full bg-gray-100 dark:bg-[#404040] z-50"
                            align={isMe ? 'end' : 'start'}
                            alignOffset={-8}
                            side="top"
                            sideOffset={20}
                          >
                            {Object.entries(menuReactionIcons).map(
                              ([type, icon]) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => {
                                    onReaction?.(
                                      message.id,
                                      {
                                        type: type as ReactionType,
                                        sender: reactionActor,
                                        timestamp: new Date().toISOString(),
                                        splitIndex: reactionSplitIndex,
                                      },
                                      reactionSplitIndex,
                                    );
                                    closeReactionMenu();
                                  }}
                                  className={cn(
                                    'inline-flex items-center justify-center rounded-full w-7 h-7 aspect-square p-0 cursor-pointer text-sm transition-colors duration-200 ease-out text-gray-500 flex-shrink-0',
                                    isReactionActive(
                                      message,
                                      type as ReactionType,
                                      reactionActor,
                                      reactionSplitIndex,
                                      hasSplits,
                                    ) && 'bg-[#0A7CFF] text-white',
                                  )}
                                >
                                  <Image
                                    src={
                                      isReactionActive(
                                        message,
                                        type as ReactionType,
                                        reactionActor,
                                        reactionSplitIndex,
                                        hasSplits,
                                      )
                                        ? icon
                                            .replace('-gray', '-white')
                                            .replace('-dark', '-white')
                                        : icon
                                    }
                                    width={14}
                                    height={14}
                                    alt={`${type} reaction`}
                                    style={
                                      type === 'emphasize'
                                        ? { transform: 'scale(0.82)' }
                                        : type === 'question'
                                          ? { transform: 'scale(0.58)' }
                                          : undefined
                                    }
                                  />
                                </button>
                              ),
                            )}
                          </PopoverContent>
                        </Popover>
                        {/* Render form if it exists and hasn't been submitted */}
                        {message.form && !submittedForm && (
                          <MessageForm
                            messageId={message.id}
                            onSubmit={(data) => {
                              // Send the form submission directly without updating input state
                              onSendMessage(
                                `Hello, I am ${data.name}\n My email is ${data.email}`,
                                conversationId || undefined,
                              );
                              setSubmittedForm(true);
                              localStorage.setItem(
                                `submittedForm`,
                                `submitted-${conversationId}`,
                              );
                            }}
                          />
                        )}
                        {/* Existing reactions display */}
                        {message.reactions &&
                          message.reactions.filter(
                            (r) =>
                              !hasSplits ||
                              r.splitIndex === splitIndex ||
                              (r.splitIndex === undefined && splitIndex === 0),
                          ).length > 0 && (
                            <div
                              className={cn(
                                'absolute -top-9 flex gap-1',
                                isMe
                                  ? 'left-0 flex-row'
                                  : 'right-0 flex-row-reverse',
                              )}
                            >
                              {[...message.reactions]
                                .filter(
                                  (r) =>
                                    !hasSplits ||
                                    r.splitIndex === splitIndex ||
                                    (r.splitIndex === undefined &&
                                      splitIndex === 0),
                                )
                                .sort(
                                  (a, b) =>
                                    new Date(a.timestamp).getTime() -
                                    new Date(b.timestamp).getTime(),
                                )
                                .map((reaction, index, array) => (
                                  <div
                                    key={`${reaction.type}-${reaction.timestamp}`}
                                    className={cn(
                                      'w-8 h-8 flex items-center justify-center relative',
                                      index !== array.length - 1 &&
                                        (isMe ? '-ml-5' : '-mr-5'),
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
                                    {reaction.sender === 'me' &&
                                      !isMobileView && (
                                        <Image
                                          src={getReactionIconSvg(
                                            reaction.sender === 'me',
                                            isMe,
                                            reaction.type,
                                            isMobileView ?? false,
                                            true,
                                          )}
                                          width={30}
                                          height={30}
                                          alt={`${reaction.type} reaction`}
                                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                                        />
                                      )}
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>
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
      {!isReadOnly && submittedForm && (
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
