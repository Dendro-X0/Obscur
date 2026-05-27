export type SettingsTabId =
    | "profile"
    | "identity"
    | "relays"
    | "notifications"
    | "appearance"
    | "blocklist"
    | "privacy"
    | "security"
    | "storage"
    | "updates";

export type SettingsSearchEntry = Readonly<{
    id: string;
    tab: SettingsTabId;
    /** DOM id without leading # for in-panel scroll targets */
    elementId?: string;
    title: string;
    description: string;
    keywords: readonly string[];
}>;

export const SETTINGS_SEARCH_INDEX: readonly SettingsSearchEntry[] = [
    {
        id: "tab-profile",
        tab: "profile",
        elementId: "profile",
        title: "Profile",
        description: "Display name, avatar, bio, invite code, and profile publishing.",
        keywords: ["profile", "username", "avatar", "bio", "nip05", "invite code", "publish"],
    },
    {
        id: "tab-appearance",
        tab: "appearance",
        title: "Appearance",
        description: "Theme, language, and text scale.",
        keywords: ["appearance", "theme", "dark", "light", "language", "text size", "accessibility"],
    },
    {
        id: "tab-notifications",
        tab: "notifications",
        title: "Notifications",
        description: "Desktop and in-app notification preferences.",
        keywords: ["notifications", "desktop", "alerts", "sounds"],
    },
    {
        id: "tab-identity",
        tab: "identity",
        title: "Identity",
        description: "Keys, profiles, and identity switching.",
        keywords: ["identity", "keys", "npub", "nsec", "profile switcher", "retired"],
    },
    {
        id: "tab-security",
        tab: "security",
        title: "Security",
        description: "Password, auto-lock, and vault security controls.",
        keywords: ["security", "password", "auto lock", "vault", "encryption"],
    },
    {
        id: "security-password",
        tab: "security",
        elementId: "security-password-reset",
        title: "Password reset",
        description: "Change or reset the local vault password.",
        keywords: ["password", "reset", "unlock", "pin"],
    },
    {
        id: "security-auto-lock",
        tab: "security",
        title: "Auto-lock",
        description: "Lock the app after inactivity.",
        keywords: ["auto lock", "timeout", "idle", "lock screen"],
    },
    {
        id: "tab-relays",
        tab: "relays",
        title: "Relay connections",
        description: "Manage Nostr relay URLs, health, and publish readiness.",
        keywords: ["relays", "nostr", "relay", "wss", "nos.lol", "fiatjaf", "connectivity"],
    },
    {
        id: "operator-trust-setup",
        tab: "relays",
        elementId: "operator-trust-setup",
        title: "Operator setup (private trust)",
        description: "Bundle coordination URL and private workspace relay for team communities.",
        keywords: [
            "operator",
            "private trust",
            "coordination",
            "8787",
            "workspace relay",
            "localhost",
            "managed workspace",
            "intranet",
        ],
    },
    {
        id: "membership-sync",
        tab: "relays",
        elementId: "membership-sync-settings",
        title: "Community membership sync",
        description: "Nostr-only vs coordination-preferred roster merge for communities.",
        keywords: [
            "membership sync",
            "coordination sync",
            "coordination preferred",
            "nostr only",
            "community",
            "roster",
            "leave",
            "directory",
        ],
    },
    {
        id: "relay-api",
        tab: "relays",
        elementId: "relay-api-status",
        title: "API status",
        description: "Local API endpoint health and advisory.",
        keywords: ["api", "endpoint", "health", "3340", "advisory"],
    },
    {
        id: "relay-advanced",
        tab: "relays",
        title: "Relay advanced settings",
        description: "Primary relay selection, redundancy presets, and relay list editing.",
        keywords: ["advanced", "primary relay", "redundancy", "latency", "preset"],
    },
    {
        id: "relay-community-modes",
        tab: "relays",
        elementId: "relay-community-modes",
        title: "Community modes",
        description: "Public default, sovereign room, and managed workspace relay tiers.",
        keywords: ["community mode", "sovereign", "managed workspace", "public default"],
    },
    {
        id: "tab-storage",
        tab: "storage",
        title: "Storage",
        description: "Local media path, cache, backups, and storage health.",
        keywords: ["storage", "media", "cache", "backup", "disk", "vault"],
    },
    {
        id: "storage-backup",
        tab: "profile",
        elementId: "account-sync-backup",
        title: "Encrypted account backup",
        description: "Export and restore encrypted account snapshots.",
        keywords: ["backup", "restore", "export", "import", "account sync"],
    },
    {
        id: "storage-health",
        tab: "storage",
        elementId: "storage-health",
        title: "Storage health",
        description: "IndexedDB health checks and recovery.",
        keywords: ["storage health", "indexeddb", "recovery", "repair"],
    },
    {
        id: "tab-blocklist",
        tab: "blocklist",
        title: "Blocklist",
        description: "Blocked pubkeys and trust boundaries.",
        keywords: ["blocklist", "block", "mute", "trust"],
    },
    {
        id: "tab-privacy",
        tab: "privacy",
        title: "Privacy",
        description: "Discovery, metadata, and messaging privacy controls.",
        keywords: ["privacy", "discovery", "metadata", "dm", "trust settings"],
    },
    {
        id: "privacy-trust",
        tab: "privacy",
        elementId: "privacy-trust-settings",
        title: "Trust settings",
        description: "Connection trust and DM policy.",
        keywords: ["trust", "connections", "dm policy"],
    },
    {
        id: "tab-updates",
        tab: "updates",
        title: "Updates",
        description: "Desktop app updates and version info.",
        keywords: ["updates", "version", "desktop updater"],
    },
];

const normalizeSearchText = (value: string): string => (
    value.trim().toLowerCase().replace(/\s+/g, " ")
);

export const filterSettingsSearchEntries = (
    query: string,
    entries: readonly SettingsSearchEntry[] = SETTINGS_SEARCH_INDEX,
): ReadonlyArray<SettingsSearchEntry> => {
    const normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery.length === 0) {
        return [];
    }
    const tokens = normalizedQuery.split(" ").filter(Boolean);
    return entries.filter((entry) => {
        const haystack = normalizeSearchText([
            entry.title,
            entry.description,
            entry.tab,
            ...entry.keywords,
        ].join(" "));
        return tokens.every((token) => haystack.includes(token));
    });
};
