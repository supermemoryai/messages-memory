"use client";

import { type ReactNode, useState, useEffect } from "react";
import type { Conversation } from "../types";
import { cn } from "@/lib/utils";
import { SearchBar } from "./search-bar";
import { ConversationItem } from "./conversation-item";
import { ScrollArea } from "./ui/scroll-area";
import { format, isToday, isYesterday, isThisWeek, parseISO } from "date-fns";
import { useTheme } from "next-themes";

interface SidebarProps {
  children: ReactNode;
  conversations: Conversation[];
  activeConversation: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onUpdateConversation: (conversations: Conversation[], updateType?: "pin" | "mute") => void;
  isMobileView: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  typingStatus: { conversationId: string; recipient: string } | null;
  isCommandMenuOpen: boolean;
  onScroll?: (isScrolled: boolean) => void;
  onSoundToggle: () => void;
}

export function Sidebar({
  children,
  conversations,
  activeConversation,
  onSelectConversation,
  onDeleteConversation,
  onUpdateConversation,
  isMobileView,
  searchTerm,
  onSearchChange,
  typingStatus,
  isCommandMenuOpen,
  onScroll,
  onSoundToggle,
}: SidebarProps) {
  const { theme, systemTheme, setTheme } = useTheme();
  const effectiveTheme = theme === "system" ? systemTheme : theme;
  const [openSwipedConvo, setOpenSwipedConvo] = useState<string | null>(null);

  const formatTime = (timestamp: string | undefined) => {
    if (!timestamp) return "";

    try {
      const date = parseISO(timestamp);

      if (isToday(date)) {
        return format(date, "h:mm a");
      }

      if (isYesterday(date)) {
        return "Yesterday";
      }

      if (isThisWeek(date)) {
        return format(date, "EEEE");
      }

      return format(date, "M/d/yy");
    } catch (error) {
      console.error("Error formatting time:", error, timestamp);
      return "Just now";
    }
  };

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const getReactionIconSvg = (reactionType: string) => {
    const variant = effectiveTheme === "dark" ? "dark" : "pinned-light";
    return `/messages/reactions/left-${variant}-${reactionType}.svg`;
  };

  const sortedConversations = [...conversations].sort((a, b) => {
    // Always pin Profile conversation at the top (Discord-style)
    const aIsProfile = a.recipients.some(r => r.name === 'Profile');
    const bIsProfile = b.recipients.some(r => r.name === 'Profile');

    if (aIsProfile && !bIsProfile) return -1;
    if (!aIsProfile && bIsProfile) return 1;

    // Then sort by pinned status
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // Discord-style: maintain creation order (don't sort by lastMessageTime)
    // Conversations are already ordered by creation time from the database/state
    return 0;
  });

  const filteredConversations = sortedConversations.filter((conversation) => {
    if (!searchTerm) return true;

    const hasMatchInMessages = conversation.messages
      .filter((message) => message.sender !== "system")
      .some((message) =>
        message.content.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const hasMatchInNames = conversation.recipients.some((recipient) =>
      recipient.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return hasMatchInMessages || hasMatchInNames;
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandMenuOpen) return;

      const activeElement = document.activeElement;
      const isChatHeaderActive =
        activeElement?.closest('[data-chat-header="true"]') !== null;

      if (isChatHeaderActive) {
        return;
      }

      if (["j", "k", "p", "d", "t", "s", "h"].includes(e.key)) {
        if (
          document.activeElement?.tagName === "INPUT" ||
          e.metaKey ||
          document
            .querySelector(".ProseMirror")
            ?.contains(document.activeElement)
        ) {
          return;
        }
      }

      if (e.key === "t") {
        e.preventDefault();
        setTheme(effectiveTheme === "light" ? "dark" : "light");
        return;
      }

      if (e.key === "s") {
        e.preventDefault();
        onSoundToggle();
        return;
      }

      if (e.key === "h" && activeConversation) {
        e.preventDefault();
        const updatedConversations = conversations.map((conv) =>
          conv.id === activeConversation
            ? { ...conv, hideAlerts: !conv.hideAlerts }
            : conv
        );
        onUpdateConversation(updatedConversations, "mute");
        return;
      }

      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        document.activeElement?.tagName !== "INPUT" &&
        !document.activeElement?.closest(".ProseMirror")
      ) {
        e.preventDefault();
        const searchInput = document.querySelector(
          'input[type="text"][placeholder="Search"]'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }

      if (
        (e.key === "ArrowDown" || e.key === "j") &&
        filteredConversations.length > 0
      ) {
        e.preventDefault();
        const currentIndex = filteredConversations.findIndex(
          (conv) => conv.id === activeConversation
        );

        if (currentIndex === -1) {
          onSelectConversation(filteredConversations[0].id);
          const firstConvoButton = document.querySelector(
            `button[aria-current="true"]`
          );
          firstConvoButton?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
          return;
        }

        const nextIndex = (currentIndex + 1) % filteredConversations.length;
        onSelectConversation(filteredConversations[nextIndex].id);
        setTimeout(() => {
          const nextConvoButton = document.querySelector(
            `button[aria-current="true"]`
          );
          nextConvoButton?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 0);
      } else if (
        (e.key === "ArrowUp" || e.key === "k") &&
        filteredConversations.length > 0
      ) {
        e.preventDefault();
        const currentIndex = filteredConversations.findIndex(
          (conv) => conv.id === activeConversation
        );

        if (currentIndex === -1) {
          onSelectConversation(
            filteredConversations[filteredConversations.length - 1].id
          );
          const lastConvoButton = document.querySelector(
            `button[aria-current="true"]`
          );
          lastConvoButton?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
          return;
        }

        const nextIndex =
          currentIndex - 1 < 0
            ? filteredConversations.length - 1
            : currentIndex - 1;
        onSelectConversation(filteredConversations[nextIndex].id);
        setTimeout(() => {
          const prevConvoButton = document.querySelector(
            `button[aria-current="true"]`
          );
          prevConvoButton?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 0);
      } else if (e.key === "p") {
        e.preventDefault();
        if (!activeConversation) return;

        const updatedConversations = conversations.map((conv) => {
          if (conv.id === activeConversation) {
            return { ...conv, pinned: !conv.pinned };
          }
          return conv;
        });
        onUpdateConversation(updatedConversations, "pin");
      } else if (e.key === "d") {
        e.preventDefault();
        if (!activeConversation) return;
        onDeleteConversation(activeConversation);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeConversation,
    filteredConversations,
    conversations,
    onSelectConversation,
    onUpdateConversation,
    onDeleteConversation,
    isCommandMenuOpen,
  ]);

  return (
    <div
      className={cn(
        "flex flex-col h-full",
        isMobileView ? "bg-background" : "bg-muted"
      )}
    >
      {children}
      <div className="flex-1 overflow-hidden">
        <ScrollArea
          className="h-full"
          onScrollCapture={(e: React.UIEvent<HTMLDivElement>) => {
            const viewport = e.currentTarget.querySelector(
              "[data-radix-scroll-area-viewport]"
            );
            if (viewport) {
              onScroll?.(viewport.scrollTop > 0);
            }
          }}
          isMobile={isMobileView}
          withVerticalMargins={false}
          bottomMargin="0px"
        >
          <div className={`${isMobileView ? "w-full" : "w-[320px]"} px-2`}>
            <SearchBar value={searchTerm} onChange={onSearchChange} />
            <div className="w-full">
              {filteredConversations.length === 0 && searchTerm ? (
                <div className="py-2">
                  <p className="text-sm text-muted-foreground px-2 mt-4">
                    No results found
                  </p>
                </div>
              ) : (
                <>
                  {/* All Conversations List (pinned first, then unpinned) */}
                  {filteredConversations.map((conversation, index, array) => {
                      const isActive = conversation.id === activeConversation;
                      const nextConversation = array[index + 1];
                      const isNextActive =
                        nextConversation?.id === activeConversation;

                      return (
                        <ConversationItem
                          key={conversation.id}
                          data-conversation-id={conversation.id}
                          conversation={{
                            ...conversation,
                            isTyping:
                              typingStatus?.conversationId === conversation.id,
                          }}
                          activeConversation={activeConversation}
                          onSelectConversation={onSelectConversation}
                          onDeleteConversation={onDeleteConversation}
                          onUpdateConversation={onUpdateConversation}
                          conversations={conversations}
                          formatTime={formatTime}
                          getInitials={getInitials}
                          isMobileView={isMobileView}
                          showDivider={
                            !isActive &&
                            !isNextActive &&
                            index !== array.length - 1
                          }
                          openSwipedConvo={openSwipedConvo}
                          setOpenSwipedConvo={setOpenSwipedConvo}
                        />
                      );
                    })}
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
