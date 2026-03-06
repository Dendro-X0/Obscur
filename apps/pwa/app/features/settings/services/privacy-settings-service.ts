import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

export interface PrivacySettings {
    encryptStorageAtRest: boolean;
    clearClipboardOnLock: boolean;
    enableTorProxy: boolean;
    torProxyUrl: string; // e.g. socks5://127.0.0.1:9050
    autoLockTimeout: number; // minutes
    useModernDMs: boolean; // NIP-17 Gift Wraps
    dmPrivacy: 'everyone' | 'contacts-only';
    biometricLockEnabled: boolean;
    chatPerformanceV2: boolean; // Feature flag for batched chat performance optimizations
    chatUxV083: boolean; // Feature flag for v0.8.3 media/chat UX refresh
    reliabilityCoreV087: boolean; // Feature flag for v0.8.7 relay/sync/storage reliability core
}

export const defaultPrivacySettings: PrivacySettings = {
    encryptStorageAtRest: true,
    clearClipboardOnLock: true,
    enableTorProxy: false,
    torProxyUrl: "socks5://127.0.0.1:9050",
    autoLockTimeout: 0,
    useModernDMs: true,
    dmPrivacy: 'everyone',
    biometricLockEnabled: false,
    chatPerformanceV2: false,
    chatUxV083: false,
    reliabilityCoreV087: true
};

export class PrivacySettingsService {
    private static STORAGE_KEY = "obscur.settings.privacy";

    private static scopedStorageKey(): string {
        return getScopedStorageKey(this.STORAGE_KEY);
    }

    static getSettings(): PrivacySettings {
        if (typeof window === "undefined") return defaultPrivacySettings;
        const stored = localStorage.getItem(this.scopedStorageKey());
        if (!stored) return defaultPrivacySettings;
        try {
            return { ...defaultPrivacySettings, ...JSON.parse(stored) };
        } catch {
            return defaultPrivacySettings;
        }
    }

    static saveSettings(settings: PrivacySettings): void {
        if (typeof window === "undefined") return;
        localStorage.setItem(this.scopedStorageKey(), JSON.stringify(settings));

        // Dispatch event for components to react
        window.dispatchEvent(new Event("privacy-settings-changed"));
    }
}
