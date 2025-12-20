"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { MemoryGraph } from "@supermemory/memory-graph";
import type { DocumentWithMemories } from "@/lib/types/supermemory";

interface MemoryGraphViewProps {
  isActive?: boolean; // Whether the profile chat is currently active
  workspaceId?: string | null;
}

type WorkspaceChat = { id: string; title: string; createdAt: string };

export function MemoryGraphView({
  isActive = false,
  workspaceId = null,
}: MemoryGraphViewProps) {
  const [documents, setDocuments] = useState<DocumentWithMemories[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [channels, setChannels] = useState<WorkspaceChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const selectedChatTitle = useMemo(() => {
    const match = channels.find((c) => c.id === selectedChatId);
    return match?.title || "Select a channel";
  }, [channels, selectedChatId]);

  // Load channels list for dropdown when active
  useEffect(() => {
    if (!isActive || !workspaceId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/history?workspaceId=${workspaceId}&limit=100`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const chats: WorkspaceChat[] = data?.chats ?? [];
        if (cancelled) return;
        setChannels(chats);
        if (!selectedChatId && chats.length > 0) {
          // Prefer setup if present
          const setup = chats.find((c) => c.title === "setup");
          setSelectedChatId(setup?.id ?? chats[0].id);
        }
      } catch (e) {
        console.error("[MemoryGraph] Failed to load channels:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isActive, workspaceId, selectedChatId]);

  // Fetch documents
  const fetchDocuments = useCallback(
    async (page: number, limit: number = 500) => {
      try {
        if (!selectedChatId) {
          throw new Error("No channel selected");
        }
        console.log(
          "[MemoryGraph] Fetching documents - page:",
          page,
          "limit:",
          limit,
        );
        const response = await fetch("/api/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page,
            limit,
            sort: "createdAt",
            order: "desc",
            chatId: selectedChatId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch documents");
        }

        const data = await response.json();
        console.log(
          "[MemoryGraph] Received documents:",
          data.documents?.length || 0,
        );
        return data;
      } catch (err) {
        console.error("[MemoryGraph] Error fetching documents:", err);
        throw err;
      }
    },
    [selectedChatId],
  );

  // Load initial documents when component becomes active
  const loadInitialDocuments = useCallback(async () => {
    if (!isActive) return;
    if (!selectedChatId) return;

    console.log("[MemoryGraph] Loading initial documents...");
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments(1, 500);
      setDocuments(data.documents || []);
      setTotalLoaded(data.documents?.length || 0);
      setCurrentPage(1);
      setHasMore(data.pagination.currentPage < data.pagination.totalPages);
      setHasInitialized(true); // Mark as initialized after first load
      console.log(
        "[MemoryGraph] Initial load complete. Total loaded:",
        data.documents?.length || 0,
      );
    } catch (err) {
      console.error("[MemoryGraph] Initial load error:", err);
      setError(err as Error);
      setHasInitialized(true); // Mark as initialized even on error
    } finally {
      setIsLoading(false);
    }
  }, [isActive, fetchDocuments, selectedChatId]);

  // Load more documents (pagination)
  const loadMoreDocuments = useCallback(async () => {
    if (isLoadingMore || !hasMore || !isActive) return;

    console.log("[MemoryGraph] Loading more documents...");
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await fetchDocuments(nextPage, 100);

      if (data.documents && data.documents.length > 0) {
        setDocuments((prev) => [...prev, ...data.documents]);
        setTotalLoaded((prev) => prev + data.documents.length);
        setCurrentPage(nextPage);
        setHasMore(data.pagination.currentPage < data.pagination.totalPages);
        console.log(
          "[MemoryGraph] Loaded more. Total now:",
          totalLoaded + data.documents.length,
        );
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("[MemoryGraph] Error loading more documents:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    currentPage,
    hasMore,
    isLoadingMore,
    isActive,
    fetchDocuments,
    totalLoaded,
  ]);

  // Load documents when component becomes active
  useEffect(() => {
    if (isActive && !hasInitialized && !isLoading) {
      console.log(
        "[MemoryGraph] Component became active, loading documents...",
      );
      loadInitialDocuments();
    }
  }, [isActive, hasInitialized, isLoading, loadInitialDocuments]);

  // When switching channels, reset and reload
  useEffect(() => {
    if (!isActive) return;
    if (!selectedChatId) return;
    setHasInitialized(false);
    setDocuments([]);
    setCurrentPage(1);
    setHasMore(true);
    setTotalLoaded(0);
  }, [isActive, selectedChatId]);

  // Refresh documents periodically while active (only if we have documents)
  useEffect(() => {
    if (!isActive || !hasInitialized || documents.length === 0) return;

    // Refresh every 60 seconds while viewing
    const interval = setInterval(() => {
      console.log("[MemoryGraph] Auto-refreshing documents...");
      loadInitialDocuments();
    }, 60000);

    return () => clearInterval(interval);
  }, [isActive, hasInitialized, documents.length, loadInitialDocuments]);

  return (
    <div className="h-full w-full relative bg-gradient-to-b from-gray-900 to-black">
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-end">
        <div className="relative">
          <select
            className="bg-white text-black rounded-md px-3 py-2 min-w-[240px]"
            value={selectedChatId ?? ""}
            onChange={(e) => setSelectedChatId(e.target.value)}
          >
            <option value="" disabled>
              {selectedChatTitle}
            </option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || "Untitled Chat"}
              </option>
            ))}
          </select>
        </div>
      </div>
      {hasInitialized && documents.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              No Memories Yet
            </h3>
            <p className="text-sm text-gray-500">
              Start chatting with Supermemory to create your memory graph
            </p>
          </div>
        </div>
      )}
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
        autoLoadOnViewport={true}
      />
    </div>
  );
}
