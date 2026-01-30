import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Shield, Lock, HardDrive, Clipboard, Globe } from 'lucide-react';
import { useAutoLock } from '../hooks/use-auto-lock';
import { Label } from '../../../components/ui/label';
import { cn } from '../../../lib/cn';

/**
 * Premium Privacy & Safety Settings Panel
 * Requirement 1.3: Tor support
 * Requirement 1.4: Clipboard safety & session management
 */
export const AutoLockSettingsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useAutoLock();

    const timeoutOptions = [
        { label: '1m', value: 1 },
        { label: '5m', value: 5 },
        { label: '15m', value: 15 },
        { label: '30m', value: 30 },
        { label: '1h', value: 60 },
        { label: 'Never', value: 0 },
    ];

    const tauriWindow: (Window & Readonly<{ __TAURI_INTERNALS__?: unknown }>) | null = typeof window !== "undefined" ? window : null;
    const isTauri: boolean = tauriWindow?.__TAURI_INTERNALS__ !== undefined;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 rounded-2xl bg-black/5 border border-black/10 dark:bg-white/5 dark:border-white/10 shadow-xl shadow-emerald-500/10 transition-colors">
                    <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">{t("settings.security.title")}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{t("settings.security.desc")}</p>
                </div>
            </div>

            {/* At-Rest Encryption */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/40 border border-black/5 dark:border-white/5 backdrop-blur-xl transition-all duration-300 hover:border-black/10 dark:hover:border-white/10 group shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:scale-110 transition-transform">
                            <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-base text-zinc-900 dark:text-white font-bold tracking-tight">{t("settings.security.encryption.title")}</Label>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-[240px] leading-relaxed font-medium">{t("settings.security.encryption.desc")}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => updateSettings({ encryptStorageAtRest: !settings.encryptStorageAtRest })}
                        className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none",
                            settings.encryptStorageAtRest ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'
                        )}
                    >
                        <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                            settings.encryptStorageAtRest ? 'translate-x-[22px]' : 'translate-x-1'
                        )} />
                    </button>
                </div>
            </div>

            {/* Inactivity Lock */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/40 border border-black/5 dark:border-white/5 backdrop-blur-xl space-y-6 transition-all duration-300 hover:border-black/10 dark:hover:border-white/10 group shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-base text-zinc-900 dark:text-white font-bold tracking-tight">{t("settings.security.autoLock.title")}</Label>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-[240px] leading-relaxed font-medium">{t("settings.security.autoLock.desc")}</p>
                        </div>
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 tracking-wider">
                        {settings.autoLockTimeout > 0 ? `${settings.autoLockTimeout}m` : 'Disabled'}
                    </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {timeoutOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => updateSettings({ autoLockTimeout: option.value })}
                            className={cn(
                                "px-2 py-2.5 rounded-xl text-[11px] font-black transition-all border",
                                settings.autoLockTimeout === option.value
                                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white shadow-lg scale-[1.02]'
                                    : 'bg-zinc-50 text-zinc-500 border-black/5 dark:bg-white/5 dark:text-zinc-400 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/10'
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Clipboard Safety */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/40 border border-black/5 dark:border-white/5 backdrop-blur-xl transition-all duration-300 hover:border-black/10 dark:hover:border-white/10 group shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 group-hover:scale-110 transition-transform">
                            <Clipboard className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-base text-zinc-900 dark:text-white font-bold tracking-tight">{t("settings.security.clipboard.title")}</Label>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-[240px] leading-relaxed font-medium">{t("settings.security.clipboard.desc")}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => updateSettings({ clearClipboardOnLock: !settings.clearClipboardOnLock })}
                        className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none",
                            settings.clearClipboardOnLock ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'
                        )}
                    >
                        <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                            settings.clearClipboardOnLock ? 'translate-x-[22px]' : 'translate-x-1'
                        )} />
                    </button>
                </div>
            </div>

            {/* Network Privacy (Tor) */}
            <div className={cn(
                "p-6 rounded-3xl border backdrop-blur-xl transition-all duration-300 shadow-sm",
                isTauri
                    ? "bg-white dark:bg-zinc-900/40 border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 group"
                    : "bg-zinc-50 dark:bg-zinc-900/20 border-black/5 dark:border-white/5 opacity-50 grayscale"
            )}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 group-hover:scale-110 transition-transform">
                            <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-base text-zinc-900 dark:text-white font-bold tracking-tight">{t("settings.security.tor.title")}</Label>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-[240px] leading-relaxed font-medium">{t("settings.security.tor.desc")}</p>
                        </div>
                    </div>
                    {isTauri ? (
                        <button
                            onClick={() => updateSettings({ enableTorProxy: !settings.enableTorProxy })}
                            className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none",
                                settings.enableTorProxy ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'
                            )}
                        >
                            <span className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                                settings.enableTorProxy ? 'translate-x-[22px]' : 'translate-x-1'
                            )} />
                        </button>
                    ) : (
                        <div className="text-[10px] font-black text-zinc-500 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-black/5 dark:border-white/5 uppercase tracking-widest">
                            Tauri Only
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 rounded-[32px] bg-emerald-500/5 dark:bg-emerald-400/5 border border-emerald-500/10 dark:border-emerald-400/10 space-y-4 shadow-inner">
                <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">{t("settings.security.zeroKnowledge.title")}</h4>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed font-medium">
                    {t("settings.security.zeroKnowledge.desc")}
                </p>
            </div>
        </div>
    );
};
