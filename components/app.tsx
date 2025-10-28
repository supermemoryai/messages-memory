'use client';

import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Nav } from './nav';
import type { Conversation, Message, Reaction, Attachment } from '../types';
import { generateUUID } from '@/lib/utils';
import {
  createInitialConversationsForUser,
  getUserSpecificSupermemoryId,
  getUserSpecificProfileId,
} from '../data/initial-conversations';
import { MessageQueue } from '../lib/message-queue';
import { useToast } from '@/hooks/use-toast';
import { CommandMenu } from './command-menu';
import { soundEffects } from '@/lib/sound-effects';

export default function App() {
  // State
  const { toast } = useToast();
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [lastActiveConversation, setLastActiveConversation] = useState<
    string | null
  >(null);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>(
    {},
  );
  const [recipientInput, setRecipientInput] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [isLayoutInitialized, setIsLayoutInitialized] = useState(false);
  const [typingStatus, setTypingStatus] = useState<{
    conversationId: string;
    recipient: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundEffects.isEnabled());
  const [pendingProfileRefresh, setPendingProfileRefresh] = useState(false);

  // Add command menu ref
  const commandMenuRef = useRef<{ setOpen: (open: boolean) => void }>(null);

  const STORAGE_KEY = 'supermemoryConversations';
  const CHAT_ID_KEY = 'supermemoryCurrentChatId';

  // Memoized conversation selection method
  const selectConversation = useCallback(
    (conversationId: string | null) => {
      // If clearing the selection
      if (conversationId === null) {
        setActiveConversation(null);
        window.history.pushState({}, '', '/');
        return;
      }

      // Find the conversation in the list
      const selectedConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );

      // If conversation is not found, handle gracefully
      if (!selectedConversation) {
        console.warn(`Conversation with ID ${conversationId} not found`);

        // Clear URL and select first available conversation
        window.history.pushState({}, '', '/');

        if (conversations.length > 0) {
          const fallbackConversation = conversations[0];
          setActiveConversation(fallbackConversation.id);
          window.history.pushState({}, '', `?id=${fallbackConversation.id}`);
        } else {
          setActiveConversation(null);
        }
        return;
      }

      // Successfully select the conversation
      setActiveConversation(conversationId);
      setIsNewConversation(false);
      window.history.pushState({}, '', `?id=${conversationId}`);
    },
    [conversations, setActiveConversation, setIsNewConversation],
  );

  // Effects
  // Ensure active conversation remains valid
  useEffect(() => {
    if (
      activeConversation &&
      !conversations.some((c) => c.id === activeConversation)
    ) {
      console.error(
        'Active conversation no longer exists:',
        activeConversation,
      );

      // If current active conversation no longer exists
      if (conversations.length > 0) {
        // Select the first conversation
        const newActiveConversation = conversations[0].id;
        if (newActiveConversation) {
          selectConversation(newActiveConversation);
        }
      } else {
        // No conversations left
        setActiveConversation(null);
      }
    }
  }, [conversations, activeConversation, selectConversation]);

  // Save user's conversations to local storage
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations]);

  // Initialize user ID early
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const { profile } = await response.json();
          setUserId(profile.userId);
        }
      } catch (error) {
        console.error('Error fetching user profile for initialization:', error);
      }
    };

    fetchUserId();
  }, []); // Run only once on mount

  // Fetch and update user profile for the profile chat
  const updateProfileChat = useCallback(async () => {
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        const { profile } = await response.json();

        // Set the user ID for use throughout the app
        setUserId(profile.userId);

        // Show container tag and static/dynamic profile data with proper labels
        let profileContent = `**Container Tag:**\n${profile.userId}\n\n`;

        // Show static profile data
        if (profile.static && profile.static.length > 0) {
          profileContent += `**Static:**\n`;
          profile.static.forEach((item: any) => {
            profileContent += `• ${item}\n\n`;
          });
        }

        // Show dynamic profile data
        if (profile.dynamic && profile.dynamic.length > 0) {
          profileContent += `**Dynamic:**\n`;
          profile.dynamic.forEach((item: any) => {
            profileContent += `• ${item}\n\n`;
          });
        }

        if (!profile.static?.length && !profile.dynamic?.length) {
          profileContent += `**Static:**\n(empty)\n\n**Dynamic:**\n(empty)`;
        }

        // Update the profile chat with the new profile content
        const userProfileChatId = getUserSpecificProfileId(profile.userId);
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === userProfileChatId) {
              return {
                ...conv,
                messages: [
                  {
                    id: `${getUserSpecificProfileId(profile.userId)}-question`,
                    content: 'who am i',
                    sender: 'me',
                    timestamp: new Date(Date.now() - 60000).toISOString(),
                  },
                  {
                    id: `${getUserSpecificProfileId(profile.userId)}-response`,
                    content: profileContent,
                    sender: 'Profile',
                    timestamp: new Date().toISOString(),
                  },
                ],
                lastMessageTime: new Date().toISOString(),
              };
            }
            return conv;
          }),
        );
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  // Fetch profile every time profile chat becomes active
  // Track if we just switched to the profile chat
  const [lastProfileChatView, setLastProfileChatView] = useState<number>(0);

  useEffect(() => {
    if (userId && activeConversation === getUserSpecificProfileId(userId)) {
      // Always fetch when switching to profile chat
      updateProfileChat();
      setLastProfileChatView(Date.now());

      // Auto-refresh every 30 seconds while viewing profile
      const interval = setInterval(updateProfileChat, 30000);
      return () => clearInterval(interval);
    }
  }, [activeConversation, updateProfileChat, userId]);

  // Function to trigger automatic profile refresh after Supermemory responses
  const triggerProfileRefresh = useCallback(() => {
    if (!userId) return;

    setPendingProfileRefresh(true);

    // Show notification that profile will be updated
    toast({
      description: 'Updating your profile with new information...',
    });

    // Wait 10 seconds then refresh profile
    setTimeout(() => {
      updateProfileChat()
        .then(() => {
          setPendingProfileRefresh(false);
          toast({
            description: 'Profile updated with latest information!',
          });
        })
        .catch((error) => {
          console.error('Error updating profile:', error);
          setPendingProfileRefresh(false);
          toast({
            description: 'Profile update completed.',
          });
        });
    }, 10000); // 10 second delay
  }, [userId, updateProfileChat, toast]);

  // Set mobile view
  useEffect(() => {
    const handleResize = () => {
      const newIsMobileView = window.innerWidth < 768;
      if (isMobileView !== newIsMobileView) {
        setIsMobileView(newIsMobileView);

        // When transitioning from mobile to desktop, restore the last active conversation
        if (!newIsMobileView && !activeConversation && lastActiveConversation) {
          // Verify that the lastActiveConversation still exists before selecting it
          const conversationExists = conversations.some(
            (c) => c.id === lastActiveConversation,
          );
          if (conversationExists) {
            selectConversation(lastActiveConversation);
          } else {
            // If the conversation no longer exists, clear it and select the first available one
            setLastActiveConversation(null);
            if (conversations.length > 0) {
              selectConversation(conversations[0].id);
            }
          }
        }
      }
    };

    handleResize();
    setIsLayoutInitialized(true);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [
    isMobileView,
    activeConversation,
    lastActiveConversation,
    selectConversation,
    conversations,
  ]);

  // Get conversations from local storage (only after userId is available)
  useEffect(() => {
    if (!userId) return; // Wait for userId to be set

    const initializeConversations = async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      const urlParams = new URLSearchParams(window.location.search);
      const urlConversationId = urlParams.get('id');

      // Get or generate the chat ID for this user
      let chatId: string = localStorage.getItem(CHAT_ID_KEY) || '';

      // Try to fetch existing chats from API if we don't have a stored ID
      if (!chatId) {
        try {
          const response = await fetch('/api/history');
          if (response.ok) {
            const chats = await response.json();
            if (chats && chats.length > 0 && chats[0]?.id) {
              // Use the most recent chat
              chatId = chats[0].id as string;
            }
          }
        } catch (error) {
          console.error('Error fetching chat history:', error);
        }
      }

      // If still no chat ID, generate a new one
      if (!chatId) {
        chatId = generateUUID();
      }

      // Store the final chat ID
      localStorage.setItem(CHAT_ID_KEY, chatId);

      // Start with initial conversations using user-specific IDs
      const initialConversations = createInitialConversationsForUser(userId);
      const userSupermemoryId = getUserSpecificSupermemoryId(userId);

      let allConversations = initialConversations.map((conv) =>
        conv.id === userSupermemoryId ? { ...conv, id: chatId } : conv,
      );

      if (saved) {
        try {
          // Load saved conversations
          const parsedConversations = JSON.parse(saved);

          if (!Array.isArray(parsedConversations)) {
            console.error('Invalid conversations format in localStorage');
            return;
          }

          // Migration: Update old IDs to the current user's chat ID
          const migratedConversations = parsedConversations.map((conv) => {
            if (
              conv.id === 'supermemory-chat' ||
              conv.id === userSupermemoryId
            ) {
              return { ...conv, id: chatId };
            }
            return conv;
          });

          // Create a map of initial conversation IDs for faster lookup
          const initialIds = new Set([
            chatId,
            ...initialConversations.map((conv) => conv.id),
          ]);

          // Separate user-created and modified initial conversations
          const userConversations = [];
          const modifiedInitialConversations = new Map();

          for (const savedConv of migratedConversations) {
            if (initialIds.has(savedConv.id)) {
              modifiedInitialConversations.set(savedConv.id, savedConv);
            } else {
              userConversations.push(savedConv);
            }
          }

          // Update initial conversations with saved changes
          allConversations = allConversations.map((conv) =>
            modifiedInitialConversations.has(conv.id)
              ? modifiedInitialConversations.get(conv.id)
              : conv,
          );

          // Add user-created conversations
          allConversations = [...allConversations, ...userConversations];
        } catch (error) {
          console.error('Error parsing saved conversations:', error);
        }
      }

      // Set conversations first
      setConversations(allConversations);

      // Handle conversation selection after setting conversations
      if (urlConversationId) {
        // Migration: Update URL if it has the old ID
        const migratedUrlId =
          urlConversationId === 'supermemory-chat' ||
          urlConversationId === getUserSpecificSupermemoryId(userId)
            ? chatId
            : urlConversationId;

        // Check if the URL conversation exists
        const conversationExists = allConversations.some(
          (c) => c.id === migratedUrlId,
        );
        if (conversationExists) {
          // If it exists, select it
          setActiveConversation(migratedUrlId);
          // Update URL if it was migrated
          if (migratedUrlId !== urlConversationId) {
            window.history.pushState({}, '', `?id=${migratedUrlId}`);
          }
          return;
        }
      }

      // If mobile view, show the sidebar
      if (isMobileView) {
        window.history.pushState({}, '', '/');
        setActiveConversation(null);
        return;
      }

      // No URL ID or invalid ID, and not mobile - select first conversation
      if (allConversations.length > 0) {
        setActiveConversation(allConversations[0].id);
      }
    };

    // Call the async initialization function
    initializeConversations();
  }, [userId, isMobileView]); // Add userId as dependency

  // Update lastActiveConversation whenever activeConversation changes
  useEffect(() => {
    if (activeConversation) {
      setLastActiveConversation(activeConversation);
      resetUnreadCount(activeConversation);
    }
  }, [activeConversation]);

  // Keep MessageQueue's internal state in sync with React's activeConversation state
  useEffect(() => {
    messageQueue.current.setActiveConversation(activeConversation);
  }, [activeConversation]);

  // Initialize message queue with proper state management
  const messageQueue = useRef<MessageQueue>(
    new MessageQueue({
      onMessageGenerated: (conversationId: string, message: Message) => {
        setConversations((prev) => {
          // Get the current active conversation from MessageQueue's internal state
          const currentActiveConversation =
            messageQueue.current.getActiveConversation();

          const conversation = prev.find((c) => c.id === conversationId);
          if (!conversation) {
            console.error('Conversation not found:', conversationId);
            return prev;
          }

          // Use MessageQueue's tracked active conversation state to determine unread status
          const shouldIncrementUnread =
            conversationId !== currentActiveConversation &&
            message.sender !== 'me' &&
            !conversation.hideAlerts;

          // Play received sound if message is in inactive conversation, not from us, and alerts aren't hidden
          if (shouldIncrementUnread && !conversation.hideAlerts) {
            soundEffects.playUnreadSound();
          }

          // Trigger profile refresh for Supermemory responses (not from user, not in profile chat)
          const isSupermemoryChat =
            userId && conversationId === getUserSpecificSupermemoryId(userId);
          const isProfileChat =
            userId && conversationId === getUserSpecificProfileId(userId);

          console.log('[Profile Refresh Debug]', {
            conversationId,
            userId,
            supermemoryId: userId ? getUserSpecificSupermemoryId(userId) : null,
            profileId: userId ? getUserSpecificProfileId(userId) : null,
            isSupermemoryChat,
            isProfileChat,
            messageSender: message.sender,
            pendingProfileRefresh,
            shouldTrigger:
              isSupermemoryChat &&
              message.sender !== 'me' &&
              !isProfileChat &&
              !pendingProfileRefresh,
          });

          if (
            isSupermemoryChat &&
            message.sender !== 'me' &&
            !isProfileChat &&
            !pendingProfileRefresh
          ) {
            console.log('[Profile Refresh] Triggering profile refresh...');
            triggerProfileRefresh();
          }

          return prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, message],
                  lastMessageTime: new Date().toISOString(),
                  unreadCount: shouldIncrementUnread
                    ? (conv.unreadCount || 0) + 1
                    : conv.unreadCount,
                }
              : conv,
          );
        });
      },
      onMessageUpdated: (
        conversationId: string,
        messageId: string,
        updates: Partial<Message>,
      ) => {
        setConversations((prev) => {
          const currentActiveConversation =
            messageQueue.current.getActiveConversation();

          return prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  unreadCount:
                    conversationId === currentActiveConversation ||
                    conv.hideAlerts
                      ? conv.unreadCount
                      : (conv.unreadCount || 0) + 1,
                  messages: conv.messages.map((msg) => {
                    if (msg.id === messageId) {
                      // If we're updating reactions and the message already has reactions,
                      // merge them together instead of overwriting
                      const currentReactions = msg.reactions || [];
                      const newReactions = updates.reactions || [];

                      // Filter out any duplicate reactions (same type and sender)
                      const uniqueNewReactions = newReactions.filter(
                        (newReaction) =>
                          !currentReactions.some(
                            (currentReaction) =>
                              currentReaction.type === newReaction.type &&
                              currentReaction.sender === newReaction.sender,
                          ),
                      );
                      return {
                        ...msg,
                        ...updates,
                        reactions: [...currentReactions, ...uniqueNewReactions],
                      };
                    }
                    return msg;
                  }),
                }
              : conv,
          );
        });
      },
      onTypingStatusChange: (
        conversationId: string | null,
        recipient: string | null,
      ) => {
        if (!conversationId || !recipient) {
          setTypingStatus(null);
        } else {
          setTypingStatus({ conversationId, recipient });
        }
      },
      onError: (error: Error) => {
        console.error('Error generating message:', error);
        setTypingStatus(null);
      },
    }),
  );

  // Update sound enabled state when it changes in soundEffects
  useEffect(() => {
    setSoundEnabled(soundEffects.isEnabled());
  }, []);

  // Method to reset unread count when conversation is selected
  const resetUnreadCount = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );
  };

  // Method to handle message draft changes
  const handleMessageDraftChange = (
    conversationId: string,
    message: string,
  ) => {
    setMessageDrafts((prev) => ({
      ...prev,
      [conversationId]: message,
    }));
  };

  // Method to clear message draft after sending
  const clearMessageDraft = (conversationId: string) => {
    setMessageDrafts((prev) => {
      const newDrafts = { ...prev };
      delete newDrafts[conversationId];
      return newDrafts;
    });
  };

  // Method to extract plain text from HTML content while preserving mentions
  const extractMessageContent = (htmlContent: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = htmlContent;
    return temp.textContent || '';
  };

  // Method to handle message sending
  const handleSendMessage = async (
    messageHtml: string,
    conversationId?: string,
    attachments?: Attachment[],
  ) => {
    const messageText = extractMessageContent(messageHtml);
    if (!messageText.trim() && (!attachments || attachments.length === 0))
      return;

    // Use the provided conversationId, or default to the main Supermemory chat
    const targetConversationId =
      conversationId || getUserSpecificSupermemoryId(userId || '');
    const conversation = conversations.find(
      (c) => c.id === targetConversationId,
    );

    if (!conversation) {
      console.error(
        `Conversation with ID ${targetConversationId} not found. Skipping message.`,
      );
      return;
    }

    // Create message object
    const message: Message = {
      id: generateUUID(),
      content: messageText,
      htmlContent: messageHtml,
      sender: 'me',
      timestamp: new Date().toISOString(),
      ...(attachments && attachments.length > 0 && { attachments }),
    };

    // Update conversation with user message
    const updatedConversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
    };

    setConversations((prev) => {
      const updatedConversations = prev.map((c) =>
        c.id === targetConversationId ? updatedConversation : c,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConversations));
      return updatedConversations;
    });

    setActiveConversation(targetConversationId);
    setIsNewConversation(false);
    window.history.pushState({}, '', `?id=${targetConversationId}`);
    messageQueue.current.enqueueUserMessage(updatedConversation);
    clearMessageDraft(targetConversationId);
  };

  // Method to handle conversation deletion
  const handleDeleteConversation = (id: string) => {
    // Don't allow deleting the Supermemory conversation
    if (id === getUserSpecificSupermemoryId(userId || '')) {
      toast({
        description: 'Cannot delete the Supermemory conversation',
      });
      return;
    }

    // Clear lastActiveConversation if we're deleting it
    if (id === lastActiveConversation) {
      setLastActiveConversation(null);
    }

    setConversations((prevConversations) => {
      const newConversations = prevConversations.filter(
        (conv) => conv.id !== id,
      );

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConversations));

      // If we're deleting the active conversation and there are conversations left
      if (id === activeConversation && newConversations.length > 0) {
        selectConversation(newConversations[0].id);
      } else if (newConversations.length === 0) {
        // If no conversations left, clear the selection
        selectConversation(null);
      }

      return newConversations;
    });

    // Show toast notification
    toast({
      description: 'Conversation deleted',
    });
  };

  // Method to handle conversation pin/unpin
  const handleUpdateConversation = (
    conversations: Conversation[],
    updateType?: 'pin' | 'mute',
  ) => {
    const updatedConversation = conversations.find(
      (conv) => conv.id === activeConversation,
    );
    setConversations(conversations);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));

    // Show toast notification
    if (updatedConversation) {
      let toastMessage = '';
      if (updateType === 'pin') {
        toastMessage = updatedConversation.pinned
          ? 'Conversation pinned'
          : 'Conversation unpinned';
      } else if (updateType === 'mute') {
        toastMessage = updatedConversation.hideAlerts
          ? 'Conversation muted'
          : 'Conversation unmuted';
      }
      if (toastMessage) {
        toast({
          description: toastMessage,
        });
      }
    }
  };

  // Method to handle reaction
  const handleReaction = useCallback(
    (messageId: string, reaction: Reaction, splitIndex?: number) => {
      setConversations((prevConversations) => {
        return prevConversations.map((conversation) => {
          const messages = conversation.messages.map((message) => {
            if (message.id === messageId) {
              // Check if this exact reaction already exists (including splitIndex)
              const existingReaction = message.reactions?.find(
                (r) => r.sender === reaction.sender &&
                       r.type === reaction.type &&
                       r.splitIndex === splitIndex,
              );

              if (existingReaction) {
                // If the same reaction exists, remove it
                return {
                  ...message,
                  reactions:
                    message.reactions?.filter(
                      (r) =>
                        !(
                          r.sender === reaction.sender &&
                          r.type === reaction.type &&
                          r.splitIndex === splitIndex
                        ),
                    ) || [],
                };
              } else {
                // Remove any other reaction from this sender for this split and add the new one
                const otherReactions =
                  message.reactions?.filter(
                    (r) => !(r.sender === reaction.sender && r.splitIndex === splitIndex),
                  ) || [];
                return {
                  ...message,
                  reactions: [...otherReactions, reaction],
                };
              }
            }
            return message;
          });

          return {
            ...conversation,
            messages,
          };
        });
      });
    },
    [],
  );

  // Method to update conversation name
  const handleUpdateConversationName = useCallback(
    (name: string) => {
      setConversations((prevConversations) => {
        return prevConversations.map((conv) =>
          conv.id === activeConversation ? { ...conv, name } : conv,
        );
      });
    },
    [activeConversation],
  );

  // Method to handle hide alerts toggle
  const handleHideAlertsChange = useCallback(
    (hide: boolean) => {
      setConversations((prevConversations) =>
        prevConversations.map((conv) =>
          conv.id === activeConversation ? { ...conv, hideAlerts: hide } : conv,
        ),
      );
    },
    [activeConversation],
  );

  // Method to handle clearing chat
  const handleClearChat = useCallback(() => {
    if (!activeConversation) return;

    // Generate a new chat ID for the fresh start
    const newChatId = generateUUID();

    // Update localStorage with the new chat ID
    localStorage.setItem(CHAT_ID_KEY, newChatId);

    // Update the conversation with new ID and cleared messages
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === activeConversation
          ? {
              ...conv,
              id: newChatId,
              messages: [],
              lastMessageTime: new Date().toISOString(),
            }
          : conv,
      ),
    );

    // Update active conversation to the new ID
    setActiveConversation(newChatId);

    // Update the URL to reflect the new chat ID
    window.history.pushState({}, '', `?id=${newChatId}`);
  }, [activeConversation]);

  // Handle sound toggle
  const handleSoundToggle = useCallback(() => {
    soundEffects.toggleSound();
    setSoundEnabled(soundEffects.isEnabled());
  }, []);

  // Calculate total unread count
  const totalUnreadCount = conversations.reduce((total, conv) => {
    return total + (conv.unreadCount || 0);
  }, 0);

  // Don't render until layout is initialized
  if (!isLayoutInitialized) {
    return null;
  }

  return (
    <div className="flex h-dvh bg-background">
      <CommandMenu
        ref={commandMenuRef}
        conversations={conversations}
        activeConversation={activeConversation}
        onNewChat={() => {
          setIsNewConversation(true);
          setActiveConversation(null);
          window.history.pushState({}, '', '/');
        }}
        onSelectConversation={selectConversation}
        onDeleteConversation={handleDeleteConversation}
        onUpdateConversation={handleUpdateConversation}
        onOpenChange={setIsCommandMenuOpen}
        soundEnabled={soundEnabled}
        onSoundToggle={handleSoundToggle}
      />
      <main className="h-dvh w-full bg-background flex flex-col">
        <div className="flex-1 flex h-full">
          <div
            className={`h-full w-full sm:w-[320px] flex-shrink-0 ${
              isMobileView && (activeConversation || isNewConversation)
                ? 'hidden'
                : 'block sm:border-r dark:border-foreground/20'
            }`}
          >
            <Sidebar
              conversations={conversations}
              activeConversation={activeConversation}
              onSelectConversation={(id) => {
                selectConversation(id);
              }}
              onDeleteConversation={handleDeleteConversation}
              onUpdateConversation={handleUpdateConversation}
              isMobileView={isMobileView}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              typingStatus={typingStatus}
              isCommandMenuOpen={isCommandMenuOpen}
              onScroll={setIsScrolled}
              onSoundToggle={handleSoundToggle}
            >
              <Nav
                onNewChat={() => {
                  setIsNewConversation(true);
                  selectConversation(null);
                  setRecipientInput('');
                  handleMessageDraftChange('new', '');
                }}
                isMobileView={isMobileView}
                isScrolled={isScrolled}
              />
            </Sidebar>
          </div>
          <div
            className={`flex-1 h-full ${
              isMobileView && !activeConversation && !isNewConversation
                ? 'hidden'
                : 'block'
            }`}
          >
            <ChatArea
              isNewChat={isNewConversation}
              activeConversation={
                activeConversation
                  ? conversations.find((c) => c.id === activeConversation)
                  : undefined
              }
              recipientInput={recipientInput}
              setRecipientInput={setRecipientInput}
              isMobileView={isMobileView}
              onBack={() => {
                setIsNewConversation(false);
                selectConversation(null);
              }}
              onSendMessage={handleSendMessage}
              onReaction={handleReaction}
              typingStatus={typingStatus}
              conversationId={activeConversation || ''}
              onUpdateConversationName={handleUpdateConversationName}
              onHideAlertsChange={handleHideAlertsChange}
              onClearChat={handleClearChat}
              messageDraft={
                isNewConversation
                  ? messageDrafts.new || ''
                  : messageDrafts[activeConversation || ''] || ''
              }
              onMessageDraftChange={handleMessageDraftChange}
              unreadCount={totalUnreadCount}
              isReadOnly={
                userId
                  ? activeConversation === getUserSpecificProfileId(userId)
                  : false
              }
              userId={userId || undefined}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
