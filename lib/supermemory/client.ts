import Supermemory from "supermemory";
import type {
  ConnectionCreateResponse,
  ConnectionListResponse,
  ConnectionDeleteByIDResponse,
  ConnectionCreateParams,
} from "supermemory/resources";

const SUPERMEMORY_API_KEY = process.env.SUPERMEMORY_API_KEY;
if (!SUPERMEMORY_API_KEY) {
  throw new Error('SUPERMEMORY_API_KEY is not set');
}

const client = new Supermemory({
  apiKey: SUPERMEMORY_API_KEY
});

export type Provider = 'google-drive' | 'notion' | 'onedrive' | 'web-crawler' | 'github';

// Re-export SDK types for convenience
export type { ConnectionCreateResponse, ConnectionListResponse, ConnectionDeleteByIDResponse };

// Wrapper type for your app's needs (if you want to transform the response)
export interface CreateConnectionOptions {
  provider: Provider;
  redirectUrl: string;
  containerTags: string[];
  metadata?: Record<string, any>;
  documentLimit: number;
}

// Transform SDK response to match your app's naming (connectionId vs id)
export interface CreateConnectionResult {
  authLink: string;
  expiresIn: string;
  connectionId: string;
  redirectsTo?: string;
}

export async function createConnection(
  options: CreateConnectionOptions
): Promise<CreateConnectionResult> {
  const { provider, redirectUrl, containerTags, metadata, documentLimit } = options;

  const connection = await client.connections.create(provider, {
    redirectUrl,
    containerTags,
    documentLimit,
    metadata,
  } as ConnectionCreateParams);

  return {
    authLink: connection.authLink,
    connectionId: connection.id,
    expiresIn: connection.expiresIn,
    redirectsTo: connection.redirectsTo,
  };
}

export async function listConnections(chatId: string): Promise<ConnectionListResponse> {
  return await client.connections.list({
    containerTags: [chatId],
  });
}

export async function deleteConnection(
  connectionId: string
): Promise<ConnectionDeleteByIDResponse> {
  return await client.connections.deleteByID(connectionId);
}

export async function syncConnection(
  provider: Provider,
  options?: { containerTags?: string[] }
): Promise<string> {
  return await client.connections.import(provider, {
    containerTags: options?.containerTags,
  });
}