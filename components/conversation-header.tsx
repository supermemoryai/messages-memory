import { Icons } from "./icons";
import type { Conversation } from "../types";
import { Logo } from "./logo";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createInitialContactsForUser } from "../data/initial-contacts";
import { toast } from "@/components/toast";
import { cn, } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getUserContacts, addUserContact } from "@/lib/contacts";
import { ContactDrawer } from "./contact-drawer";
import { Trash2, Network, Link2, Loader2, RefreshCw, Trash } from "lucide-react";
import { signOut, signIn } from "next-auth/react";
import { MemoryGraphDialog } from "./memory-graph-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper to check if we can add more recipients
const hasReachedMaxRecipients = (recipients: string) => {
  const currentRecipients = recipients.split(",").filter((r) => r.trim());
  return currentRecipients.length >= 4;
};

// Helper to validate recipient count
const isValidRecipientCount = (recipients: string[]) => {
  const filtered = recipients.filter(r => r.trim());
  return filtered.length >= 1 && filtered.length <= 4;
};

// Types
interface ConversationHeaderProps {
  isNewChat: boolean;
  recipientInput: string;
  setRecipientInput: (value: string) => void;
  onBack?: () => void;
  isMobileView?: boolean;
  activeConversation?: Conversation;
  onUpdateRecipients?: (recipientNames: string[]) => void;
  onCreateConversation?: (recipientNames: string[]) => void;
  onStartNewConversation?: (baseConversation: Conversation) => void;
  onUpdateConversationName?: (name: string) => void;
  onHideAlertsChange?: (hide: boolean) => void;
  unreadCount?: number;
  showCompactNewChat?: boolean;
  setShowCompactNewChat?: (show: boolean) => void;
  onClearChat?: () => void;
  userId?: string; // Add userId prop
}

interface RecipientPillProps {
  recipient: string;
  index: number;
  onRemove: (index: number) => void;
  isMobileView?: boolean;
}

interface RecipientSearchProps {
  searchValue: string;
  setSearchValue: (value: string) => void;
  showResults: boolean;
  selectedIndex: number;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePersonSelect: (person: { name: string; title?: string; prompt?: string; bio?: string; avatar?: string }) => void;
  handleAddContact: () => Promise<void>;
  setSelectedIndex: (index: number) => void;
  setShowResults: (show: boolean) => void;
  updateRecipients: () => void;
  isMobileView?: boolean;
  recipientInput: string;
  isValidating: boolean;
  userId?: string;
}

// Sub-components
function RecipientPill({
  recipient,
  index,
  onRemove,
  isMobileView,
}: RecipientPillProps) {
  const trimmedRecipient = recipient.trim();
  if (!trimmedRecipient) return null;

  return (
    <div 
      className={cn("sm:inline", isMobileView && "w-full")}
      onMouseDown={(e) => {
        // Prevent the mousedown from reaching document level
        e.stopPropagation();
      }}
    >
      <span className="inline-flex items-center px-2 py-1 rounded-lg text-base sm:text-sm bg-blue-100/50 dark:bg-[#15406B]/50 text-gray-900 dark:text-gray-100">
        {trimmedRecipient}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(index);
          }}
          onMouseDown={(e) => e.preventDefault()}
          className="ml-1.5 hover:text-red-600 dark:hover:text-red-400"
          aria-label={`Remove ${trimmedRecipient}`}
        >
          <Icons.close className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}

function RecipientSearch({
  searchValue,
  setSearchValue,
  showResults,
  selectedIndex,
  handleKeyDown,
  handlePersonSelect,
  handleAddContact,
  setSelectedIndex,
  setShowResults,
  updateRecipients,
  isMobileView,
  recipientInput,
  isValidating,
  userId,
}: RecipientSearchProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const ITEM_HEIGHT = 36;  // Height of each item in pixels
  const MAX_VISIBLE_ITEMS = 8;  // Maximum number of items to show before scrolling

  // Focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Keep selected item in view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Filter people based on search value
  const displayPeople = useMemo(() => {
    const currentRecipients = recipientInput
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const combined = [...createInitialContactsForUser(userId || 'default')];
    const userContacts = getUserContacts();

    // Add user contacts, avoiding duplicates
    userContacts.forEach((contact) => {
      if (
        !combined.some(
          (p) => p.name.toLowerCase() === contact.name.toLowerCase()
        )
      ) {
        combined.push(contact);
      }
    });

    // Filter out current recipients and by search value
    const filtered = combined.filter((person) => {
      const matchesSearch =
        !searchValue ||
        person.name.toLowerCase().includes(searchValue.toLowerCase());
      const notSelected = !currentRecipients.includes(person.name);
      return matchesSearch && notSelected;
    });

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [searchValue, recipientInput, userId]);

  return (
    <div
      ref={searchRef}
      className={cn("relative", isMobileView ? "w-full" : "flex-1")}
      data-chat-header="true"
    >
      <div className="flex items-center w-full">
        {/* Recipient add functionality disabled */}
      </div>

      {showResults && displayPeople.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 min-w-[250px] w-max top-full mt-1 bg-background rounded-lg shadow-lg z-50"
          data-dropdown="true"
          tabIndex={-1}
        >
          <ScrollArea
            style={{
              height: `${Math.min(displayPeople.length * ITEM_HEIGHT, MAX_VISIBLE_ITEMS * ITEM_HEIGHT)}px`,
            }}
            className="w-full rounded-md border border-input bg-background"
            isMobile={isMobileView}
            bottomMargin="0"
          >
            <div>
              {displayPeople.map((person, index) => (
                <div
                  key={person.name}
                  ref={selectedIndex === index ? selectedItemRef : null}
                  className={`p-2 cursor-pointer rounded-md ${
                    selectedIndex === index
                      ? "bg-[#0A7CFF] hover:bg-[#0A7CFF]"
                      : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePersonSelect(person);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex flex-col">
                    <span
                      className={`text-sm ${
                        selectedIndex === index
                          ? "text-white"
                          : "text-[#0A7CFF]"
                      }`}
                    >
                      {person.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function MobileAvatars({
  recipients,
}: {
  recipients: Array<{ name: string; avatar?: string }>;
}) {
  const getOffset = (index: number, total: number) => {
    if (total === 1) return {};
    const yOffsets = [-4, 2, -2, 0];
    return {
      marginLeft: index === 0 ? "0px" : "-8px",
      transform: `translateY(${yOffsets[index]}px)`,
      zIndex: total - index,
    };
  };

  return (
    <>
      {recipients.slice(0, 4).map((recipient, index) => {
        const key = recipient.name || `recipient-${index}`;
        return (
        <div
          key={key}
          className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
          style={getOffset(index, recipients.length)}
        >
          {recipient.avatar ? (
            <img
              src={recipient.avatar}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#9BA1AA] to-[#7D828A] relative p-2">
              <Logo className="w-full h-full text-white" />
            </div>
          )}
        </div>
      )})}
    </>
  );
}

// Main component
export function ConversationHeader({
  isNewChat,
  recipientInput,
  setRecipientInput,
  onBack,
  isMobileView,
  activeConversation,
  onUpdateRecipients,
  onCreateConversation,
  onStartNewConversation,
  onUpdateConversationName,
  onHideAlertsChange,
  unreadCount,
  showCompactNewChat = false,
  setShowCompactNewChat = () => {},
  onClearChat,
  userId,
}: ConversationHeaderProps) {
  const [searchValue, setSearchValue] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showMemoryGraph, setShowMemoryGraph] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null);
  const [connections, setConnections] = useState<
    Array<{
      id?: string;
      connectionId?: string;
      provider?: string;
      email?: string;
      documentLimit?: number;
      expiresAt?: string;
      createdAt?: string;
      updatedAt?: string;
    }>
  >([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [openConnectMenu, setOpenConnectMenu] = useState(false);
  const chatId = activeConversation?.id || '';
  const [documentLimit, setDocumentLimit] = useState(5000);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [connectedToastShown, setConnectedToastShown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const isDropdownClick = target.closest('[data-dropdown]');
      const isPillRemoveClick = target.closest('button[aria-label^="Remove"]');
      const isHeaderClick = target.closest('[data-chat-header="true"]');

      // Don't handle dropdown clicks
      if (isDropdownClick) {
        event.stopPropagation();
        return;
      }

      // Don't exit edit mode on remove button clicks
      if (isPillRemoveClick) {
        return;
      }

      // Handle clicks outside the header
      if (!isHeaderClick) {
        const currentRecipients = recipientInput.split(",").filter(r => r.trim());
        
        // Only exit edit mode if recipients are valid
        if (isEditMode || isNewChat) {
          if (isValidRecipientCount(currentRecipients)) {
            // Stop this click from propagating
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (isEditMode) {
              setIsEditMode(false);
              onUpdateRecipients?.(currentRecipients);
            } else if (isNewChat) {
              if (isMobileView) {
                setShowResults(false);
                onCreateConversation?.(currentRecipients);
              } else {
                setShowCompactNewChat?.(true);
                onCreateConversation?.(currentRecipients);
              }
            }

            // Add a capture event listener to block the next click
            const blockNextClick = (e: Event) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              document.removeEventListener('click', blockNextClick, true);
            };
            document.addEventListener('click', blockNextClick, true);
          } else {
            // Show error toast if trying to save invalid state
            toast({ 
              type: 'error',
              description: currentRecipients.length === 0 
                ? "You need at least one recipient" 
                : "You can add up to four recipients"
            });
            return;
          }
        }

        // Reset search state
        setShowResults(false);
        setSearchValue("");
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNewChat, isEditMode, isMobileView, recipientInput, onUpdateRecipients, onCreateConversation, toast]);

  // Computed values
  const displayPeople = useMemo(() => {
    const currentRecipients = recipientInput
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const combined = [...createInitialContactsForUser(userId || 'default')];
    const userContacts = getUserContacts();

    // Add user contacts, avoiding duplicates
    userContacts.forEach((contact) => {
      if (
        !combined.some(
          (p) => p.name.toLowerCase() === contact.name.toLowerCase()
        )
      ) {
        combined.push(contact);
      }
    });

    // Filter out current recipients and by search value
    const filtered = combined.filter((person) => {
      const matchesSearch =
        !searchValue ||
        person.name.toLowerCase().includes(searchValue.toLowerCase());
      const notSelected = !currentRecipients.includes(person.name);
      return matchesSearch && notSelected;
    });

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [searchValue, recipientInput, userId]);

  // Handlers
  const updateRecipients = useCallback(() => {
    if (isNewChat || isEditMode) {
      const recipientNames = recipientInput.split(",").filter((r) => r.trim());

      if (isEditMode && recipientNames.length === 0) {
        toast({ type: 'error', description: "You need at least one recipient" });
        return;
      }

      if (isNewChat && !isMobileView && recipientNames.length === 0) {
        toast({ type: 'error', description: "Please add at least one recipient" });
        return;
      }

      if (isEditMode && recipientNames.length > 0 && !searchValue) {
        setIsEditMode(false);
        onUpdateRecipients?.(recipientNames);
      } else if (
        isNewChat &&
        (!isMobileView || recipientNames.length > 0) &&
        !searchValue
      ) {
        onCreateConversation?.(recipientNames);
      }
      if (!searchValue) {
        setSearchValue("");
      }
    }
  }, [
    isNewChat,
    isEditMode,
    recipientInput,
    onUpdateRecipients,
    onCreateConversation,
    toast,
    isMobileView,
    searchValue,
  ]);

  const handleHeaderClick = (e: React.MouseEvent) => {
    // Prevent clicks on dropdown or pill remove buttons from triggering header click
    const isDropdownClick = (e.target as Element).closest('[data-dropdown]');
    const isPillRemoveClick = (e.target as Element).closest('button[aria-label^="Remove"]');
    if (isDropdownClick || isPillRemoveClick) {
      e.stopPropagation();
      return;
    }

    // For existing chats, do nothing on header click (keep compact view)
    if (!isNewChat) {
      return;
    }

    // Desktop: clicking header in new chat compact mode enters edit mode
    else if (isNewChat && showCompactNewChat && !isMobileView) {
      setShowCompactNewChat?.(false);
      setShowResults(true);
      setSearchValue("");
      setSelectedIndex(-1);
      if (!recipientInput.split(",").filter((r) => r.trim()).length) {
        setRecipientInput("");
      }
    }
    // Mobile: clicking header in compact mode does nothing (handled by ContactDrawer)
  };

  const handlePersonSelect = (person: { name: string; title?: string; prompt?: string; bio?: string; avatar?: string }) => {
    const currentRecipients = recipientInput
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (currentRecipients.includes(person.name)) return;

    if (hasReachedMaxRecipients(recipientInput)) {
      toast({ type: 'error', description: "You can add up to four recipients" });
      return;
    }

    // Save the person as a contact for future use
    addUserContact(person.name);

    const newValue = recipientInput
      ? recipientInput
          .split(",")
          .filter((r) => r.trim())
          .concat(person.name)
          .join(",")
      : person.name;
    setRecipientInput(`${newValue},`);
    setSearchValue("");
    setShowResults(!hasReachedMaxRecipients(newValue));
    setSelectedIndex(-1);
  };

  const handleAddContact = async () => {
    if (searchValue.trim()) {
      try {
        setIsValidating(true);
        const response = await fetch("/messages/api/validate-contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: searchValue.trim() }),
        });
        const data = await response.json();

        if (data.validation === false) {
          toast({
            type: 'error',
            description: "Please enter a valid contact name",
          });
          return;
        }

        handlePersonSelect({
          name: searchValue.trim(),
          title: "Personal Contact",
        });
        setShowResults(true); // Keep the dropdown open for more selections
      } catch {
        toast({
          type: 'error',
          description: "Failed to validate contact name",
        });
      } finally {
        setIsValidating(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();

    if (e.key === "Backspace" && !searchValue) {
      e.preventDefault();
      const recipients = recipientInput.split(",").filter((r) => r.trim());
      if (recipients.length > 0) {
        const newRecipients = recipients.slice(0, -1).join(",");
        setRecipientInput(`${newRecipients},`);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setShowResults(false);
      setSelectedIndex(-1);
      updateRecipients();
      return;
    }

    if (!showResults) return;

    switch (e.key) {
      case "Enter": {
        e.preventDefault();
        if (displayPeople.length === 0 && searchValue.trim()) {
          handleAddContact();
          return;
        }
        if (selectedIndex >= 0 && selectedIndex < displayPeople.length) {
          handlePersonSelect(displayPeople[selectedIndex]);
        }
        break;
      }
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < displayPeople.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
        break;
    }
  };

  const handleClearChat = async () => {
    if (!activeConversation) return;

    const confirmClear = window.confirm('Are you sure you want to clear this chat?\n\nThis will start a new conversation with a fresh history.');
    if (!confirmClear) return;

    try {
      // Clear messages from the database
      const response = await fetch(`/api/chat/clear?id=${activeConversation.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Call the parent's clear chat handler
        if (onClearChat) {
          onClearChat();
        }

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

  const handleNewConversation = async () => {
    if (!activeConversation) return;

    const confirmNew = window.confirm('Start a new conversation?\n\nYour memories will be retained, but chat history will be cleared.');
    if (!confirmNew) return;

    try {
      const response = await fetch(`/api/chat/clear?id=${activeConversation.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (onClearChat) {
          onClearChat();
        }
        if (onStartNewConversation) {
          onStartNewConversation(activeConversation);
        }

        toast({
          type: 'success',
          description: 'New conversation started! Memories retained.',
        });
      } else {
        throw new Error('Failed to start new conversation');
      }
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to start new conversation',
      });
    }
  };

  const fetchConnections = useCallback(async () => {
    if (!chatId) return;
    setLoadingConnections(true);
    try {
      const res = await fetch(`/api/supermemory/connections?chatId=${chatId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ type: 'error', description: data.message || 'Failed to load connections' });
        return;
      }
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (error) {
      toast({ type: 'error', description: 'Failed to load connections' });
    } finally {
      setLoadingConnections(false);
    }
  }, [chatId, toast]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpenConnectMenu(nextOpen);
      if (nextOpen) {
        fetchConnections();
      }
    },
    [fetchConnections],
  );

  const handleDeleteConnection = useCallback(
    async (connectionId: string) => {
      if (!chatId) return;
      setDeletingConnectionId(connectionId);
      try {
        const res = await fetch(
          `/api/supermemory/connections?connectionId=${connectionId}&chatId=${chatId}`,
          { method: 'DELETE' },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({ type: 'error', description: data.message || 'Failed to delete connection' });
          return;
        }
        await fetchConnections();
      } catch (error) {
        toast({ type: 'error', description: 'Failed to delete connection' });
      } finally {
        setDeletingConnectionId(null);
      }
    },
    [chatId, fetchConnections, toast],
  );

  const handleSyncConnection = useCallback(
    async (connectionId: string, provider?: string) => {
      if (!chatId || !provider) return;
      setSyncingConnectionId(connectionId);
      try {
        const res = await fetch('/api/supermemory/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, provider }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({ type: 'error', description: data.message || 'Failed to sync connection' });
          return;
        }
        toast({ type: 'success', description: 'Sync requested' });
      } catch (error) {
        toast({ type: 'error', description: 'Failed to sync connection' });
      } finally {
        setSyncingConnectionId(null);
      }
    },
    [chatId, toast],
  );

  const handleConnect = useCallback(
    async (provider: 'google-drive' | 'notion' | 'onedrive' | 'web-crawler' | 'github') => {
      if (!chatId) return;
      const limit = Number.isFinite(documentLimit) && documentLimit > 0 ? documentLimit : 5000;
      setConnecting(true);
      try {
        const res = await fetch('/api/supermemory/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            chatId,
            documentLimit: limit,
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
    [chatId, documentLimit, toast],
  );

  const handleDeleteAll = async () => {
    if (!activeConversation) return;

    const confirmDelete = window.confirm('⚠️ WARNING: This will permanently delete ALL your memories and conversation history.\n\nThis action cannot be undone.\n\nAre you sure?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/chat/delete-all?id=${activeConversation.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Clear all localStorage
        if (typeof window !== 'undefined') {
          localStorage.clear();
        }

        toast({
          type: 'success',
          description: 'All memories deleted! Signing in as new user...',
        });

        // Sign out current user and sign in as a new guest
        // This will create a new anonymous user with a new userId
        await signOut({ redirect: false });

        // Sign in as a new guest user
        await signIn('guest', { redirect: false });

        // Reload the page to start fresh
        window.location.href = '/';
      } else {
        throw new Error('Failed to delete all');
      }
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to delete all data',
      });
    }
  };

  // Effects
  useEffect(() => {
    if (isNewChat) {
      setShowResults(true);
    }
  }, [isNewChat]);

  useEffect(() => {
    if (isEditMode && activeConversation?.recipients) {
      setRecipientInput(
        `${activeConversation.recipients.map((r) => r.name).join(",")},`
      );
    }
  }, [isEditMode, activeConversation]);

  useEffect(() => {
    if (connectedToastShown) return;
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('connected');
    if (connected === 'true') {
      toast({ type: 'success', description: 'Connection added' });
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
      setConnectedToastShown(true);
    }
  }, [connectedToastShown, toast]);

  // Render helpers
  const renderRecipients = () => {
    const recipients = recipientInput.split(",");
    const completeRecipients = recipients.slice(0, -1);
    const totalRecipients = completeRecipients.filter(r => r.trim()).length;

    return completeRecipients.map((recipient, index) => {
      const key = recipient.trim() || `recipient-${index}`;
      return (
      <RecipientPill
        key={key}
        recipient={recipient}
        index={index}
        onRemove={(index) => {
          // Prevent removing if it's the last recipient
          if (totalRecipients <= 1) {
            toast({ 
              type: 'error',
              description: "You must have at least one recipient" 
            });
            return;
          }

          const newRecipients = recipientInput
            .split(",")
            .filter((r) => r.trim())
            .filter((_, i) => i !== index)
            .join(",");
          setRecipientInput(`${newRecipients},`);
          
          // Only update recipients if we're not in edit mode
          if (!isEditMode && onUpdateRecipients) {
            onUpdateRecipients(
              newRecipients.split(",").filter((r) => r.trim())
            );
          }
        }}
        isMobileView={isMobileView}
      />
    )});
  };

  return (
    <div className="sticky top-0 z-10 flex flex-col w-full bg-background/50 backdrop-blur-md border-b">
      {/* Mobile view */}
      {isMobileView ? (
        <div
          className="flex items-center justify-between px-4 relative min-h-24 py-2"
          onClick={handleHeaderClick}
          data-chat-header="true"
        >
          {/* Back button and unread count */}
          <div className="flex items-center gap-2 flex-1">
            <div className="absolute left-2 top-8 w-12">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isNewChat) {
                    setRecipientInput("");
                    setSearchValue("");
                    setShowResults(false);
                  }
                  onBack?.();
                }}
                className="rounded-sm relative flex items-center gap-2"
                aria-label="Back to conversations"
              >
                <Icons.back size={32} />
                {unreadCount ? (
                  <div className="bg-[#0A7CFF] text-white rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-medium -ml-4">
                    {unreadCount}
                  </div>
                ) : null}
              </button>
            </div>
            {/* Mobile new chat or edit view */}
            {(isNewChat && !showCompactNewChat) || isEditMode ? (
              <div
                className="flex-1 pl-16"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1 flex-wrap py-6">
                  <div className="absolute left-16 top-9">
                    <span className="text-base sm:text-sm text-muted-foreground">
                      To:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 flex-1 items-center pl-4">
                    {renderRecipients()}
                    {recipientInput.split(",").filter((r) => r.trim()).length <
                      4 && (
                      <RecipientSearch
                        searchValue={searchValue}
                        setSearchValue={setSearchValue}
                        showResults={showResults}
                        selectedIndex={selectedIndex}
                        handleKeyDown={handleKeyDown}
                        handlePersonSelect={handlePersonSelect}
                        handleAddContact={handleAddContact}
                        setSelectedIndex={setSelectedIndex}
                        setShowResults={setShowResults}
                        updateRecipients={updateRecipients}
                        isMobileView={isMobileView}
                        recipientInput={recipientInput}
                        isValidating={isValidating}
                        userId={userId}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Mobile avatar view
              <div
                className="flex absolute left-1/2 -translate-x-1/2 transform"
                onClick={handleHeaderClick}
                data-chat-header="true"
              >
                <div className="flex flex-col items-center">
                  <div className="flex items-center py-2">
                    <MobileAvatars
                      recipients={
                        isNewChat
                          ? recipientInput
                              .split(",")
                              .filter((r) => r.trim())
                              .map((name) => ({ name }))
                          : activeConversation?.recipients || []
                      }
                    />
                  </div>
                  <span className="text-xs flex items-center">
                    {isMobileView && !isNewChat && activeConversation && (
                      <ContactDrawer
                        recipientCount={activeConversation.recipients.length}
                        recipients={
                          activeConversation?.recipients.map((recipient) => {
                            const initialContacts = createInitialContactsForUser(userId || 'default');
                            const contact = initialContacts.find(
                              (p) => p.name === recipient.name
                            );
                            return {
                              name: recipient.name,
                              avatar: recipient.avatar,
                              bio: contact?.bio,
                              title: contact?.title,
                            };
                          }) || []
                        }
                        onUpdateName={onUpdateConversationName}
                        conversationName={activeConversation.name}
                        onAddContact={() => {
                          setIsEditMode(true);
                        }}
                        onHideAlertsChange={onHideAlertsChange}
                        hideAlerts={activeConversation.hideAlerts}
                      />
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Mobile Action Buttons - only show for Supermemory chat */}
          {!isNewChat && activeConversation && activeConversation.recipients.some(r => r.name === 'Supermemory') && (
            <div className="absolute right-4 top-8 flex gap-1">
              <DropdownMenu open={openConnectMenu} onOpenChange={handleOpenChange}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-accent rounded-full transition-colors"
                    aria-label="Connect data source"
                    title="Connect data source"
                    disabled={connecting}
                  >
                    {connecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 max-h-[26rem] overflow-hidden">
                  <div className="px-3 py-1 text-xs text-muted-foreground">Add connection</div>
                  <DropdownMenuItem onClick={() => handleConnect('notion')}>
                    Connect Notion
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleConnect('onedrive')}>
                    Connect OneDrive
                  </DropdownMenuItem>
                  <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground">Document limit</div>
                  <div className="px-3 pb-2">
                    <input
                      type="number"
                      min={1}
                      value={documentLimit}
                      onChange={(e) => setDocumentLimit(Number.parseInt(e.target.value || '0'))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Connections</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fetchConnections();
                      }}
                      className="inline-flex items-center gap-1 text-xs text-foreground hover:underline"
                    >
                      <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                  </div>
                  <ScrollArea className="max-h-80 overflow-y-auto">
                    {loadingConnections ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    ) : connections.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No connections yet</div>
                    ) : (
                      connections.map((conn) => {
                        const key = conn.connectionId || conn.id || crypto.randomUUID();
                        return (
                          <div
                            key={key}
                            className="px-3 py-2 text-sm flex items-center justify-between gap-2"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{conn.provider || 'Unknown provider'}</span>
                              <span className="text-xs text-muted-foreground">
                                {conn.email || 'Unknown user'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const targetId = conn.connectionId || conn.id;
                                  if (targetId && conn.provider) {
                                    handleSyncConnection(targetId, conn.provider);
                                  }
                                }}
                                className="p-1 rounded hover:bg-accent text-foreground inline-flex items-center gap-1"
                                aria-label="Sync connection"
                                title="Sync connection"
                                disabled={syncingConnectionId === (conn.connectionId || conn.id)}
                              >
                                {syncingConnectionId === (conn.connectionId || conn.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="h-4 w-4" />
                                    <span className="text-xs">Sync</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const targetId = conn.connectionId || conn.id;
                                  if (targetId) {
                                    handleDeleteConnection(targetId);
                                  }
                                }}
                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                                aria-label="Delete connection"
                                title="Delete connection"
                                disabled={deletingConnectionId === (conn.connectionId || conn.id)}
                              >
                                {deletingConnectionId === (conn.connectionId || conn.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAll();
                }}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors text-red-600 dark:text-red-400"
                aria-label="Delete all memories and history"
                title="Delete all memories and history"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Mobile Action Buttons - only show for Profile chat */}
          {!isNewChat && activeConversation && activeConversation.recipients.some(r => r.name === 'Profile') && (
            <div className="absolute right-4 top-8 flex gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMemoryGraph(true);
                }}
                className="p-2 hover:bg-accent rounded-full transition-colors"
                aria-label="View Memory Graph"
                title="View Memory Graph"
              >
                <Network className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        // Desktop View
        <div
          className="flex items-center justify-between px-4 relative h-16"
          onClick={handleHeaderClick}
          data-chat-header="true"
        >
          {/* Desktop new chat or edit view */}
          <div className="flex items-center gap-2 flex-1">
            {(isNewChat && !showCompactNewChat) || isEditMode ? (
              <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1 flex-wrap py-6">
                  <span className="text-base sm:text-sm text-muted-foreground">
                    To:
                  </span>
                  <div className="flex flex-wrap gap-1 flex-1 items-center">
                    {renderRecipients()}
                    {recipientInput.split(",").filter((r) => r.trim()).length <
                      4 && (
                      <RecipientSearch
                        searchValue={searchValue}
                        setSearchValue={setSearchValue}
                        showResults={showResults}
                        selectedIndex={selectedIndex}
                        handleKeyDown={handleKeyDown}
                        handlePersonSelect={handlePersonSelect}
                        handleAddContact={handleAddContact}
                        setSelectedIndex={setSelectedIndex}
                        setShowResults={setShowResults}
                        updateRecipients={updateRecipients}
                        isMobileView={isMobileView}
                        recipientInput={recipientInput}
                        isValidating={isValidating}
                        userId={userId}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Desktop compact view
              <div
                className="flex"
                onClick={handleHeaderClick}
                data-chat-header="true"
              >
                <span className="text-sm">
                  <span className="text-muted-foreground">To: </span>
                  {(() => {
                    if (!isNewChat && activeConversation?.name) {
                      return activeConversation.name;
                    }
                    const recipients =
                      activeConversation?.recipients.map((r) => r.name) || [];
                    return recipients.length <= 3
                      ? recipients.join(", ")
                      : `${recipients[0]}, ${recipients[1]}, ${
                          recipients[2]
                        } +${recipients.length - 3}`;
                  })()}
                </span>
              </div>
            )}
          </div>
          
          {/* Desktop Action Buttons - only show for Supermemory chat */}
          {!isNewChat && activeConversation && activeConversation.recipients.some(r => r.name === 'Supermemory') && (
            <div className="ml-auto flex gap-1">
              <DropdownMenu open={openConnectMenu} onOpenChange={handleOpenChange}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-accent rounded-full transition-colors"
                    aria-label="Connect data source"
                    title="Connect data source"
                    disabled={connecting}
                  >
                    {connecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 max-h-[26rem] overflow-hidden">
                  <div className="px-3 py-1 text-xs text-muted-foreground">Add connection</div>
                  <DropdownMenuItem onClick={() => handleConnect('notion')}>
                    Connect Notion
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleConnect('onedrive')}>
                    Connect OneDrive
                  </DropdownMenuItem>
                  <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground">Document limit</div>
                  <div className="px-3 pb-2">
                    <input
                      type="number"
                      min={1}
                      value={documentLimit}
                      onChange={(e) => setDocumentLimit(Number.parseInt(e.target.value || '0'))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Connections</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fetchConnections();
                      }}
                      className="inline-flex items-center gap-1 text-xs text-foreground hover:underline"
                    >
                      <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                  </div>
                  <ScrollArea className="max-h-80 overflow-y-auto">
                    {loadingConnections ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    ) : connections.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No connections yet</div>
                    ) : (
                      connections.map((conn) => {
                        const key = conn.connectionId || conn.id || crypto.randomUUID();
                        return (
                          <div
                            key={key}
                            className="px-3 py-2 text-sm flex items-center justify-between gap-2"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{conn.provider || 'Unknown provider'}</span>
                              <span className="text-xs text-muted-foreground">
                                {conn.email || 'Unknown user'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const targetId = conn.connectionId || conn.id;
                                  if (targetId && conn.provider) {
                                    handleSyncConnection(targetId, conn.provider);
                                  }
                                }}
                              className="p-1 rounded hover:bg-accent text-foreground inline-flex items-center gap-1"
                                aria-label="Sync connection"
                                title="Sync connection"
                                disabled={syncingConnectionId === (conn.connectionId || conn.id)}
                              >
                                {syncingConnectionId === (conn.connectionId || conn.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                <>
                                  <RefreshCw className="h-4 w-4" />
                                  <span className="text-xs">Sync</span>
                                </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const targetId = conn.connectionId || conn.id;
                                  if (targetId) {
                                    handleDeleteConnection(targetId);
                                  }
                                }}
                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                                aria-label="Delete connection"
                                title="Delete connection"
                                disabled={deletingConnectionId === (conn.connectionId || conn.id)}
                              >
                                {deletingConnectionId === (conn.connectionId || conn.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAll();
                }}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors text-red-600 dark:text-red-400"
                aria-label="Delete all memories and history"
                title="Delete all memories and history"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Desktop Action Buttons - only show for Profile chat */}
          {!isNewChat && activeConversation && activeConversation.recipients.some(r => r.name === 'Profile') && (
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMemoryGraph(true);
                }}
                className="p-2 hover:bg-accent rounded-full transition-colors"
                aria-label="View Memory Graph"
                title="View Memory Graph"
              >
                <Network className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Memory Graph Dialog */}
      <MemoryGraphDialog
        open={showMemoryGraph}
        onOpenChange={setShowMemoryGraph}
      />
    </div>
  );
}
