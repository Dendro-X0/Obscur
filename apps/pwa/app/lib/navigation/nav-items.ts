import type { NavItem } from "./nav-item";

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/", label: "Chats", i18nKey: "nav.chats" },
  { href: "/contacts", label: "Contacts", i18nKey: "nav.contacts" },
  { href: "/invites", label: "Invites", i18nKey: "nav.invites" },
  { href: "/search", label: "Search", i18nKey: "nav.search" },
  { href: "/settings", label: "Settings", i18nKey: "nav.settings" },
];

export { NAV_ITEMS };
