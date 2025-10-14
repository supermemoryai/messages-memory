"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { Conversation } from "../types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";

interface CommandMenuProps {
  conversations: Conversation[];
  activeConversation: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onUpdateConversation: (conversations: Conversation[], updateType?: "pin" | "mute") => void;
  onOpenChange: (open: boolean) => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
}

export interface CommandMenuRef {
  setOpen: (open: boolean) => void;
}

export const CommandMenu = forwardRef<CommandMenuRef, CommandMenuProps>(function CommandMenu(
  {
    conversations,
    activeConversation,
    onNewChat,
    onSelectConversation,
    onDeleteConversation,
    onUpdateConversation,
    onOpenChange,
    soundEnabled,
    onSoundToggle,
  },
  ref
) {
    const [open, setOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      setOpen,
    }));

    const handleOpenChange = (isOpen: boolean) => {
      setOpen(isOpen);
      onOpenChange(isOpen);
    };

    return (
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={onNewChat}>
              New Chat
            </CommandItem>
            <CommandItem onSelect={onSoundToggle}>
              {soundEnabled ? "Disable" : "Enable"} Sound
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Conversations">
            {conversations.map((conversation) => (
              <CommandItem
                key={conversation.id}
                onSelect={() => onSelectConversation(conversation.id)}
              >
                {conversation.name || conversation.recipients[0]?.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    );
  }
);