export type SettingsTabId =
    | "profile"
    | "identity"
    | "relays"
    | "protocols"
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
        elementId: "security-auto-lock",
        title: "Auto-lock",
        description: "Lock the app after inactivity.",
        keywords: ["auto lock", "timeout", "idle", "lock screen"],
    },
    {
        id: "security-tor",
        tab: "security",
        elementId: "security-tor-settings",
        title: "Tor network privacy",
        description: "Enable the Tor sidecar, bootstrap status, proxy URL, and network privacy routing.",
        keywords: [
            "tor",
            "onion",
            "socks",
            "socks5",
            "proxy",
            "bootstrap",
            "gateway",
            "privacy routed",
            "network privacy",
            "anonymity",
        ],
    },
    {
        id: "tab-protocols",
        tab: "protocols",
        elementId: "protocols-selectors",
        title: "Protocols/Network",
        description: "Select messaging protocol (Nostr or Matrix) and network path (Clearnet, Tor, Quiet).",
        keywords: [
            "protocols",
            "protocol",
            "matrix",
            "homeserver",
            "access token",
            "nostr",
            "transport",
            "clearnet",
            "tor",
            "quiet",
            "adaptation",
            "network path",
        ],
    },
    {
        id: "tab-relays",
        tab: "relays",
        title: "Relay connections",
        description: "Manage Nostr/mesh relay URLs, transport packs, health, and publish readiness. For Matrix, use Protocols.",
        keywords: ["relays", "nostr", "relay", "wss", "nos.lol", "fiatjaf", "connectivity", "transport packs"],
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
        elementId: "relay-advanced-settings",
        title: "Relay advanced settings",
        description: "Operator mode: offline packs, conduit mesh, community modes, metrics, bulk actions, per-node list.",
        keywords: ["advanced", "primary relay", "redundancy", "preset", "bulk", "standard", "operator"],
    },
    {
        id: "relay-performance",
        tab: "relays",
        elementId: "relay-performance-metrics",
        title: "Network performance metrics",
        description: "Advanced: per-relay Connect/RTT history and node health (open Advanced settings first).",
        keywords: ["latency", "rtt", "connect", "performance", "metrics", "quiet", "dashboard"],
    },
    {
        id: "relay-conduit-mesh",
        tab: "relays",
        elementId: "conduit-mesh-settings",
        title: "Conduit transport",
        description: "Advanced: mesh pool owner, Tor-ready badge for conduits, and configured ciphertext endpoints.",
        keywords: ["conduit", "mesh", "transport", "dialect", "tor ready", "tor not ready"],
    },
    {
        id: "relay-community-modes",
        tab: "relays",
        elementId: "relay-community-modes",
        title: "Community modes",
        description: "Advanced: public default, sovereign room, and managed workspace relay tiers.",
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

/** Whole-token match — avoids "tor" matching inside "operator" or "history". */
export const settingsSearchTokenMatchesField = (token: string, field: string): boolean => {
    const normalizedToken = normalizeSearchText(token);
    const normalizedField = normalizeSearchText(field);
    if (normalizedToken.length === 0 || normalizedField.length === 0) {
        return false;
    }
    const escaped = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(` ${normalizedField} `);
};

const entrySearchFields = (entry: SettingsSearchEntry): ReadonlyArray<string> => [
    entry.title,
    entry.description,
    entry.tab,
    ...entry.keywords,
];

const entryMatchesAllTokens = (
    entry: SettingsSearchEntry,
    tokens: ReadonlyArray<string>,
): boolean => (
    tokens.every((token) => entrySearchFields(entry).some((field) => (
        settingsSearchTokenMatchesField(token, field)
    )))
);

const scoreSettingsSearchEntry = (
    entry: SettingsSearchEntry,
    tokens: ReadonlyArray<string>,
): number => {
    let score = 0;
    for (const token of tokens) {
        if (settingsSearchTokenMatchesField(token, entry.title)) {
            score += 100;
        }
        for (const keyword of entry.keywords) {
            if (settingsSearchTokenMatchesField(token, keyword)) {
                score += 50;
            }
        }
        if (settingsSearchTokenMatchesField(token, entry.description)) {
            score += 10;
        }
        if (settingsSearchTokenMatchesField(token, entry.tab)) {
            score += 5;
        }
    }
    if (entry.elementId) {
        score += 1;
    }
    return score;
};

export const filterSettingsSearchEntries = (
    query: string,
    entries: readonly SettingsSearchEntry[] = SETTINGS_SEARCH_INDEX,
): ReadonlyArray<SettingsSearchEntry> => {
    const normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery.length === 0) {
        return [];
    }
    const tokens = normalizedQuery.split(" ").filter(Boolean);
    return entries
        .filter((entry) => entryMatchesAllTokens(entry, tokens))
        .slice()
        .sort((left, right) => (
            scoreSettingsSearchEntry(right, tokens) - scoreSettingsSearchEntry(left, tokens)
            || left.title.localeCompare(right.title)
        ));
};
