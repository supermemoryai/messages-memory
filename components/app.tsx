'use client';

import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Nav } from './nav';
import type { Conversation, Message, Reaction, Attachment } from '../types';
import { generateUUID } from '@/lib/utils';
import {
  createInitialConversationsForUser,
  getUserSpecificProfileId,
} from '../data/initial-conversations';
import { createInitialContactsForUser } from '../data/initial-contacts';
import { MessageQueue } from '../lib/message-queue';
import { useToast } from '@/hooks/use-toast';
import { CommandMenu } from './command-menu';
import { soundEffects } from '@/lib/sound-effects';
import { getUserContacts } from '@/lib/contacts';

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
  const [draftConversationId, setDraftConversationId] = useState<string | null>(
    null,
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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loadedConversations, setLoadedConversations] = useState<Set<string>>(new Set());
  const [hasLoadedWorkspaceChats, setHasLoadedWorkspaceChats] = useState(false);

  // Add command menu ref
  const commandMenuRef = useRef<{ setOpen: (open: boolean) => void }>(null);

  const STORAGE_KEY = 'supermemoryConversations';
  const CHAT_ID_KEY = 'supermemoryCurrentChatId';

  const removeDraftConversation = useCallback(
    (conversationId: string | null) => {
      if (!conversationId) return;

      let draftRemoved = false;
      setConversations((prev) => {
        const draft = prev.find(
          (conv) => conv.id === conversationId && conv.isDraft,
        );
        if (!draft) {
          return prev;
        }
        draftRemoved = true;
        const updated = prev.filter((conv) => conv.id !== conversationId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });

      if (draftRemoved) {
        setMessageDrafts((prev) => {
          if (!(conversationId in prev)) {
            return prev;
          }
          const { [conversationId]: _, ...rest } = prev;
          return rest;
        });
        setDraftConversationId((current) =>
          current === conversationId ? null : current,
        );
      }
    },
    [STORAGE_KEY],
  );

  const startNewConversation = useCallback((
    options?: { baseConversation?: Conversation }
  ) => {
    if (draftConversationId) {
      removeDraftConversation(draftConversationId);
    }

    const newConversationId = generateUUID();
    const now = new Date().toISOString();
    const baseConversation = options?.baseConversation;

    const baseRecipients =
      baseConversation?.recipients?.map((recipient) => ({ ...recipient })) || [];
    const conversationName =
      baseConversation?.name ||
      (baseRecipients.length > 0
        ? baseRecipients.map((recipient) => recipient.name).join(', ')
        : 'New Chat');

    const newConversation: Conversation = {
      id: newConversationId,
      name: conversationName,
      recipients: baseRecipients,
      messages: [],
      lastMessageTime: now,
      unreadCount: 0,
      isDraft: baseRecipients.length === 0,
      pinned: baseConversation?.pinned,
      hideAlerts: baseConversation?.hideAlerts,
    };

    setConversations((prev) => {
      const filtered = baseConversation
        ? prev.filter((conv) => conv.id !== baseConversation.id)
        : prev;
      const updated = [newConversation, ...filtered];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    setDraftConversationId(
      baseRecipients.length === 0 ? newConversationId : null,
    );
    setActiveConversation(newConversationId);
    setIsNewConversation(baseRecipients.length === 0);
    setRecipientInput(
      baseRecipients.length > 0
        ? baseRecipients.map((recipient) => recipient.name).join(',')
        : '',
    );
    setMessageDrafts((prev) => {
      const { new: _unusedDraft, ...restWithoutNew } = prev;
      let cleanedDrafts = restWithoutNew;
      if (baseConversation) {
        const { [baseConversation.id]: _removed, ...withoutBase } = cleanedDrafts;
        cleanedDrafts = withoutBase;
      }
      return {
        ...cleanedDrafts,
        [newConversationId]: '',
      };
    });
    if (baseConversation) {
      setLastActiveConversation((prev) =>
        prev === baseConversation.id ? newConversationId : prev,
      );
      localStorage.setItem(CHAT_ID_KEY, newConversationId);
    }
    localStorage.setItem('submittedForm', `submitted-${newConversationId}`);
    window.history.pushState({}, '', `?id=${newConversationId}`);
  }, [
    STORAGE_KEY,
    CHAT_ID_KEY,
    draftConversationId,
    removeDraftConversation,
    setIsNewConversation,
    setRecipientInput,
  ]);

  const buildRecipientsForConversation = useCallback(
    (
      existingConversation: Conversation | undefined,
      recipientNames: string[],
    ) => {
      const trimmed = recipientNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      const initialContacts = createInitialContactsForUser(userId || 'default');
      const userContacts = getUserContacts();
      const contactMap = new Map(
        [...initialContacts, ...userContacts].map((contact) => [
          contact.name.toLowerCase(),
          contact,
        ]),
      );

      return trimmed.map((name) => {
        const existingRecipient = existingConversation?.recipients.find(
          (recipient) => recipient.name.toLowerCase() === name.toLowerCase(),
        );

        if (existingRecipient) {
          return existingRecipient;
        }

        const contact = contactMap.get(name.toLowerCase());
        return {
          id: generateUUID(),
          name,
          avatar: contact?.avatar,
          bio: contact?.bio,
          title: contact?.title,
        };
      });
    },
    [userId],
  );

  const handleCreateConversation = useCallback(
    (recipientNames: string[]) => {
      const trimmedRecipients = recipientNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (trimmedRecipients.length === 0) {
        return;
      }

      let candidateConversationId: string;
      if (
        draftConversationId &&
        conversations.some((conv) => conv.id === draftConversationId)
      ) {
        candidateConversationId = draftConversationId;
      } else if (
        activeConversation &&
        conversations.some((conv) => conv.id === activeConversation)
      ) {
        candidateConversationId = activeConversation;
      } else {
        candidateConversationId = generateUUID();
      }

      setConversations((prev) => {
        const now = new Date().toISOString();
        const index = prev.findIndex(
          (conv) => conv.id === candidateConversationId,
        );

        if (index !== -1) {
          const existing = prev[index];
          const recipients = buildRecipientsForConversation(
            existing,
            trimmedRecipients,
          );
          const updatedConversation: Conversation = {
            ...existing,
            recipients,
            name: trimmedRecipients.join(', '),
            isDraft: false,
            lastMessageTime: existing.lastMessageTime || now,
          };
          const updated = [...prev];
          updated[index] = updatedConversation;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        }

        const recipients = buildRecipientsForConversation(
          undefined,
          trimmedRecipients,
        );
        const newConversation: Conversation = {
          id: candidateConversationId,
          recipients,
          name: trimmedRecipients.join(', '),
          messages: [],
          lastMessageTime: now,
          unreadCount: 0,
          isDraft: false,
        };
        const updated = [newConversation, ...prev];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });

      setMessageDrafts((prev) => {
        if (prev.new === undefined) {
          return prev;
        }
        const { new: draftValue, ...rest } = prev;
        return {
          ...rest,
          [candidateConversationId]: draftValue,
        };
      });

      setActiveConversation(candidateConversationId);
      setDraftConversationId(null);
      setIsNewConversation(false);
      setRecipientInput(trimmedRecipients.join(','));
      window.history.pushState({}, '', `?id=${candidateConversationId}`);
    },
    [
      STORAGE_KEY,
      activeConversation,
      buildRecipientsForConversation,
      conversations,
      draftConversationId,
    ],
  );

  const handleUpdateRecipients = useCallback(
    (recipientNames: string[]) => {
      if (!activeConversation) return;

      const trimmedRecipients = recipientNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (trimmedRecipients.length === 0) {
        return;
      }

      setConversations((prev) => {
        const index = prev.findIndex((conv) => conv.id === activeConversation);
        if (index === -1) {
          return prev;
        }
        const existing = prev[index];
        const recipients = buildRecipientsForConversation(
          existing,
          trimmedRecipients,
        );
        const updatedConversation: Conversation = {
          ...existing,
          recipients,
          name: trimmedRecipients.join(', '),
        };
        const updated = [...prev];
        updated[index] = updatedConversation;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [STORAGE_KEY, activeConversation, buildRecipientsForConversation],
  );

  // Memoized conversation selection method
  const selectConversation = useCallback(
    (conversationId: string | null) => {
      if (conversationId === null) {
        if (draftConversationId) {
          removeDraftConversation(draftConversationId);
        }
        setActiveConversation(null);
        setIsNewConversation(false);
        window.history.pushState({}, '', '/');
        return;
      }

      if (draftConversationId && conversationId !== draftConversationId) {
        removeDraftConversation(draftConversationId);
      }

      const selectedConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );

      if (!selectedConversation) {
        console.warn(`Conversation with ID ${conversationId} not found`);

        window.history.pushState({}, '', '/');

        if (conversations.length > 0) {
          const fallbackConversation = conversations[0];
          setActiveConversation(fallbackConversation.id);
          setIsNewConversation(fallbackConversation.isDraft ?? false);
          window.history.pushState({}, '', `?id=${fallbackConversation.id}`);
        } else {
          setActiveConversation(null);
          setIsNewConversation(false);
        }
        return;
      }

      setActiveConversation(conversationId);
      setIsNewConversation(selectedConversation.isDraft ?? false);
      window.history.pushState({}, '', `?id=${conversationId}`);
    },
    [conversations, draftConversationId, removeDraftConversation],
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

  // Fetch workspaces on mount, auto-create if none exist
  useEffect(() => {
    let cancelled = false;
    async function loadWorkspaces() {
      try {
        const res = await fetch('/api/workspaces');
        if (!res.ok) {
          console.error('[App] Failed to fetch workspaces:', res.status, res.statusText);
          const errorText = await res.text().catch(() => '');
          console.error('[App] Error response:', errorText);
          return;
        }
        const data = await res.json();
        console.log('[App] Workspaces loaded:', data);

        // If no workspaces exist, create a default one for regular users
        if (data.workspaces.length === 0) {
          console.log('[App] No workspaces found, creating default workspace');
          const createRes = await fetch('/api/workspaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'My Workspace' }),
          });

          if (createRes.ok) {
            const { workspace } = await createRes.json();
            if (!cancelled) {
              setWorkspaceId(workspace.id);
              console.log('[App] Created and selected default workspace:', workspace.id);
            }
            return;
          } else {
            console.error('[App] Failed to create default workspace:', createRes.status);
            return;
          }
        }

        const first = data?.workspaces?.[0]?.id ?? null;
        if (!cancelled) {
          setWorkspaceId(first);
          console.log('[App] Selected workspace:', first);
        }
      } catch (error) {
        console.error('[App] Failed to load workspaces:', error);
      }
    }
    loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize user ID early
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const response = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // No chatId means user-scoped fallback
        });
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

  // Profile chat is now a channel memory graph view; no periodic profile polling needed.

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

      // Start with initial conversations using user-specific IDs
      const initialConversations = createInitialConversationsForUser(userId);
      let allConversations = [...initialConversations];

      if (saved) {
        try {
          // Load saved conversations
          const parsedConversations = JSON.parse(saved);

          if (!Array.isArray(parsedConversations)) {
            console.error('Invalid conversations format in localStorage');
            return;
          }

          // Migration: drop legacy pinned "Supermemory" conversation if present
          const migratedConversations = parsedConversations.filter(
            (conv: any) => conv?.recipients?.[0]?.name !== 'Supermemory',
          );

          // Create a map of initial conversation IDs for faster lookup
          const initialIds = new Set([...initialConversations.map((conv) => conv.id)]);

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
        // Check if the URL conversation exists
        const conversationExists = allConversations.some(
          (c) => c.id === urlConversationId,
        );
        if (conversationExists) {
          // If it exists, select it
          setActiveConversation(urlConversationId);
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
      } else {
        // No conversations at all - automatically start a new chat
        startNewConversation();
      }
    };

    // Call the async initialization function
    initializeConversations();
  }, [userId, isMobileView, startNewConversation]); // Add userId as dependency

  // Load workspace channels from DB history once we have a workspaceId
  useEffect(() => {
    if (!workspaceId || !userId) return;

    let cancelled = false;

    async function loadWorkspaceChats() {
      try {
        const res = await fetch(
          `/api/history?workspaceId=${workspaceId}&limit=100`,
        );
        if (!res.ok) {
          console.error('[App] Failed to fetch workspace chats:', res.status);
          return;
        }
        const data = await res.json();
        const chats = data?.chats ?? [];

        setConversations((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));

          for (const chat of chats) {
            const existing = byId.get(chat.id);

            // Convert last message from DB format if it exists
            const lastMessagePreview = chat.lastMessage
              ? {
                  id: chat.lastMessage.id,
                  sender: chat.lastMessage.role === 'user' ? 'user' : 'ai',
                  content:
                    typeof chat.lastMessage.parts === 'string'
                      ? chat.lastMessage.parts
                      : Array.isArray(chat.lastMessage.parts)
                        ? chat.lastMessage.parts
                            .filter((p: any) => p.type === 'text')
                            .map((p: any) => p.text)
                            .join('')
                        : '',
                  timestamp: new Date(chat.lastMessage.createdAt).toISOString(),
                  reactions: [],
                  attachments: [],
                }
              : null;

            byId.set(chat.id, {
              id: chat.id,
              name: chat.title || 'Untitled Chat',
              recipients: [
                {
                  id: 'ai',
                  name: 'Supermemory',
                  bio: 'Workspace AI assistant',
                  title: 'AI',
                },
              ],
              messages: lastMessagePreview
                ? [lastMessagePreview, ...(existing?.messages ?? [])]
                : existing?.messages ?? [],
              lastMessageTime: chat.lastMessage
                ? new Date(chat.lastMessage.createdAt).toISOString()
                : new Date(chat.createdAt).toISOString(),
              unreadCount: 0,
              pinned: chat.title === 'setup' ? true : existing?.pinned,
            });
          }

          // Ensure profile conversation exists
          const profileId = getUserSpecificProfileId(userId);
          if (!byId.has(profileId)) {
            const [profileConv] = createInitialConversationsForUser(userId);
            byId.set(profileId, profileConv);
          }

          return Array.from(byId.values());
        });

        if (!cancelled) setHasLoadedWorkspaceChats(true);
      } catch (e) {
        console.error('[App] Error loading workspace chats:', e);
      }
    }

    loadWorkspaceChats();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId]);

  // Hydrate messages from DB for the active channel when needed
  useEffect(() => {
    if (!activeConversation) return;
    if (!hasLoadedWorkspaceChats) return;

    // Skip if we've already loaded messages for this conversation
    if (loadedConversations.has(activeConversation)) return;

    // Check if this is the Profile conversation
    const conv = conversations.find((c) => c.id === activeConversation);
    if (conv) {
      const isProfile = conv.recipients.some((r) => r.name === 'Profile');
      if (isProfile) return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/messages?chatId=${activeConversation}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation ? { ...c, messages: data.messages ?? [] } : c,
          ),
        );

        // Mark this conversation as loaded
        setLoadedConversations((prev) => new Set(prev).add(activeConversation));
      } catch (e) {
        console.error('[App] Failed to hydrate messages:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, hasLoadedWorkspaceChats]);

  // Prefer selecting the seeded `setup` channel once workspace chats are loaded
  useEffect(() => {
    if (!userId) return;
    if (!hasLoadedWorkspaceChats) return;

    const profileId = getUserSpecificProfileId(userId);
    const setup = conversations.find((c) => c.name === 'setup');

    if (!setup) return;

    // Only auto-select on initial load; don't override a deliberate Profile selection.
    if (!activeConversation) {
      setActiveConversation(setup.id);
      window.history.pushState({}, '', `?id=${setup.id}`);
    }
  }, [userId, hasLoadedWorkspaceChats, conversations, activeConversation]);

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

          // No auto profile-refresh behavior in channel-scoped memory mode.

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

    // Use the provided conversationId, or fall back to the currently active conversation
    const targetConversationId = conversationId || activeConversation || '';
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
      isDraft: false,
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
    setDraftConversationId((current) =>
      current === targetConversationId ? null : current,
    );
    window.history.pushState({}, '', `?id=${targetConversationId}`);

    // Only enqueue if we have a workspaceId
    if (workspaceId) {
      messageQueue.current.enqueueUserMessage(updatedConversation, workspaceId);
    } else {
      console.error('[App] Cannot send message: no workspace selected');
    }
    clearMessageDraft(targetConversationId);
  };

  // Method to handle conversation deletion
  const handleDeleteConversation = (id: string) => {
    // Don't allow deleting the Profile conversation
    if (id === getUserSpecificProfileId(userId || '')) {
      toast({
        description: 'Cannot delete the Profile conversation',
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
                (r) =>
                  r.sender === reaction.sender &&
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
                    (r) =>
                      !(
                        r.sender === reaction.sender &&
                        r.splitIndex === splitIndex
                      ),
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

    // Clear messages while keeping the same conversation ID
    // This avoids race conditions and maintains conversation continuity
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === activeConversation
          ? {
              ...conv,
              messages: [],
              lastMessageTime: new Date().toISOString(),
            }
          : conv,
      ),
    );

    // No need to update activeConversation or URL since the ID stays the same
    // This ensures the ChatArea component always has a valid activeConversation
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

  const resolvedConversationId = activeConversation || draftConversationId;

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
          startNewConversation();
          commandMenuRef.current?.setOpen(false);
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
                onNewChat={startNewConversation}
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
              onStartNewConversation={startNewConversation}
              onCreateConversation={handleCreateConversation}
              onUpdateRecipients={handleUpdateRecipients}
              onSendMessage={handleSendMessage}
              onReaction={handleReaction}
              typingStatus={typingStatus}
              conversationId={resolvedConversationId || ''}
              onUpdateConversationName={handleUpdateConversationName}
              onHideAlertsChange={handleHideAlertsChange}
              onClearChat={handleClearChat}
              messageDraft={
                resolvedConversationId
                  ? messageDrafts[resolvedConversationId] || ''
                  : ''
              }
              onMessageDraftChange={handleMessageDraftChange}
              unreadCount={totalUnreadCount}
              isReadOnly={
                userId
                  ? activeConversation === getUserSpecificProfileId(userId)
                  : false
              }
              userId={userId || undefined}
              workspaceId={workspaceId}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
