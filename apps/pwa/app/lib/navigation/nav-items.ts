import type { NavItem } from "./nav-item";

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/", label: "Chats", i18nKey: "nav.chats" },
  { href: "/network", label: "Network", i18nKey: "nav.network" },
  { href: "/vault", label: "Vault", i18nKey: "nav.vault" },
  { href: "/settings", label: "Settings", i18nKey: "nav.settings" }
];
