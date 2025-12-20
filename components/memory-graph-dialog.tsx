'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import '@supermemory/memory-graph/styles.css';
import { MemoryGraph } from '@supermemory/memory-graph';
import { Button } from '@/components/ui/button';
import { Network } from 'lucide-react';
import type { DocumentWithMemories } from '@/lib/types/supermemory';

interface Chat {
  id: string;
  title: string;
  createdAt: Date;
}

interface MemoryGraphDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: boolean; // If true, renders a button to open the dialog
}

export function MemoryGraphDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerButton = false,
}: MemoryGraphDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentWithMemories[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChange = controlledOnOpenChange || setInternalOpen;

  // Fetch documents for the selected chat
  const fetchDocuments = useCallback(async (page: number, limit = 500) => {
    if (!selectedChatId) return { documents: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, limit } };

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page,
          limit,
          sort: 'createdAt',
          order: 'desc',
          chatId: selectedChatId, // Include the selected chat ID
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching documents:', err);
      throw err;
    }
  }, [selectedChatId]);

  // Load initial documents
  const loadInitialDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments(1, 500);
      setDocuments(data.documents || []);
      setTotalLoaded(data.documents?.length || 0);
      setCurrentPage(1);
      setHasMore(data.pagination.currentPage < data.pagination.totalPages);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchDocuments]);

  const loadWorkspaceAndChats = useCallback(async () => {
    try {
      // Fetch workspaces
      const workspacesRes = await fetch('/api/workspaces');
      if (!workspacesRes.ok) return;

      const workspacesData = await workspacesRes.json();
      const firstWorkspace = workspacesData?.workspaces?.[0];
      if (!firstWorkspace) return;

      setWorkspaceId(firstWorkspace.id);

      // Fetch chats for this workspace
      const chatsRes = await fetch(`/api/history?workspaceId=${firstWorkspace.id}&limit=100`);
      if (!chatsRes.ok) return;

      const chatsData = await chatsRes.json();
      setChats(chatsData.chats || []);

      // Select first chat by default
      if (chatsData.chats && chatsData.chats.length > 0) {
        setSelectedChatId(chatsData.chats[0].id);
      }
    } catch (error) {
      console.error('[MemoryGraphDialog] Failed to load workspace and chats:', error);
    }
  }, []);

  // Fetch workspace and chats when dialog opens
  useEffect(() => {
    if (open) {
      loadWorkspaceAndChats();
    }
  }, [open, loadWorkspaceAndChats]);

  // Reload documents when selected chat changes
  useEffect(() => {
    if (selectedChatId) {
      loadInitialDocuments();
    }
  }, [selectedChatId, loadInitialDocuments]);

  // Load more documents (pagination)
  const loadMoreDocuments = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await fetchDocuments(nextPage, 100);

      if (data.documents && data.documents.length > 0) {
        setDocuments((prev) => [...prev, ...data.documents]);
        setTotalLoaded((prev) => prev + data.documents.length);
        setCurrentPage(nextPage);
        setHasMore(data.pagination.currentPage < data.pagination.totalPages);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more documents:', err);
      // Don't set error state for pagination failures
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMore, isLoadingMore, fetchDocuments]);

  // Handle dialog open state change
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (newOpen && documents.length === 0) {
        loadInitialDocuments();
      }
    },
    [onOpenChange, documents.length, loadInitialDocuments],
  );

  // Render trigger button if requested
  if (triggerButton && !controlledOpen) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenChange(true)}
          className="flex items-center gap-2"
        >
          <Network className="h-4 w-4" />
          Memory Graph
        </Button>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="w-[95vw] h-[95vh] max-w-7xl p-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle>Memory Graph - Channel View</DialogTitle>
                <Select value={selectedChatId || undefined} onValueChange={setSelectedChatId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {chats.map((chat) => (
                      <SelectItem key={chat.id} value={chat.id}>
                        {chat.title || 'Untitled Chat'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <MemoryGraph
                documents={documents}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                error={error}
                totalLoaded={totalLoaded}
                hasMore={hasMore}
                loadMoreDocuments={loadMoreDocuments}
                variant="consumer"
                showSpacesSelector={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Render just the dialog (controlled externally)
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] h-[95vh] max-w-7xl p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Memory Graph - Channel View</DialogTitle>
            <Select value={selectedChatId || undefined} onValueChange={setSelectedChatId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a channel..." />
              </SelectTrigger>
              <SelectContent>
                {chats.map((chat) => (
                  <SelectItem key={chat.id} value={chat.id}>
                    {chat.title || 'Untitled Chat'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <MemoryGraph
            documents={documents}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            error={error}
            totalLoaded={totalLoaded}
            hasMore={hasMore}
            loadMoreDocuments={loadMoreDocuments}
            variant="consumer"
            showSpacesSelector={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
