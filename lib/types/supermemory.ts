// Types for Supermemory API responses

export interface MemoryRelatedMemory {
  relationType: 'updates' | 'extends' | 'derives';
  relatedMemoryId: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
  createdAt: string;
  spaceId: string;
  spaceContainerTag: string;
  isForgotten: boolean;
  forgetAfter?: string;
  isLatest: boolean;
  relatedMemories?: MemoryRelatedMemory[];
  memory?: string; // Optional legacy field
  memoryRelations?: any[]; // Optional legacy field
  parentMemoryId?: string; // Optional legacy field
}

export interface DocumentWithMemories {
  id: string;
  customId?: string;
  title: string;
  content: string;
  createdAt: string;
  containerTag: string;
  memoryEntries: MemoryEntry[];
  type?: string; // Optional document type (google_doc, pdf, etc.)
  url?: string; // Optional URL for external documents
  summary?: string; // Optional summary field
  summaryEmbedding?: number[] | Float32Array; // Optional embedding for similarity
}

export interface DocumentsWithMemoriesResponseSchema {
  documents: DocumentWithMemories[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
  };
}
