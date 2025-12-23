'use client';

import type { UIMessage } from 'ai';
import type { Attachment } from '@ai-sdk/ui-utils';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Textarea } from './ui/textarea';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Loader2 } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { VisibilityType } from './visibility-selector';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  selectedVisibilityType,
}: {
  chatId: string;
  input: string;
  setInput: (input: string) => void;
  status: UseChatHelpers<UIMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  append: (message: any) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  className?: string;
  selectedVisibilityType: VisibilityType;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    const textPart = {
      type: 'text' as const,
      text: input,
    };
    
    const fileParts = attachments.map(attachment => ({
      type: 'file' as const,
      url: attachment.url,
      name: attachment.name,
      mediaType: attachment.contentType,
    }));

    const parts = [textPart, ...fileParts];

    append({
      role: 'user',
      content: input,
      parts,
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    append,
    input,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

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
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
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
          (attachment) => attachment !== undefined,
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
    },
    [setAttachments],
  );

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  return (
    <div className="relative w-full flex flex-col gap-2">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute left-1/2 bottom-28 -translate-x-1/2 z-50"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment
              key={attachment.url}
              attachment={attachment}
              onDelete={(attachment) => {
                setAttachments((currentAttachments) =>
                  currentAttachments.filter((a) => a.url !== attachment.url),
                );
              }}
            />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <Textarea
        data-testid="multimodal-input"
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        onPaste={async (event) => {
          const clipboardData = event.clipboardData;
          if (!clipboardData) return;

          // Check for files first (images, etc.)
          const files = Array.from(clipboardData.files);
          if (files.length > 0) {
            event.preventDefault();

            // Add files to upload queue
            setUploadQueue(files.map((file) => file.name));

            try {
              const uploadPromises = files.map((file) => uploadFile(file));
              const uploadedAttachments = await Promise.all(uploadPromises);
              const successfullyUploadedAttachments =
                uploadedAttachments.filter(
                  (attachment) => attachment !== undefined,
                );

              setAttachments((currentAttachments) => [
                ...currentAttachments,
                ...successfullyUploadedAttachments,
              ]);

              toast.success(
                `Added ${successfullyUploadedAttachments.length} file(s) from paste`,
              );
            } catch (error) {
              console.error('Error uploading pasted files:', error);
              toast.error('Failed to upload pasted files');
            } finally {
              setUploadQueue([]);
            }
            return;
          }

          // Handle long text as file
          const pastedText = clipboardData.getData('text');
          if (pastedText.length > 2000) {
            event.preventDefault();
            const file = new File([pastedText], 'pasted.txt', {
              type: 'text/plain',
            });
            setUploadQueue([file.name]);
            try {
              const attachment = await uploadFile(file);
              if (attachment) {
                setAttachments((currentAttachments) => [
                  ...currentAttachments,
                  attachment,
                ]);
                toast.success('Long text added as file attachment');
              }
            } catch (error) {
              console.error('Error uploading pasted text as file:', error);
              toast.error('Failed to upload pasted text as file');
            } finally {
              setUploadQueue([]);
            }
          }
        }}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden [field-sizing:normal] resize-none rounded-2xl !text-base bg-muted border border-border pb-10 pt-4',
          className,
        )}
        rows={2}
        autoFocus
        maxLength={1999}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();

            if (status === 'streaming' || status === 'submitted') {
              toast.error('Please wait for the model to finish its response!');
            } else {
              submitForm();
            }
          }
        }}
      />

      <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start">
        <AttachmentsButton fileInputRef={fileInputRef} status={status} />
        <ConnectDataButton chatId={chatId} status={status} />
      </div>

      <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
        {status === 'submitted' ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton
            input={input}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
          />
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<UIMessage>['status'];
}) {
  return (
    <Button
      data-testid="attachments-button"
      className="rounded-md rounded-bl-lg p-[7px] h-fit border-border hover:bg-accent"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready'}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function ConnectDataButton({
  chatId,
  status,
}: {
  chatId: string;
  status: UseChatHelpers<UIMessage>['status'];
}) {
  const [loading, setLoading] = useState(false);

  const handleConnect = useCallback(
    async (provider: 'google-drive' | 'notion' | 'onedrive' | 'web-crawler' | 'github') => {
      setLoading(true);
      try {
        const res = await fetch('/api/supermemory/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            chatId,
            documentLimit: 5000,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.message || 'Failed to start connection');
          return;
        }

        const data = await res.json();
        if (data.authLink) {
          window.location.href = data.authLink;
          return;
        }

        toast.error('No auth link returned from Supermemory');
      } catch (error) {
        toast.error('Failed to start connection');
      } finally {
        setLoading(false);
      }
    },
    [chatId],
  );

  const disabled = status !== 'ready' || loading;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="connect-data-button"
          className="ml-2 rounded-md p-[7px] h-fit border-border hover:bg-accent"
          variant="ghost"
          disabled={disabled}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect Data'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => handleConnect('google-drive')}>
          Connect Google Drive
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConnect('notion')}>
          Connect Notion
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConnect('onedrive')}>
          Connect OneDrive
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConnect('github')}>
          Connect GitHub
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConnect('web-crawler')}>
          Connect Web Crawler
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border border-border bg-card"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages: any) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit border border-border bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
