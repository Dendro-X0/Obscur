export type MessagingSidebarTab = "chats" | "requests" | "junk";

export const isMessagingSidebarTab = (value: string): value is MessagingSidebarTab => (
  value === "chats" || value === "requests" || value === "junk"
);
