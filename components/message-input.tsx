import type { Recipient, Attachment } from "../types";
import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
  type ChangeEvent,
} from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Icons } from "./icons";
import { useTheme } from "next-themes";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import Placeholder from "@tiptap/extension-placeholder";
import { soundEffects } from "@/lib/sound-effects";
import Image from "next/image";

interface MessageInputProps {
  message: string;
  setMessage: (value: string) => void;
  handleSend: (attachments?: Attachment[]) => void;
  disabled?: boolean;
  recipients: Recipient[];
  isMobileView?: boolean;
  conversationId?: string;
  isNewChat?: boolean;
}

// Export type for message input's focus method
export type MessageInputHandle = {
  focus: () => void;
};

// Forward ref component to expose focus method to parent
export const MessageInput = forwardRef<
  MessageInputHandle,
  Omit<MessageInputProps, "ref">
>(function MessageInput(
  {
    message,
    setMessage,
    handleSend,
    disabled = false,
    recipients,
    isMobileView = false,
    conversationId,
    isNewChat = false,
  },
  ref
) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  // Tiptap editor definition
  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: disabled ? "This chat is read-only" : "Type a message...",
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention-node",
          style: "color: #0A7CFF !important; font-weight: 500 !important;",
          onanimationend: 'this.classList.add("shimmer-done")',
        },
        renderText: ({ node }) => {
          // Try to find the recipient by ID to get their name
          const recipient = recipients.find((r) => r.id === node.attrs.id);
          return (
            recipient?.name.split(" ")[0] ?? node.attrs.label ?? node.attrs.id
          );
        },
        renderHTML: ({ node }) => {
          // Try to find the recipient by ID to get their name
          const recipient = recipients.find((r) => r.id === node.attrs.id);
          const label =
            recipient?.name.split(" ")[0] ?? node.attrs.label ?? node.attrs.id;
          return [
            "span",
            {
              "data-type": "mention",
              "data-id": node.attrs.id,
              "data-label": label,
              class: "mention-node",
              style: "color: #0A7CFF !important; font-weight: 500 !important;",
            },
            label,
          ];
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            if (!query) return [];

            const searchText = query.toLowerCase().replace(/^@/, "");
            return recipients
              .filter((recipient) => {
                const [firstName] = recipient.name.split(" ");
                return firstName.toLowerCase().startsWith(searchText);
              })
              .slice(0, 5)
              .map((match) => ({
                id: match.id,
                label: match.name.split(" ")[0],
              }));
          },
          render: () => {
            let component: {
              element: HTMLElement;
              update: (props: {
                items: Array<{ id: string; label: string }>;
                query: string;
                command: (attrs: { id: string; label: string }) => void;
              }) => void;
            };
            return {
              onStart: (props: SuggestionProps) => {
                const { editor } = props;
                component = {
                  element: document.createElement("div"),
                  update: (props) => {
                    if (!props.query) return;

                    const match = props.items.find(
                      (item) =>
                        item.label.toLowerCase() ===
                        props.query.toLowerCase().replace(/^@/, "")
                    );

                    if (match) {
                      const { tr } = editor.state;
                      const start = tr.selection.from - props.query.length - 1;
                      const end = tr.selection.from;
                      editor
                        .chain()
                        .focus()
                        .deleteRange({ from: start, to: end })
                        .insertContent([
                          {
                            type: "mention",
                            attrs: { id: match.id, label: match.label },
                          },
                        ])
                        .run();
                    }
                  },
                };
                return component;
              },
              onUpdate: (props: SuggestionProps) => {
                component?.update(props);
              },
              onExit: () => {
                component?.element.remove();
              },
            };
          },
          char: "@",
          allowSpaces: false,
          decorationClass: "suggestion",
        },
      }),
    ],
    content: message,
    autofocus: !isMobileView && !isNewChat ? "end" : false,
    onUpdate: ({ editor }) => {
      if (editor.view?.dom) {
        const element = editor.view.dom as HTMLElement;
        const height = Math.min(200, Math.max(32, element.scrollHeight));
        const containerHeight = height + 32; // Add padding (16px top + 16px bottom)
        document.documentElement.style.setProperty(
          "--dynamic-height",
          `${containerHeight}px`
        );
      }
      setMessage(editor.getHTML());
    },
    onCreate: ({ editor }) => {
      if (!isMobileView && !isNewChat && editor.view && editor.view.dom) {
        // Delay focus slightly to ensure view is ready
        setTimeout(() => {
          if (editor.view?.dom) {
            editor.commands.focus("end");
          }
        }, 0);
      }
    },
    editorProps: {
      attributes: {
        class:
          "w-full bg-background border border-muted-foreground/20 rounded-[18px] pl-4 pr-10 py-2 text-base leading-tight focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] disabled:opacity-50 prose prose-sm prose-neutral dark:prose-invert max-w-none flex items-center",
        enterKeyHint: "send",
        style: "min-height: 36px; max-height: 200px; overflow-y: auto;",
        contentEditable: (attachments.length === 0 && uploadQueue.length === 0).toString(),
      },
      handleKeyDown: (view, event) => {
        // Disable keyboard input when uploading
        if (attachments.length > 0 || uploadQueue.length > 0) {
          event.preventDefault();
          return true;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSubmit();
          if (isMobileView && view.dom) {
            view.dom.blur();
          }
          return true;
        }
        return false;
      },
    },
    immediatelyRender: false,
  });

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment): attachment is Attachment => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }

      // Reset input
      if (event.target) {
        event.target.value = '';
      }
    },
    [],
  );

  const handleSubmit = () => {
    // Don't send if input is disabled (e.g., read-only chat)
    if (disabled) {
      return;
    }
    
    if (attachments.length > 0) {
      // Send attachments with a placeholder message
      const currentMessage = message.trim();
      setMessage("");
      if (editor && !editor.isDestroyed) {
        editor.commands.clearContent();
      }
      handleSend(attachments);
      setAttachments([]);
      soundEffects.playSentSound();
    } else if (message.trim()) {
      handleSend(undefined);
      soundEffects.playSentSound();
    }
  };

  // Expose focus method to parent through ref
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        // Focus editor at end of content
        if (editor && !editor.isDestroyed && editor.view && editor.view.dom) {
          editor.commands.focus("end");
        }
      },
    }),
    [editor]
  );

  // Effects
  // Update editor content when message changes
  useEffect(() => {
    if (editor && !editor.isDestroyed && message !== editor.getHTML()) {
      editor.commands.setContent(message);
    }
  }, [message, editor, isMobileView, disabled, conversationId]);

  // Update editor editable state when disabled prop changes
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  // Cleanup editor on component unmount
  useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed) {
        editor.destroy();
      }
    };
  }, [editor]);

  // Focus editor at end of content
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.view && editor.view.dom && conversationId && !isMobileView && !isNewChat) {
      // Use a small timeout to ensure the view is fully mounted
      const timer = setTimeout(() => {
        if (editor && !editor.isDestroyed && editor.view && editor.view.dom) {
          editor.commands.focus("end");
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [editor, conversationId, isMobileView, isNewChat]);

  // Update editor height for multi-line messages
  useEffect(() => {
    const updateHeight = () => {
      if (editor && !editor.isDestroyed && editor.view && editor.view.dom) {
        const element = editor.view.dom as HTMLElement;
        // Force reflow to get accurate scrollHeight
        element.style.height = "auto";
        // Get the scroll height including all content
        const contentHeight = element.scrollHeight;
        // Set the height considering padding and ensuring we don't exceed max height
        const height = Math.min(200, Math.max(32, contentHeight));
        const containerHeight = height + 32;

        // Handle height for both mobile and desktop
        element.style.height = `${height}px`;
        element.style.overflowY = height >= 200 ? "auto" : "hidden";
        document.documentElement.style.setProperty(
          "--dynamic-height",
          `${containerHeight}px`
        );
      }
    };

    // Only set up listeners if editor view is available
    if (!editor || editor.isDestroyed || !editor.view) {
      return;
    }

    // Update height on editor changes
    editor.on("update", updateHeight);

    // Update height on window resize
    window.addEventListener("resize", updateHeight);

    // Initial height calculation with small delay to ensure view is mounted
    const timer = setTimeout(updateHeight, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateHeight);
      if (editor && !editor.isDestroyed) {
        editor.off("update", updateHeight);
      }
    };
  }, [editor, isMobileView]);

  // Reset editor height when message is cleared (e.g. after sending)
  useEffect(() => {
    if (message === "" && editor && !editor.isDestroyed && editor.view && editor.view.dom) {
      const element = editor.view.dom as HTMLElement;
      if (element) {
        element.style.height = "32px";
        document.documentElement.style.setProperty("--dynamic-height", "64px");
      }
    }
  }, [message, editor]);

  // Handle blur with click outside and escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        buttonRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else if (editor && !editor.isDestroyed) {
          editor.commands.blur();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showEmojiPicker, editor]);

  return (
    <div className="w-full bg-background/50 backdrop-blur-md">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-4 pt-2 pb-0">
          <div className="flex gap-2 flex-wrap">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="relative w-20 h-16 rounded-md bg-muted overflow-hidden group"
              >
                {attachment.contentType.startsWith('image') ? (
                  <Image
                    src={attachment.url}
                    alt={attachment.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icons.paperclip className="h-6 w-6" />
                  </div>
                )}
                <button
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                  className="absolute top-0.5 right-0.5 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Icons.close className="h-3 w-3" />
                </button>
              </div>
            ))}
            {uploadQueue.map((filename, index) => (
              <div
                key={`uploading-${index}`}
                className="relative w-20 h-16 rounded-md bg-muted overflow-hidden flex items-center justify-center"
              >
                <Icons.spinner className="h-6 w-6 animate-spin" />
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex gap-2 p-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                multiple
                accept="*/*"
              />
        
        {/* Camera/Image button */}
        {!editor?.getText().trim() && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 self-end pb-[6px]"
            aria-label="Add attachment"
          >
            <Icons.paperclip className="h-5 w-5" />
          </button>
        )}
        
        <div className="relative flex-1">
          <EditorContent 
            editor={editor} 
            className={`w-full ${(attachments.length > 0 || uploadQueue.length > 0) ? 'opacity-50 pointer-events-none' : ''}`} 
          />
          {/* Show send button when there's text or attachments */}
          {(editor?.getText().trim() || attachments.length > 0) && (
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={disabled || (!message.trim() && attachments.length === 0)}
              className="absolute right-1 bottom-1 bg-[#0A7CFF] rounded-full p-1.5 text-white font-bold transition-colors hover:bg-[#0A7CFF]/90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Icons.arrowUp className="h-4 w-4" strokeWidth={3} />
            </button>
          )}
        </div>
        
        {/* Show emoji picker for desktop */}
        {!isMobileView && attachments.length === 0 && uploadQueue.length === 0 && (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 self-end pb-[6px]"
          >
            <Icons.smile className="h-5 w-5" />
          </button>
        )}
        
        {showEmojiPicker && !isMobileView && (
          <div
            ref={pickerRef}
            className="absolute bottom-16 right-4 z-50"
            style={{ width: "352px" }}
          >
            <Picker
              data={data}
              onEmojiSelect={(emoji: { native: string }) => {
                if (editor && !editor.isDestroyed) {
                  editor.commands.insertContent(emoji.native);
                }
                setShowEmojiPicker(false);
              }}
              theme={theme === "dark" ? "dark" : "light"}
            />
          </div>
        )}
      </div>
    </div>
  );
});
