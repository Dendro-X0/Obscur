import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Shield, Lock, HardDrive, Clipboard, Globe, AlertTriangle } from 'lucide-react';
import { useAutoLock } from '../hooks/use-auto-lock';
import type { PrivacySettings } from '../services/privacy-settings-service';
import {
    getSignedSharedIntelSignals,
    setSignedSharedIntelSignals,
    ingestSignedSharedIntelSignals,
    setAttackModeSafetyProfile,
    clearSignedSharedIntelSignals,
    type AttackModeSafetyProfile,
    type SignedSharedIntelSignal,
} from "@/app/features/messaging/services/m10-shared-intel-policy";
import { logAppEvent } from "@/app/shared/log-app-event";
import { Label } from '../../../components/ui/label';
import { cn } from '../../../lib/cn';
import { SettingsActionStatus, type SettingsActionPhase } from './settings-action-status';
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";

type SharedIntelSnapshot = Readonly<{
    signalCount: number;
    activeCount: number;
    expiredCount: number;
    blockDispositionCount: number;
    watchDispositionCount: number;
}>;

const buildSharedIntelSnapshot = (): SharedIntelSnapshot => {
    const nowUnixMs = Date.now();
    const signals = getSignedSharedIntelSignals();
    const activeCount = signals.filter((signal) => signal.expiresAtUnixMs > nowUnixMs).length;
    const expiredCount = signals.length - activeCount;
    const blockDispositionCount = signals.filter((signal) => signal.disposition === "block").length;
    return {
        signalCount: signals.length,
        activeCount,
        expiredCount,
        blockDispositionCount,
        watchDispositionCount: signals.length - blockDispositionCount,
    };
};

const hasSignalStateChanged = (
    previous: ReadonlyArray<SignedSharedIntelSignal>,
    next: ReadonlyArray<SignedSharedIntelSignal>,
): boolean => {
    if (previous.length !== next.length) {
        return true;
    }
    return previous.some((signal, index) => {
        const peer = next[index];
        return !peer
            || signal.signalId !== peer.signalId
            || signal.issuedAtUnixMs !== peer.issuedAtUnixMs
            || signal.expiresAtUnixMs !== peer.expiresAtUnixMs
            || signal.signatureHex !== peer.signatureHex;
    });
};

/**
 * Premium Privacy & Safety Settings Panel
 * Requirement 1.3: Tor support
 * Requirement 1.4: Clipboard safety & session management
 */
export const AutoLockSettingsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateSettings, torStatus, torStatusSnapshot, torLogs, torRestartRequired } = useAutoLock();
    const [showLogs, setShowLogs] = React.useState(false);
    const [actionPhase, setActionPhase] = React.useState<SettingsActionPhase>("idle");
    const [actionMessage, setActionMessage] = React.useState<string>("");
    const [sharedIntelJson, setSharedIntelJson] = React.useState<string>("");
    const [requireSignatureVerification, setRequireSignatureVerification] = React.useState<boolean>(true);
    const [replaceExistingSharedIntelSignals, setReplaceExistingSharedIntelSignals] = React.useState<boolean>(false);
    const [sharedIntelResultMessage, setSharedIntelResultMessage] = React.useState<string>("");
    const [sharedIntelSnapshot, setSharedIntelSnapshot] = React.useState<SharedIntelSnapshot>(() => buildSharedIntelSnapshot());
    const [rollbackSignals, setRollbackSignals] = React.useState<ReadonlyArray<SignedSharedIntelSignal> | null>(null);
    const [rollbackReasonLabel, setRollbackReasonLabel] = React.useState<string | null>(null);

    const isTauri: boolean = getRuntimeCapabilities().isNativeRuntime;

    const handleRestart = () => {
        if (isTauri) {
            void invokeNativeCommand("restart_app");
        }
    };

    const timeoutOptions = [
        { label: '1m', value: 1 },
        { label: '5m', value: 5 },
        { label: '15m', value: 15 },
        { label: '30m', value: 30 },
        { label: '1h', value: 60 },
        { label: t('common.never'), value: 0 },
    ];

    const setActionFeedback = (phase: SettingsActionPhase, messageKey: string, fallback: string): void => {
        setActionPhase(phase);
        setActionMessage(t(messageKey, fallback));
    };

    const applySetting = (partial: Partial<PrivacySettings>, message: string): void => {
        setActionFeedback("working", "settings.security.action.applying", "Applying security setting...");
        updateSettings(partial);
        setActionPhase("success");
        setActionMessage(message);
    };

    const attackModeSafetyProfile: AttackModeSafetyProfile = (
        settings.attackModeSafetyProfileV121 === "strict" ? "strict" : "standard"
    );

    const refreshSharedIntelSnapshot = (): void => {
        setSharedIntelSnapshot(buildSharedIntelSnapshot());
    };

    const setAttackModeProfile = (profile: AttackModeSafetyProfile): void => {
        if (profile === attackModeSafetyProfile) {
            return;
        }
        setActionFeedback("working", "settings.security.attackMode.applying", "Applying attack-mode profile...");
        setAttackModeSafetyProfile(profile);
        setActionFeedback(
            "success",
            profile === "strict"
                ? "settings.security.attackMode.profile.strictEnabled"
                : "settings.security.attackMode.profile.standardEnabled",
            profile === "strict"
                ? "Strict attack-mode profile enabled."
                : "Standard attack-mode profile enabled."
        );
        logAppEvent({
            name: "messaging.m10.trust_controls_profile_changed",
            level: "info",
            scope: { feature: "messaging", action: "m10_trust_controls" },
            context: {
                profile,
            },
        });
    };

    const parseSharedIntelSignalsJson = (rawJson: string): ReadonlyArray<unknown> => {
        const parsed = JSON.parse(rawJson) as unknown;
        if (Array.isArray(parsed)) {
            return parsed;
        }
        if (parsed && typeof parsed === "object" && Array.isArray((parsed as { signals?: unknown }).signals)) {
            return (parsed as { signals: unknown[] }).signals;
        }
        return [parsed];
    };

    const handleImportSharedIntelJson = (): void => {
        if (!sharedIntelJson.trim()) {
            setSharedIntelResultMessage(t(
                "settings.security.attackMode.import.pasteBeforeImport",
                "Paste signed shared-intel JSON before importing."
            ));
            return;
        }
        try {
            const previousSignals = getSignedSharedIntelSignals();
            const signals = parseSharedIntelSignalsJson(sharedIntelJson);
            const result = ingestSignedSharedIntelSignals({
                signals,
                replaceExisting: replaceExistingSharedIntelSignals,
                requireSignatureVerification,
            });
            const nextSignals = getSignedSharedIntelSignals();
            if (hasSignalStateChanged(previousSignals, nextSignals)) {
                setRollbackSignals([...previousSignals]);
                setRollbackReasonLabel("import");
            }
            refreshSharedIntelSnapshot();
            setSharedIntelResultMessage(t(
                "settings.security.attackMode.import.result",
                "Imported signals: accepted {{acceptedCount}}, rejected {{rejectedCount}}, stored {{storedSignalCount}}. Rejections: invalid_shape={{invalidShapeRejectedCount}}, expired={{expiredRejectedCount}}, missing_signature_verifier={{missingSignatureVerifierRejectedCount}}, invalid_signature={{invalidSignatureRejectedCount}}.",
                {
                    acceptedCount: result.acceptedCount,
                    rejectedCount: result.rejectedCount,
                    storedSignalCount: result.storedSignalCount,
                    invalidShapeRejectedCount: result.rejectedByReason.invalid_shape,
                    expiredRejectedCount: result.rejectedByReason.expired,
                    missingSignatureVerifierRejectedCount: result.rejectedByReason.missing_signature_verifier,
                    invalidSignatureRejectedCount: result.rejectedByReason.invalid_signature,
                }
            ));
            if (result.acceptedCount > 0) {
                setActionFeedback("success", "settings.security.attackMode.import.success", "Shared-intel signals imported.");
            }
            logAppEvent({
                name: "messaging.m10.trust_controls_import_result",
                level: "info",
                scope: { feature: "messaging", action: "m10_trust_controls" },
                context: {
                    acceptedCount: result.acceptedCount,
                    rejectedCount: result.rejectedCount,
                    storedSignalCount: result.storedSignalCount,
                    replaceExisting: replaceExistingSharedIntelSignals,
                    requireSignatureVerification,
                    invalidShapeRejectedCount: result.rejectedByReason.invalid_shape,
                    expiredRejectedCount: result.rejectedByReason.expired,
                    missingSignatureVerifierRejectedCount: result.rejectedByReason.missing_signature_verifier,
                    invalidSignatureRejectedCount: result.rejectedByReason.invalid_signature,
                },
            });
        } catch {
            setSharedIntelResultMessage(t(
                "settings.security.attackMode.import.invalidJson",
                "Shared-intel import failed: invalid JSON payload."
            ));
            logAppEvent({
                name: "messaging.m10.trust_controls_import_result",
                level: "warn",
                scope: { feature: "messaging", action: "m10_trust_controls" },
                context: {
                    reasonCode: "invalid_json",
                },
            });
        }
    };

    const handleExportSharedIntelJson = (): void => {
        const signals = getSignedSharedIntelSignals();
        const payload = JSON.stringify(signals, null, 2);
        setSharedIntelJson(payload);
        setSharedIntelResultMessage(t(
            "settings.security.attackMode.export.result",
            "Exported {{count}} shared-intel signals to editor.",
            { count: signals.length }
        ));
    };

    const handleClearSharedIntelSignals = (): void => {
        const previousSignals = getSignedSharedIntelSignals();
        if (previousSignals.length > 0) {
            setRollbackSignals([...previousSignals]);
            setRollbackReasonLabel("clear");
        }
        clearSignedSharedIntelSignals();
        refreshSharedIntelSnapshot();
        setSharedIntelResultMessage(t(
            "settings.security.attackMode.clear.result",
            "Cleared all persisted shared-intel signals for this profile."
        ));
        setActionFeedback("success", "settings.security.attackMode.clear.success", "Shared-intel signal store cleared.");
        logAppEvent({
            name: "messaging.m10.trust_controls_clear_applied",
            level: "info",
            scope: { feature: "messaging", action: "m10_trust_controls" },
            context: {
                previousSignalCount: previousSignals.length,
            },
        });
    };

    const handleUndoSharedIntelChange = (): void => {
        if (!rollbackSignals) {
            setSharedIntelResultMessage(t(
                "settings.security.attackMode.undo.none",
                "No reversible trust-control change is available."
            ));
            return;
        }
        setSignedSharedIntelSignals(rollbackSignals);
        refreshSharedIntelSnapshot();
        setRollbackSignals(null);
        setRollbackReasonLabel(null);
        setSharedIntelResultMessage(t(
            "settings.security.attackMode.undo.result",
            "Reverted the latest shared-intel trust-control change."
        ));
        setActionFeedback("success", "settings.security.attackMode.undo.success", "Trust-control change reverted.");
        logAppEvent({
            name: "messaging.m10.trust_controls_undo_applied",
            level: "info",
            scope: { feature: "messaging", action: "m10_trust_controls" },
            context: {
                restoredSignalCount: rollbackSignals.length,
            },
        });
    };

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

            {/* Attack Mode Trust Controls (M10) */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/40 border border-black/5 dark:border-white/5 backdrop-blur-xl transition-all duration-300 hover:border-black/10 dark:hover:border-white/10 group shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 group-hover:scale-110 transition-transform">
                            <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-base text-zinc-900 dark:text-white font-bold tracking-tight">
                                {t("settings.security.attackMode.title", "Attack Mode Trust Controls")}
                            </Label>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-[560px] leading-relaxed font-medium">
                                {t(
                                    "settings.security.attackMode.desc",
                                    "Strict mode quarantines high-risk requests using relay/peer shared-intel evidence. Standard mode keeps requests open with diagnostics."
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setAttackModeProfile("standard")}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[11px] font-black border transition-colors",
                                attackModeSafetyProfile === "standard"
                                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white"
                                    : "bg-zinc-50 text-zinc-600 border-black/10 dark:bg-white/5 dark:text-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10"
                            )}
                            aria-label={t("settings.security.attackMode.profile.standardAria", "Set attack mode profile to standard")}
                        >
                            {t("settings.security.attackMode.profile.standard", "Standard")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setAttackModeProfile("strict")}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[11px] font-black border transition-colors",
                                attackModeSafetyProfile === "strict"
                                    ? "bg-rose-600 text-white border-rose-600"
                                    : "bg-zinc-50 text-zinc-600 border-black/10 dark:bg-white/5 dark:text-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10"
                            )}
                            aria-label={t("settings.security.attackMode.profile.strictAria", "Set attack mode profile to strict")}
                        >
                            {t("settings.security.attackMode.profile.strict", "Strict")}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                        <input
                            type="checkbox"
                            checked={requireSignatureVerification}
                            onChange={(event) => setRequireSignatureVerification(event.currentTarget.checked)}
                        />
                        {t("settings.security.attackMode.requireSignatureVerification", "Require signature verification")}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 sm:justify-end">
                        <input
                            type="checkbox"
                            checked={replaceExistingSharedIntelSignals}
                            onChange={(event) => setReplaceExistingSharedIntelSignals(event.currentTarget.checked)}
                        />
                        {t("settings.security.attackMode.replaceExisting", "Replace existing stored signals")}
                    </label>
                </div>

                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-950/40 px-3 py-2.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div>
                            <div className="font-black uppercase tracking-wider text-[10px] text-zinc-500 dark:text-zinc-400">{t("settings.security.attackMode.summary.profile", "Profile")}</div>
                            <div>{attackModeSafetyProfile}</div>
                        </div>
                        <div>
                            <div className="font-black uppercase tracking-wider text-[10px] text-zinc-500 dark:text-zinc-400">{t("settings.security.attackMode.summary.signals", "Signals")}</div>
                            <div>{sharedIntelSnapshot.signalCount}</div>
                        </div>
                        <div>
                            <div className="font-black uppercase tracking-wider text-[10px] text-zinc-500 dark:text-zinc-400">{t("settings.security.attackMode.summary.active", "Active")}</div>
                            <div>{sharedIntelSnapshot.activeCount}</div>
                        </div>
                        <div>
                            <div className="font-black uppercase tracking-wider text-[10px] text-zinc-500 dark:text-zinc-400">{t("settings.security.attackMode.summary.block", "Block")}</div>
                            <div>{sharedIntelSnapshot.blockDispositionCount}</div>
                        </div>
                        <div>
                            <div className="font-black uppercase tracking-wider text-[10px] text-zinc-500 dark:text-zinc-400">{t("settings.security.attackMode.summary.watch", "Watch")}</div>
                            <div>{sharedIntelSnapshot.watchDispositionCount}</div>
                        </div>
                    </div>
                </div>

                <textarea
                    value={sharedIntelJson}
                    onChange={(event) => setSharedIntelJson(event.currentTarget.value)}
                    className="w-full h-40 rounded-2xl border border-black/10 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-950/70 p-3 text-xs font-mono text-zinc-700 dark:text-zinc-200 resize-y focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                    placeholder={t("settings.security.attackMode.placeholder", 'Paste signed shared-intel JSON (array or {"signals":[...]})')}
                    aria-label={t("settings.security.attackMode.aria.jsonPayload", "Shared intel JSON payload")}
                />

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleImportSharedIntelJson}
                        className="px-3 py-2 rounded-lg bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider hover:bg-rose-700 transition-colors"
                    >
                        {t("settings.security.attackMode.import.button", "Import JSON")}
                    </button>
                    <button
                        type="button"
                        onClick={handleExportSharedIntelJson}
                        className="px-3 py-2 rounded-lg bg-zinc-200 text-zinc-900 text-[11px] font-black uppercase tracking-wider hover:bg-zinc-300 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/15 transition-colors"
                    >
                        {t("settings.security.attackMode.export.button", "Export JSON")}
                    </button>
                    <button
                        type="button"
                        onClick={handleClearSharedIntelSignals}
                        className="px-3 py-2 rounded-lg bg-zinc-100 text-zinc-700 text-[11px] font-black uppercase tracking-wider hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 transition-colors"
                    >
                        {t("settings.security.attackMode.clear.button", "Clear Signals")}
                    </button>
                    <button
                        type="button"
                        onClick={handleUndoSharedIntelChange}
                        disabled={!rollbackSignals}
                        className={cn(
                            "px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors",
                            rollbackSignals
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-zinc-200/80 text-zinc-400 cursor-not-allowed dark:bg-white/5 dark:text-zinc-500"
                        )}
                    >
                        {t("settings.security.attackMode.undo.button", "Undo Last Change")}
                    </button>
                </div>

                {sharedIntelResultMessage ? (
                    <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">{sharedIntelResultMessage}</p>
                ) : null}
                {rollbackReasonLabel ? (
                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {t("settings.security.attackMode.undo.available", "Undo is available for the latest {{reason}} operation.", {
                            reason: rollbackReasonLabel,
                        })}
                    </p>
                ) : null}
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
                        onClick={() => applySetting(
                            { encryptStorageAtRest: !settings.encryptStorageAtRest },
                            settings.encryptStorageAtRest
                                ? t("settings.security.encryption.disabled", "At-rest encryption disabled.")
                                : t("settings.security.encryption.enabled", "At-rest encryption enabled.")
                        )}
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
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {settings.autoLockTimeout > 0
                                    ? t("settings.security.autoLock.statusMinutes", "Locks after {{count}} minute of inactivity.", {
                                        count: settings.autoLockTimeout,
                                    })
                                    : t("settings.security.autoLock.disabled", "Auto-lock is disabled.")}
                            </p>
                        </div>
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 tracking-wider">
                        {settings.autoLockTimeout > 0 ? `${settings.autoLockTimeout}m` : t('common.disabled')}
                    </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {timeoutOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => applySetting(
                                { autoLockTimeout: option.value },
                                option.value > 0
                                    ? t("settings.security.autoLock.updated", "Auto-lock set to {{label}}.", { label: option.label })
                                    : t("settings.security.autoLock.disabled", "Auto-lock is disabled.")
                            )}
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
                        onClick={() => applySetting(
                            { clearClipboardOnLock: !settings.clearClipboardOnLock },
                            settings.clearClipboardOnLock
                                ? t("settings.security.clipboard.disabled", "Clipboard safety disabled.")
                                : t("settings.security.clipboard.enabled", "Clipboard safety enabled.")
                        )}
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

            {/* Biometric Lock (Mobile/Desktop) */}
            <div className={cn(
                "p-6 rounded-3xl border backdrop-blur-xl transition-all duration-300 shadow-sm",
                isTauri
                    ? "bg-white dark:bg-zinc-900/40 border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 group"
                    : "bg-zinc-50 dark:bg-zinc-900/20 border-black/5 dark:border-white/10 opacity-50 grayscale"
            )}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                            <Shield className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-base text-zinc-900 dark:text-white font-bold tracking-tight">{t("settings.security.biometric.title", "Biometric Lock")}</Label>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-[240px] leading-relaxed font-medium">{t("settings.security.biometric.desc", "Use fingerprint or face ID to unlock the app.")}</p>
                        </div>
                    </div>
                    {isTauri ? (
                        <button
                            onClick={async () => {
                                if (!settings.biometricLockEnabled) {
                                    // Verify biometrics before enabling
                                    try {
                                        const result = await invokeNativeCommand<boolean>("request_biometric_auth");
                                        if (result.ok && result.value) {
                                            applySetting(
                                                { biometricLockEnabled: true },
                                                t("settings.security.biometric.enabled", "Biometric lock enabled.")
                                            );
                                        }
                                    } catch (e) {
                                        console.error("Biometric verification failed:", e);
                                    }
                                } else {
                                    applySetting(
                                        { biometricLockEnabled: false },
                                        t("settings.security.biometric.disabled", "Biometric lock disabled.")
                                    );
                                }
                            }}
                            className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none",
                                settings.biometricLockEnabled ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'
                            )}
                        >
                            <span className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                                settings.biometricLockEnabled ? 'translate-x-[22px]' : 'translate-x-1'
                            )} />
                        </button>
                    ) : (
                        <div className="space-y-1 text-right">
                            <div className="text-[10px] font-black text-zinc-500 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-black/5 dark:border-white/5 uppercase tracking-widest inline-block">
                                {t("settings.security.tauriOnly")}
                            </div>
                            <div className="text-[10px] text-zinc-500">{t("settings.security.biometric.webUnavailable", "Unavailable in web runtime.")}</div>
                        </div>
                    )}
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
                        <div className="flex flex-col items-end gap-2">
                            <button
                                onClick={() => applySetting(
                                    { enableTorProxy: !settings.enableTorProxy },
                                    settings.enableTorProxy
                                        ? t("settings.security.tor.disabled", "Tor routing disabled.")
                                        : t("settings.security.tor.enabled", "Tor routing enabled.")
                                )}
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
                            <div className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors",
                                torStatus === 'connected' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                    torStatus === 'starting' ? "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse" :
                                        torStatus === 'error' ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                            "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                            )}>
                                {t(`settings.security.tor.status.${torStatus}`)}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1 text-right">
                            <div className="text-[10px] font-black text-zinc-500 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-black/5 dark:border-white/5 uppercase tracking-widest inline-block">
                                {t("settings.security.tauriOnly")}
                            </div>
                            <div className="text-[10px] text-zinc-500">{t("settings.security.tor.desktopOnly", "Tor routing requires desktop runtime capability.")}</div>
                        </div>
                    )}
                </div>

                {isTauri && (
                    <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className={cn(
                                "rounded-xl border px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider",
                                torStatusSnapshot?.usingExternalInstance
                                    ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                                    : "bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-300"
                            )}>
                                {t("settings.security.tor.runtime.label", "Runtime")}: {torStatusSnapshot?.usingExternalInstance
                                    ? t("settings.security.tor.runtime.shared", "Shared")
                                    : t("settings.security.tor.runtime.sidecar", "Sidecar")}
                            </div>
                            <div className={cn(
                                "rounded-xl border px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider",
                                torStatusSnapshot?.ready
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                    : settings.enableTorProxy
                                        ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
                                        : "bg-zinc-500/10 border-zinc-500/20 text-zinc-700 dark:text-zinc-300"
                            )}>
                                {t("settings.security.tor.reachability.label", "Reachability")}: {torStatusSnapshot?.ready
                                    ? t("settings.security.tor.reachability.ready", "Proxy Reachable")
                                    : settings.enableTorProxy
                                        ? t("settings.security.tor.reachability.pending", "Pending")
                                        : t("settings.security.tor.reachability.disabled", "Disabled")}
                            </div>
                            <div className={cn(
                                "rounded-xl border px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider",
                                torStatus === "connected"
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                    : torStatus === "starting"
                                        ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
                                        : torStatus === "error"
                                            ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"
                                            : "bg-zinc-500/10 border-zinc-500/20 text-zinc-700 dark:text-zinc-300"
                            )}>
                                {t("settings.security.tor.bootstrap.label", "Bootstrap")}: {torStatus === "connected"
                                    ? t("settings.security.tor.bootstrap.ready", "Ready")
                                    : torStatus === "starting"
                                        ? t("settings.security.tor.bootstrap.starting", "Starting")
                                        : torStatus === "error"
                                            ? t("settings.security.tor.bootstrap.error", "Error")
                                            : t("settings.security.tor.bootstrap.idle", "Idle")}
                            </div>
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                            {t("settings.security.tor.proxy.label", "Proxy")}: {torStatusSnapshot?.proxyUrl || settings.torProxyUrl}
                        </div>
                    </div>
                )}

                {isTauri && torRestartRequired && (
                    <div className="mt-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-1">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="text-[11px] leading-relaxed text-amber-700/90 font-medium">
                                {t("settings.security.tor.restartRequired")}
                            </div>
                        </div>
                        <button
                            onClick={handleRestart}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-amber-700 transition-colors shadow-sm"
                        >
                            {t("settings.security.tor.restartNow")}
                        </button>
                    </div>
                )}

                {isTauri && settings.enableTorProxy && (
                    <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                        <button
                            onClick={() => setShowLogs(!showLogs)}
                            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors uppercase tracking-wider mb-2"
                        >
                            {showLogs
                                ? t("settings.security.tor.logs.hide", "Hide Logs")
                                : t("settings.security.tor.logs.show", "Show Connection Logs")}
                        </button>
                        {showLogs && (
                            <div className="mt-2 p-3 rounded-xl bg-black dark:bg-zinc-950 font-mono text-[10px] text-emerald-500/90 h-32 overflow-y-auto custom-scrollbar leading-relaxed">
                                {torLogs.length > 0 ? (
                                    torLogs.map((log, i) => <div key={i}>{log}</div>)
                                ) : (
                                    <div className="text-zinc-600 italic">{t("settings.security.tor.logs.waiting", "Waiting for logs...")}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}
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
            <SettingsActionStatus
                title={t("settings.security.action.title", "Security Controls")}
                phase={actionPhase}
                message={actionMessage || undefined}
                summary={t("settings.security.action.summary", "Security changes are applied locally and persisted immediately.")}
            />
        </div>
    );
};
