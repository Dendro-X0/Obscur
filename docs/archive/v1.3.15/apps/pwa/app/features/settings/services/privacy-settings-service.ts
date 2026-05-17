import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { normalizeV090Flags } from "./v090-rollout-policy";

export interface PrivacySettings {
    encryptStorageAtRest: boolean;
    clearClipboardOnLock: boolean;
    enableTorProxy: boolean;
    torProxyUrl: string; // e.g. socks5h://127.0.0.1:9050
    autoLockTimeout: number; // minutes
    useModernDMs: boolean; // NIP-17 Gift Wraps
    dmPrivacy: 'everyone' | 'contacts-only';
    biometricLockEnabled: boolean;
    chatPerformanceV2: boolean; // Feature flag for batched chat performance optimizations
    chatUxV083: boolean; // Feature flag for v0.8.3 media/chat UX refresh
    reliabilityCoreV087: boolean; // Feature flag for v0.8.7 relay/sync/storage reliability core
    stabilityModeV090: boolean; // Feature flag for v0.9 recovery safe path UX
    deterministicDiscoveryV090: boolean; // Feature flag for v0.9 deterministic resolver + request outbox
    protocolCoreRustV090: boolean; // Feature flag for v0.9 Rust protocol core adapter path
    x3dhRatchetV090: boolean; // Feature flag for v0.9 X3DH + ratchet protocol path
    accountSyncConvergenceV091?: boolean; // Guarded flag for cross-device contact/message convergence fast-follow
    discoveryInviteCodeV1?: boolean; // Phase-0 flag: invite-code-based discovery path
    discoveryDeepLinkV1?: boolean; // Phase-0 flag: deep-link add-contact discovery path
    discoverySuggestionsV1?: boolean; // Phase-0 flag: friend suggestions discovery path
    tanstackQueryV1?: boolean; // Phase-1 flag: TanStack Query adapter lane
    attackModeSafetyProfileV121?: "standard" | "strict"; // Phase-M10 flag: local-first anti-abuse safety profile
    localMessageRetentionDays?: 0 | 30 | 90; // Local-only chat history window shown in UI
    showPublicKeyControlsInChat?: boolean; // Allow Share ID/public-key controls in chat header
}

export const defaultPrivacySettings: PrivacySettings = {
    encryptStorageAtRest: true,
    clearClipboardOnLock: true,
    enableTorProxy: false,
    torProxyUrl: "socks5h://127.0.0.1:9050",
    autoLockTimeout: 0,
    useModernDMs: false,
    dmPrivacy: 'everyone',
    biometricLockEnabled: false,
    chatPerformanceV2: false,
    chatUxV083: false,
    reliabilityCoreV087: true,
    stabilityModeV090: true,
    deterministicDiscoveryV090: false,
    protocolCoreRustV090: false,
    x3dhRatchetV090: false,
    accountSyncConvergenceV091: false,
    discoveryInviteCodeV1: false,
    discoveryDeepLinkV1: true,
    discoverySuggestionsV1: true,
    tanstackQueryV1: false,
    attackModeSafetyProfileV121: "standard",
    localMessageRetentionDays: 0,
    showPublicKeyControlsInChat: false,
};

export type DiscoveryFeatureFlags = Readonly<{
    inviteCodeV1: boolean;
    deepLinkV1: boolean;
    suggestionsV1: boolean;
}>;

export class PrivacySettingsService {
    private static STORAGE_KEY = "obscur.settings.privacy";

    private static scopedStorageKey(): string {
        return getScopedStorageKey(this.STORAGE_KEY);
    }

    private static normalizeTorProxyUrl(proxyUrl: string | undefined): string {
        if (!proxyUrl || proxyUrl === "socks5://127.0.0.1:9050") {
            return defaultPrivacySettings.torProxyUrl;
        }
        return proxyUrl;
    }

    static getSettings(): PrivacySettings {
        if (typeof window === "undefined") return defaultPrivacySettings;
        const stored = localStorage.getItem(this.scopedStorageKey());
        if (!stored) return normalizeV090Flags(defaultPrivacySettings);
        try {
            const parsed = JSON.parse(stored) as Partial<PrivacySettings>;
            return normalizeV090Flags({
                ...defaultPrivacySettings,
                ...parsed,
                torProxyUrl: this.normalizeTorProxyUrl(parsed.torProxyUrl),
            });
        } catch {
            return normalizeV090Flags(defaultPrivacySettings);
        }
    }

    static saveSettings(settings: PrivacySettings): void {
        if (typeof window === "undefined") return;
        const normalized = normalizeV090Flags({
            ...settings,
            torProxyUrl: this.normalizeTorProxyUrl(settings.torProxyUrl),
        });
        localStorage.setItem(this.scopedStorageKey(), JSON.stringify(normalized));

        // Dispatch event for components to react
        window.dispatchEvent(new Event("privacy-settings-changed"));
    }

    static getDiscoveryFeatureFlags(settingsOverride?: PrivacySettings): DiscoveryFeatureFlags {
        const settings = settingsOverride ?? this.getSettings();
        return {
            inviteCodeV1: settings.discoveryInviteCodeV1 === true,
            deepLinkV1: settings.discoveryDeepLinkV1 === true,
            suggestionsV1: settings.discoverySuggestionsV1 === true,
        };
    }
}
