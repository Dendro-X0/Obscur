import type { NavItem } from "./nav-item";

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/", label: "Chats", i18nKey: "nav.chats" },
  { href: "/contacts", label: "Contacts", i18nKey: "nav.contacts" },
  { href: "/invites", label: "Invites", i18nKey: "nav.invites" },
  { href: "/search", label: "Search", i18nKey: "nav.search" },
  { href: "/requests", label: "Requests", i18nKey: "nav.requests" },
  { href: "/settings", label: "Settings", i18nKey: "nav.settings" }
];
