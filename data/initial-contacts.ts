export interface InitialContact {
  name: string;
  title?: string;
  prompt?: string;
  bio?: string; // New field for short biography
  avatar?: string;
}

// Factory function to create user-specific initial contacts
// Returns a fresh array for each user to prevent any shared state
export const createInitialContactsForUser = (userId: string): InitialContact[] => {
  // Create fresh objects each time to prevent reference sharing
  return [
    {
      name: "Supermemory",
      title: "AI Assistant",
      bio: "Your AI-powered memory assistant. I can help you remember, organize, and find information.",
    },
  ];
};

// Legacy export for backward compatibility - but now creates fresh instances
export const getInitialContacts = (userId?: string): InitialContact[] => 
  createInitialContactsForUser(userId || 'default');

