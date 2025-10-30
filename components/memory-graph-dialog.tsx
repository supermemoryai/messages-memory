'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MemoryGraph } from '@/lib/ui/memory-graph';
import { Button } from '@/components/ui/button';
import { Network } from 'lucide-react';
import type { DocumentWithMemories } from '@/lib/types/supermemory';

interface MemoryGraphDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: boolean; // If true, renders a button to open the dialog
}

export function MemoryGraphDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerButton = false
}: MemoryGraphDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentWithMemories[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalLoaded, setTotalLoaded] = useState(0);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChange = controlledOnOpenChange || setInternalOpen;

  // Fetch documents when dialog opens
  const fetchDocuments = useCallback(async (page: number, limit: number = 500) => {
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
  }, []);

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

  // Load more documents (pagination)
  const loadMoreDocuments = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await fetchDocuments(nextPage, 100);

      if (data.documents && data.documents.length > 0) {
        setDocuments(prev => [...prev, ...data.documents]);
        setTotalLoaded(prev => prev + data.documents.length);
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
  const handleOpenChange = useCallback((newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen && documents.length === 0) {
      loadInitialDocuments();
    }
  }, [onOpenChange, documents.length, loadInitialDocuments]);

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
          <DialogContent className="w-[95vw] h-[95vh] max-w-7xl p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Memory Graph Visualization</DialogTitle>
            </DialogHeader>
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
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Render just the dialog (controlled externally)
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] h-[95vh] max-w-7xl p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Memory Graph Visualization</DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}