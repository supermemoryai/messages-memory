export interface InitialContact {
  name: string;
  title?: string;
  prompt?: string;
  bio?: string; // New field for short biography
  avatar?: string;
}

export const initialContacts: InitialContact[] = [
  {
    name: "Supermemory",
    title: "AI Assistant",
    bio: "Your AI-powered memory assistant. I can help you remember, organize, and find information.",
  },
];

