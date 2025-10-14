export interface InitialContact {
  name: string;
  title?: string;
  prompt?: string;
  bio?: string;
  avatar?: string;
}

const CONTACTS_KEY = "user_contacts";

export function getUserContacts(): InitialContact[] {
  if (typeof window === "undefined") return [];
  const contacts = localStorage.getItem(CONTACTS_KEY);
  return contacts ? JSON.parse(contacts) : [];
}

export function addUserContact(name: string): InitialContact[] {
  const contacts = getUserContacts();
  const newContact: InitialContact = {
    name,
    title: "Custom Contact"
  };
  
  // Check if contact already exists
  if (!contacts.some(contact => contact.name.toLowerCase() === name.toLowerCase())) {
    contacts.push(newContact);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  }
  
  return contacts;
}

