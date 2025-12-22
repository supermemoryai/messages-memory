'use client';

import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Nav } from './nav';
import type { Conversation, Message, Reaction, Attachment } from '../types';
import { generateUUID } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createInitialConversationsForWorkspace,
  getWorkspaceSpecificProfileId,
} from '../data/initial-conversations';
import { createInitialContactsForUser } from '../data/initial-contacts';
import { MessageQueue } from '../lib/message-queue';
import { toast } from '@/components/toast';
import { CommandMenu } from './command-menu';
import { soundEffects } from '@/lib/sound-effects';
import { getUserContacts } from '@/lib/contacts';

export default function App() {
  // State
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
  const [loadedConversations, setLoadedConversations] = useState<Set<string>>(
    new Set(),
  );
  const [hasLoadedWorkspaceChats, setHasLoadedWorkspaceChats] = useState(false);
  const [workspaceAccessError, setWorkspaceAccessError] = useState<
    string | null
  >(null);
  const [showRenameChatDialog, setShowRenameChatDialog] = useState(false);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameChatName, setRenameChatName] = useState('');
  const [renamingChat, setRenamingChat] = useState(false);
  const [showCreateChatDialog, setShowCreateChatDialog] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [chatNameError, setChatNameError] = useState('');

  // Add command menu ref
  const commandMenuRef = useRef<{ setOpen: (open: boolean) => void }>(null);
  const hasSelectedFromUrl = useRef(false);
  const isSwitchingWorkspace = useRef(false);
  const workspaceIdRef = useRef<string | null>(null);
  const currentActiveChatIdRef = useRef<string | null>(null);

  // const STORAGE_KEY = 'supermemoryConversations';
  // const CHAT_ID_KEY = 'supermemoryCurrentChatId';
  const WORKSPACE_ID_KEY = 'sunsetLastWorkspace';
  const getConversationsStorageKey = () => {
    const id = workspaceIdRef.current;
    return id ? `sunsetConversations-${id}` : null;
  };

  const getChatIdStorageKey = () => {
    const id = workspaceIdRef.current;
    return id ? `sunsetCurrentChatId-${id}` : null;
  };

  const removeDraftConversation = useCallback(
    (conversationId: string | null) => {
      if (!conversationId) return;
      const conversationKey = getConversationsStorageKey();
      if (!conversationKey) return;

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
        localStorage.setItem(
          conversationKey,
          JSON.stringify(updated),
        );
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
    [],
  );

  const startNewConversation = useCallback(
    (options?: { baseConversation?: Conversation }) => {
      const chatIdKey = getChatIdStorageKey();
      const conversationKey = getConversationsStorageKey();
      if (!conversationKey) return;

      if (draftConversationId) {
        removeDraftConversation(draftConversationId);
      }

      const newConversationId = generateUUID();
      const now = new Date().toISOString();
      const baseConversation = options?.baseConversation;

      const baseRecipients =
        baseConversation?.recipients?.map((recipient) => ({ ...recipient })) ||
        [];
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
        localStorage.setItem(conversationKey, JSON.stringify(updated));
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
          const { [baseConversation.id]: _removed, ...withoutBase } =
            cleanedDrafts;
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
        if (chatIdKey) localStorage.setItem(chatIdKey, newConversationId);
      }
      localStorage.setItem('submittedForm', `submitted-${newConversationId}`);
      window.history.pushState({}, '', `?id=${newConversationId}`);
    },
    [
      draftConversationId,
      removeDraftConversation,
      setIsNewConversation,
      setRecipientInput,
    ],
  );

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
      const conversationKey = getConversationsStorageKey();
      if (!conversationKey) return;

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
          localStorage.setItem(conversationKey, JSON.stringify(updated));
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
        localStorage.setItem(conversationKey, JSON.stringify(updated));
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
      activeConversation,
      buildRecipientsForConversation,
      conversations,
      draftConversationId,
    ],
  );

  const handleUpdateRecipients = useCallback(
    (recipientNames: string[]) => {
      if (!activeConversation) return;
      const conversationKey = getConversationsStorageKey();
      if (!conversationKey) return;

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
        localStorage.setItem(conversationKey, JSON.stringify(updated));
        return updated;
      });
    },
    [activeConversation, buildRecipientsForConversation],
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
  //
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
    if (workspaceId) {
      localStorage.setItem(WORKSPACE_ID_KEY, workspaceId);
    }
  }, [workspaceId]);

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
    const conversationKey = getConversationsStorageKey();
    if (!conversationKey) return;
    if (conversations.length > 0) {
      localStorage.setItem(conversationKey, JSON.stringify(conversations));
    }
  }, [conversations]);

  // Fetch workspaces on mount, auto-create if none exist
  useEffect(() => {
    let cancelled = false;
    async function loadWorkspaces() {
      try {
        const res = await fetch('/api/workspaces');
        if (!res.ok) {
          console.error(
            '[App] Failed to fetch workspaces:',
            res.status,
            res.statusText,
          );
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
              console.log(
                '[App] Created and selected default workspace:',
                workspace.id,
              );
            }
            return;
          } else {
            console.error(
              '[App] Failed to create default workspace:',
              createRes.status,
            );
            return;
          }
        }

        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const invitedWorkspaceId = urlParams.get('invitedWorkspace');
        const chatId = urlParams.get('id');

        let selectedWorkspaceId: string | null = null;
        const lastWorkspaceId = localStorage.getItem(WORKSPACE_ID_KEY);

        // Priority 1: If there's a chat ID in the URL, find its workspace
        if (chatId) {
          // Check if this is a Profile chat (client-side only, not in DB)
          const matchingWorkspace = data.workspaces.find(
            (w: any) => getWorkspaceSpecificProfileId(w.id) === chatId
          );

          if (matchingWorkspace) {
            // This is a Profile chat - use its workspace directly
            selectedWorkspaceId = matchingWorkspace.id;
            console.log(
              '[App] Selected workspace based on Profile chat ID:',
              selectedWorkspaceId,
            );
            if (!cancelled) {
              setWorkspaceAccessError(null);
            }
          } else {
            // Not a Profile chat - fetch from API
            try {
              const chatRes = await fetch(`/api/chat/${chatId}`);
            if (chatRes.ok) {
              const chatData = await chatRes.json();
              // Check if this workspace exists in the user's workspaces
              const chatWorkspace = data.workspaces.find(
                (w: any) => w.id === chatData.chat?.workspaceId,
              );
              if (chatWorkspace) {
                selectedWorkspaceId = chatData.chat.workspaceId;
                console.log(
                  '[App] Selected workspace based on chat ID:',
                  selectedWorkspaceId,
                );
                if (!cancelled) {
                  setWorkspaceAccessError(null); // Clear any previous errors
                }
              } else {
                // User doesn't have access to this workspace
                console.warn(
                  '[App] User does not have access to the workspace for this chat',
                );
                console.log('[App] Setting workspace access error');
                if (!cancelled) {
                  setWorkspaceAccessError(
                    "You don't have access to this workspace. Please ask the workspace owner to invite you.",
                  );
                  console.log('[App] Workspace access error set');
                }
                selectedWorkspaceId = data.workspaces[0]?.id ?? null;
              }
            } else if (chatRes.status === 403 || chatRes.status === 404) {
              // User doesn't have access or chat doesn't exist
              console.warn('[App] Access denied or chat not found');
              if (!cancelled) {
                setWorkspaceAccessError(
                  chatRes.status === 403
                    ? "You don't have access to this chat. Please ask the workspace owner to invite you."
                    : "This chat doesn't exist or has been deleted.",
                );
              }
              selectedWorkspaceId = data.workspaces[0]?.id ?? null;
            } else {
              console.warn(
                '[App] Failed to fetch chat details, using first workspace',
              );
              selectedWorkspaceId = data.workspaces[0]?.id ?? null;
            }
          } catch (error) {
            console.error('[App] Error fetching chat details:', error);
            selectedWorkspaceId = data.workspaces[0]?.id ?? null;
          }
          }
        }
        // Priority 2: If invited to a workspace, use that one
        else if (invitedWorkspaceId) {
          const invitedWorkspace = data.workspaces.find(
            (w: any) => w.id === invitedWorkspaceId,
          );
          if (invitedWorkspace) {
            selectedWorkspaceId = invitedWorkspaceId;
            console.log(
              '[App] Switched to invited workspace:',
              invitedWorkspaceId,
            );

            // Clean up the URL by removing the query parameter
            window.history.replaceState({}, '', '/');
          } else {
            console.warn(
              '[App] Invited workspace not found, using first workspace',
            );
            selectedWorkspaceId = data.workspaces[0]?.id ?? null;
          }
        }
        // Priority 3: If there's no chat ID in the URL, check localStorage for last visited workspace
        else if (lastWorkspaceId) {
          const workspaceExists = data.workspaces.find((w: any) => w.id === lastWorkspaceId);

          if (workspaceExists) {
            selectedWorkspaceId = lastWorkspaceId;
          } else {
            console.warn(
              '[App] No saved workspace found, using first workspace',
            );
          }
        }
        // Priority 4: Default to first workspace
        else {
          selectedWorkspaceId = data.workspaces[0]?.id ?? null;
        }

        if (!cancelled) {
          setWorkspaceId(selectedWorkspaceId);
          console.log('[App] Selected workspace:', selectedWorkspaceId);
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

  // Get conversations from local storage (only after userId and workspaceId is available)
  useEffect(() => {
    if (!userId) return; // Wait for userId to be set
    const conversationKey = getConversationsStorageKey();
    if (!conversationKey) return;

    const initializeConversations = async () => {
      const saved = localStorage.getItem(conversationKey);
      const urlParams = new URLSearchParams(window.location.search);
      const urlConversationId = urlParams.get('id');

      // Start with initial conversations using user-specific IDs
      const initialConversations = createInitialConversationsForWorkspace(
        workspaceId!,
      );
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
          const initialIds = new Set([
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
      if (allConversations.length === 0) {
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
                : (existing?.messages ?? []),
              lastMessageTime: chat.lastMessage
                ? new Date(chat.lastMessage.createdAt).toISOString()
                : new Date(chat.createdAt).toISOString(),
              unreadCount: 0,
              pinned: chat.title === 'setup' ? true : existing?.pinned,
            });
          }

          // Ensure profile conversation exists
          const profileId = getWorkspaceSpecificProfileId(workspaceId!);
          if (!byId.has(profileId)) {
            const [profileConv] = createInitialConversationsForWorkspace(
              workspaceId!,
            );
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
            c.id === activeConversation
              ? { ...c, messages: data.messages ?? [] }
              : c,
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

  // Select chat from URL after workspace chats are loaded (only once)
  useEffect(() => {
    if (!hasLoadedWorkspaceChats) return;
    if (hasSelectedFromUrl.current) return; // Only do this once

    const urlParams = new URLSearchParams(window.location.search);
    const urlChatId = urlParams.get('id');

    if (urlChatId) {
      // Check if this chat exists in conversations now that workspace chats are loaded
      const chatExists = conversations.find((c) => c.id === urlChatId);
      if (chatExists) {
        console.log(
          '[App] Selecting chat from URL after workspace chats loaded:',
          urlChatId,
        );
        setActiveConversation(urlChatId);
        hasSelectedFromUrl.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoadedWorkspaceChats]);

  // Auto-select Profile chat when switching workspaces or on initial load
  useEffect(() => {
    console.log('🚀 Auto-select effect running', {
      workspaceId,
      hasLoadedWorkspaceChats,
      isSwitching: isSwitchingWorkspace.current,
      activeConversation,
      conversationsCount: conversations.length
    });

    if (!workspaceId) return;
    if (!hasLoadedWorkspaceChats) return;

    const profileId = getWorkspaceSpecificProfileId(workspaceId);
    const profileChat = conversations.find((c) => c.id === profileId);

    // If switching workspaces, select Profile chat
    if (isSwitchingWorkspace.current) {
      console.log('🔄 WORKSPACE SWITCHING PATH');
      // 1. Try to get the last active chat ID for this workspace from localStorage
      const chatIdKey = `supermemoryCurrentChatId-${workspaceId}`;
      const savedChatId = localStorage.getItem(chatIdKey);

      // 2. If we have a saved chat ID, check if that chat exists
      if (savedChatId) {
        const savedChat = conversations.find((c) => c.id === savedChatId);

        if (savedChat) {
          // Chat exists! Restore it
          console.log(
            '[App] Restoring last active chat after workspace switch:',
            savedChatId,
          );
          setActiveConversation(savedChatId);
          window.history.pushState({}, '', `?id=${savedChatId}`);
          isSwitchingWorkspace.current = false;
          return;
        }
      }

      // 3. Fall back to Profile chat if no saved chat or it doesn't exist
      if (profileChat) {
        console.log(
          '[App] Auto-selecting Profile chat after workspace switch:',
          profileId,
        );
        setActiveConversation(profileId);
        window.history.pushState({}, '', `?id=${profileId}`);
        isSwitchingWorkspace.current = false;
      }
      return;
    }

    // Check if there's a chat ID in the URL - if so, don't auto-select
    const urlParams = new URLSearchParams(window.location.search);
    const urlChatId = urlParams.get('id');
    if (urlChatId) return; // Let the URL-based selection handle it

    // Only auto-select on initial load if no conversation is active
    if (!activeConversation) {
      console.log('🆕 INITIAL LOAD PATH', {
        activeConversation,
        hasWorkspace: !!workspaceId,
        hasConversations: conversations.length
      });
      // Try reading from localStorage first, then setup, then Profile
      const chatIdKey = getChatIdStorageKey();
      console.log('🔑 Chat ID key:', chatIdKey);
      if (chatIdKey) {
        const savedChatId = localStorage.getItem(chatIdKey);
        console.log('💾 Saved chat ID from localStorage:', savedChatId);
        if (savedChatId) {
          const savedChat = conversations.find((c) => c.id === savedChatId);
          console.log('✅ Saved chat exists in conversations:', !!savedChat, {
            savedChatId,
            totalConversations: conversations.length,
            conversationIds: conversations.map(c => c.id)
          });
          if (savedChat) {
            console.log('🎯 Selecting saved chat:', savedChatId);
            setActiveConversation(savedChatId);
            window.history.pushState({}, '', `?id=${savedChatId}`);
            return;
          }
        }
      }

      console.log('📋 Falling back to setup or Profile chat');
      const setup = conversations.find((c) => c.name === 'setup');
      if (setup) {
        console.log('🔧 Selecting setup chat');
        setActiveConversation(setup.id);
        window.history.pushState({}, '', `?id=${setup.id}`);
      } else if (profileChat) {
        console.log('👤 Selecting Profile chat');
        setActiveConversation(profileId);
        window.history.pushState({}, '', `?id=${profileId}`);
      }
    }
  }, [userId, hasLoadedWorkspaceChats, conversations, activeConversation]);

  // Update lastActiveConversation whenever activeConversation changes
  useEffect(() => {
    if (activeConversation) {
      setLastActiveConversation(activeConversation);
      resetUnreadCount(activeConversation);

      // Save to workspace-specific localStorage
      const chatIdKey = getChatIdStorageKey();
      if (chatIdKey) {
        localStorage.setItem(chatIdKey, activeConversation);
        console.log(
          `[App] Saved active chat "${activeConversation}" to localStorage`
        );
      }
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
    const conversationKey = getConversationsStorageKey();
    if (!conversationKey) return;

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
      localStorage.setItem(conversationKey, JSON.stringify(updatedConversations));
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

  // Method to handle renaming chat
  const handleRenameConversation = (id: string) => {
    const conversation = conversations.find((c) => c.id === id);
    if (conversation) {
      setRenameChatId(id);
      setRenameChatName(conversation.name!);
      setShowRenameChatDialog(true);
    }
  };

  const handleConfirmRename = async () => {
    if (!renameChatName.trim() || !renameChatId) {
      toast({
        type: 'error',
        description: 'Chat name cannot be empty',
      });
      return;
    }

    setRenamingChat(true);

    try {
      const res = await fetch(`/api/chat/${renameChatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: renameChatName.trim() }),
      });

      console.log('[App] Rename response status:', res.status);

      if (!res.ok) {
        const data = await res.json();
        console.error('[App] Rename failed:', data);
        toast({
          type: 'error',
          description: data.message || 'Failed to rename chat',
        });
        setRenamingChat(false);
        return;
      }

      const data = await res.json();
      console.log('[App] Rename successful:', data);

      // Update local state
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === renameChatId
            ? { ...conv, name: renameChatName.trim() }
            : conv,
        ),
      );

      // Close dialog first, then show toast
      setShowRenameChatDialog(false);
      setRenameChatId(null);
      setRenameChatName('');
      setRenamingChat(false);

      // Show success toast after a slight delay to ensure dialog is closed
      setTimeout(() => {
        toast({
          type: 'success',
          description: 'Chat renamed successfully',
        });
      }, 100);
    } catch (error) {
      console.error('[App] Rename error:', error);
      toast({
        type: 'error',
        description: 'Failed to rename chat',
      });
      setRenamingChat(false);
    }
  };

  // Method to handle opening create chat dialog
  const handleOpenCreateChat = () => {
    setNewChatName('');
    setChatNameError('');
    setShowCreateChatDialog(true);
  };

  // Method to validate chat name (check for duplicates)
  const validateChatName = (name: string): boolean => {
    if (!name.trim()) {
      setChatNameError('Chat name cannot be empty');
      return false;
    }

    // Check if a chat with this name already exists in the workspace
    const existingChat = conversations.find(
      (conv) =>
        conv.name && conv.name.toLowerCase() === name.trim().toLowerCase(),
    );

    if (existingChat) {
      setChatNameError('A chat with this name already exists');
      return false;
    }

    setChatNameError('');
    return true;
  };

  // Method to create a new chat
  const handleCreateChat = async () => {
    if (!workspaceId) {
      toast({
        type: 'error',
        description: 'No workspace selected',
      });
      return;
    }

    const trimmedName = newChatName.trim();
    if (!validateChatName(trimmedName)) {
      return;
    }

    setCreatingChat(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: trimmedName }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({
          type: 'error',
          description: data.message || 'Failed to create chat',
        });
        setCreatingChat(false);
        return;
      }

      const data = await res.json();

      // Create a new conversation object for the local state
      const newConversation: Conversation = {
        id: data.chat.id,
        name: data.chat.title,
        recipients: [
          {
            id: 'ai',
            name: 'Supermemory',
            bio: 'Workspace AI assistant',
            title: 'AI',
          },
        ],
        messages: [],
        lastMessageTime: data.chat.createdAt,
        unreadCount: 0,
      };

      // Add to conversations list
      setConversations((prev) => [newConversation, ...prev]);

      // Close dialog and navigate to new chat
      setShowCreateChatDialog(false);
      setNewChatName('');
      setCreatingChat(false);

      // Navigate to the new chat
      selectConversation(data.chat.id);

      toast({
        type: 'success',
        description: 'Chat created successfully',
      });
    } catch (error) {
      console.error('[App] Create chat error:', error);
      toast({
        type: 'error',
        description: 'Failed to create chat',
      });
      setCreatingChat(false);
    }
  };

  // Method to handle conversation deletion
  const handleDeleteConversation = (id: string) => {
    // Don't allow deleting the Profile conversation
    if (id === getWorkspaceSpecificProfileId(workspaceId || '')) {
      toast({
        type: 'error',
        description: 'Cannot delete the Profile conversation',
      });
      return;
    }
    const conversationKey = getConversationsStorageKey();
    if (!conversationKey) return;

    // Clear lastActiveConversation if we're deleting it
    if (id === lastActiveConversation) {
      setLastActiveConversation(null);
    }

    setConversations((prevConversations) => {
      const newConversations = prevConversations.filter(
        (conv) => conv.id !== id,
      );

      // Save to localStorage
      localStorage.setItem(conversationKey, JSON.stringify(newConversations));

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
      type: 'success',
      description: 'Conversation deleted',
    });
  };

  // Method to handle conversation pin/unpin
  const handleUpdateConversation = (
    conversations: Conversation[],
    updateType?: 'pin' | 'mute',
  ) => {
    const conversationKey = getConversationsStorageKey();
    if (!conversationKey) return;
    const updatedConversation = conversations.find(
      (conv) => conv.id === activeConversation,
    );
    setConversations(conversations);
    localStorage.setItem(conversationKey, JSON.stringify(conversations));

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
          type: 'success',
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
      {/* Workspace Access Error Banner */}
      {workspaceAccessError && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{workspaceAccessError}</span>
          </div>
          <button
            onClick={() => setWorkspaceAccessError(null)}
            className="text-white hover:text-gray-200"
            aria-label="Close"
            type="button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
      <CommandMenu
        ref={commandMenuRef}
        conversations={conversations}
        activeConversation={activeConversation}
        onNewChat={() => {
          handleOpenCreateChat();
          commandMenuRef.current?.setOpen(false);
        }}
        onSelectConversation={selectConversation}
        onDeleteConversation={handleDeleteConversation}
        onUpdateConversation={handleUpdateConversation}
        onOpenChange={setIsCommandMenuOpen}
        soundEnabled={soundEnabled}
        onSoundToggle={handleSoundToggle}
      />
      <main
        className={`h-dvh w-full bg-background flex flex-col ${workspaceAccessError ? 'pt-12' : ''}`}
      >
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
              onRenameConversation={handleRenameConversation}
              onUpdateConversation={handleUpdateConversation}
              isMobileView={isMobileView}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              typingStatus={typingStatus}
              isCommandMenuOpen={isCommandMenuOpen}
              onScroll={setIsScrolled}
              onSoundToggle={handleSoundToggle}
              onNewChat={handleOpenCreateChat}
            >
              <Nav
                onNewChat={handleOpenCreateChat}
                isMobileView={isMobileView}
                isScrolled={isScrolled}
                currentWorkspaceId={workspaceId}
                onWorkspaceChange={(newWorkspaceId) => {
                  console.log('[App] Switching workspace to:', newWorkspaceId);
                  isSwitchingWorkspace.current = true;
                  hasSelectedFromUrl.current = false; // Reset URL selection flag
                  setWorkspaceId(newWorkspaceId);
                  // Clear conversations when switching workspaces
                  setConversations([]);
                  setActiveConversation(null);
                  setHasLoadedWorkspaceChats(false);
                }}
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
                  ? activeConversation ===
                    getWorkspaceSpecificProfileId(workspaceId!)
                  : false
              }
              userId={userId || undefined}
              workspaceId={workspaceId}
            />
          </div>
        </div>
      </main>

      {/* Rename Chat Dialog */}
      <Dialog
        open={showRenameChatDialog}
        onOpenChange={setShowRenameChatDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
            <DialogDescription>
              Enter a new name for this chat
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-chat-name">Chat Name</Label>
              <Input
                id="rename-chat-name"
                placeholder="My Chat"
                value={renameChatName}
                onChange={(e) => setRenameChatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRenameChatDialog(false);
                setRenameChatName('');
                setRenameChatId(null);
              }}
              disabled={renamingChat}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmRename} disabled={renamingChat}>
              {renamingChat ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Chat Dialog */}
      <Dialog
        open={showCreateChatDialog}
        onOpenChange={setShowCreateChatDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Chat</DialogTitle>
            <DialogDescription>Enter a name for the new chat</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-chat-name">Chat Name</Label>
              <Input
                id="new-chat-name"
                placeholder="Chat Name"
                value={newChatName}
                onChange={(e) => {
                  setNewChatName(e.target.value);
                  // Clear error when user starts typing
                  if (chatNameError) {
                    setChatNameError('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creatingChat) {
                    handleCreateChat();
                  }
                }}
              />
              {chatNameError && (
                <p className="text-sm text-red-600">{chatNameError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateChatDialog(false);
                setNewChatName('');
                setChatNameError('');
              }}
              disabled={creatingChat}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateChat} disabled={creatingChat}>
              {creatingChat ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
