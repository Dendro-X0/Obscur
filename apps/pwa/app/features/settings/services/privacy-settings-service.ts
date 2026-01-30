export interface PrivacySettings {
    encryptStorageAtRest: boolean;
    clearClipboardOnLock: boolean;
    enableTorProxy: boolean;
    torProxyUrl: string; // e.g. socks5://127.0.0.1:9050
    autoLockTimeout: number; // minutes
    useModernDMs: boolean; // NIP-17 Gift Wraps
}

export const defaultPrivacySettings: PrivacySettings = {
    encryptStorageAtRest: true,
    clearClipboardOnLock: true,
    enableTorProxy: false,
    torProxyUrl: "socks5://127.0.0.1:9050",
    autoLockTimeout: 15,
    useModernDMs: true
};

export class PrivacySettingsService {
    private static STORAGE_KEY = "obscur.settings.privacy";

    static getSettings(): PrivacySettings {
        if (typeof window === "undefined") return defaultPrivacySettings;
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return defaultPrivacySettings;
        try {
            return { ...defaultPrivacySettings, ...JSON.parse(stored) };
        } catch {
            return defaultPrivacySettings;
        }
    }

    static saveSettings(settings: PrivacySettings): void {
        if (typeof window === "undefined") return;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));

        // Dispatch event for components to react
        window.dispatchEvent(new Event("privacy-settings-changed"));
    }
}
