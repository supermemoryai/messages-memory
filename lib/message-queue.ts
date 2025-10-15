import type { Conversation, Message } from "../types";

// Represents a task in the message queue
type MessageTask = {
  id: string;
  conversation: Conversation;
  priority: number;
  timestamp: number;
  abortController: AbortController;
};

// Callback functions for handling various queue events
type MessageQueueCallbacks = {
  onMessageGenerated: (conversationId: string, message: Message) => void;
  onTypingStatusChange: (
    conversationId: string | null,
    recipient: string | null
  ) => void;
  onError: (error: Error) => void;
  onMessageUpdated?: (
    conversationId: string,
    messageId: string,
    updates: Partial<Message>
  ) => void;
};

// MessageQueue class manages the processing of chat messages for Supermemory
export class MessageQueue {
  private tasks: MessageTask[] = [];
  private callbacks: MessageQueueCallbacks;
  private activeConversation: string | null = null;
  private processing = false;

  constructor(callbacks: MessageQueueCallbacks) {
    this.callbacks = callbacks;
  }

  // Adds a user message to the queue with highest priority
  public enqueueUserMessage(conversation: Conversation) {
    // Cancel all pending AI messages
    this.cancelAllTasks();

    const task: MessageTask = {
      id: crypto.randomUUID(),
      conversation,
      priority: 100,
      timestamp: Date.now(),
      abortController: new AbortController(),
    };

    this.addTask(task);
  }

  // Adds an AI message to the queue with normal priority
  public enqueueAIMessage(conversation: Conversation) {
    const task: MessageTask = {
      id: crypto.randomUUID(),
      conversation,
      priority: 50,
      timestamp: Date.now(),
      abortController: new AbortController(),
    };

    this.addTask(task);
  }

  // Adds a new task to the queue and sorts tasks by priority and timestamp
  private addTask(task: MessageTask) {
    this.tasks.push(task);
    this.tasks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });

    if (!this.processing) {
      this.processNextTask();
    }
  }

  // Processes the next task in the queue
  private async processNextTask() {
    if (this.processing || this.tasks.length === 0) {
      return;
    }

    this.processing = true;
    const task = this.tasks.shift()!;

    try {
      // Start typing animation
      this.callbacks.onTypingStatusChange(task.conversation.id, "Supermemory");

      // Check if task was aborted
      if (task.abortController.signal.aborted) {
        this.callbacks.onTypingStatusChange(null, null);
        this.processing = false;
        this.processNextTask();
        return;
      }

      // Get the last user message
      const lastUserMessage = task.conversation.messages
        .filter(msg => msg.sender === "me")
        .pop();

      if (!lastUserMessage) {
        throw new Error("No user message found");
      }

      // Prepare the message in the format the API expects
      const messageId = crypto.randomUUID();
      const chatId = task.conversation.id;
      // If content is empty (file-only message), use a placeholder
      const messageContent = lastUserMessage.content.trim() || "📎 File attachment";

      const parts = [
        {
          type: "text" as const,
          text: messageContent,
        },
        ...(lastUserMessage.attachments || []).map(attachment => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
      ];

      const requestBody = {
        id: chatId,
        message: {
          id: messageId,
          createdAt: new Date(),
          role: "user" as const,
          content: messageContent,
          parts,
        },
        selectedChatModel: "chat-model" as const,
        selectedVisibilityType: "private" as const,
      };

      // Make API request to your existing chat endpoint
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: task.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", errorText);
        throw new Error(`API request failed: ${response.status}`);
      }

      // Handle streaming response (AI SDK v5 format)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      if (!reader) {
        throw new Error("No response body");
      }

      // Create a temporary message that we'll update as we stream
      const newMessageId = crypto.randomUUID();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          // Skip empty lines
          if (!line.trim()) continue;

          // AI SDK v5 uses SSE format with "data: " prefix
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim(); // Remove "data: " prefix

            // Skip [DONE] marker
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);

              // Handle text-delta events for streaming text
              if (parsed.type === 'text-delta' && parsed.delta) {
                accumulatedText += parsed.delta;
              }

              // Handle error events
              if (parsed.type === 'error') {
                throw new Error(`Stream error: ${parsed.message || 'Unknown error'}`);
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Stream error:')) {
                throw e;
              }
              // Ignore parse errors for partial chunks
              console.debug('Failed to parse stream chunk:', jsonStr);
            }
          }
        }
      }

      // Create final message with accumulated text
      const newMessage: Message = {
        id: newMessageId,
        content: accumulatedText,
        sender: "Supermemory",
        timestamp: new Date().toISOString(),
      };

      // Notify of new message
      this.callbacks.onMessageGenerated(task.conversation.id, newMessage);

      // Clear typing status
      this.callbacks.onTypingStatusChange(null, null);

    } catch (error) {
      if (error instanceof Error) {
        if (error.name !== "AbortError") {
          console.error("Error processing task:", error);
          this.callbacks.onError(error);
        }
      }
    } finally {
      this.processing = false;
      this.processNextTask(); // Process next task if available
    }
  }

  // Cancels all tasks in the queue
  public cancelAllTasks() {
    for (const task of this.tasks) {
      task.abortController.abort();
    }
    this.tasks = [];
    this.processing = false;
    this.callbacks.onTypingStatusChange(null, null);
  }

  public setActiveConversation(conversationId: string | null) {
    this.activeConversation = conversationId;
  }

  public getActiveConversation(): string | null {
    return this.activeConversation;
  }

  public dispose() {
    this.cancelAllTasks();
  }
}